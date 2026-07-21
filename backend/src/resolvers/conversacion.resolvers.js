import { requireAuth } from "../utils/authHelpers.js";

const inc = {
  cliente: true,
  canal: true,
  tierEstimado: true,
  motivoPerdida: true,
  usuario: true,
  piezas: {
    where: { deletedAt: null },
    include: { producto: { include: { categoria: true } } },
    orderBy: { id: "asc" },
  },
};

// ── Helper: elimina nulls, undefined y strings vacíos ─────────
// Evita que Prisma rechace campos de relación con valor null en updateMany
const cleanForUpdate = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([_, v]) => v !== null && v !== undefined && v !== "",
    ),
  );

// Sincronizar piezas de interés (reemplaza el set completo)
const syncPiezas = async (tx, conversacionId, piezasIds = []) => {
  await tx.conversacionProducto.updateMany({
    where: { conversacionId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  for (const productoId of piezasIds) {
    await tx.conversacionProducto.create({
      data: { conversacionId, productoId },
    });
  }
};

export default {
  Conversacion: {
    fecha: (c) => (c.fecha ? new Date(c.fecha).toISOString() : null),
  },
  Query: {
    conversacionesFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { telefono: { contains: t, mode: "insensitive" } },
          { nombreContacto: { contains: t, mode: "insensitive" } },
          { cliente: { nombre: { contains: t, mode: "insensitive" } } },
          { nota: { contains: t, mode: "insensitive" } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fecha: "desc" }];
      const items = await prisma.conversacion.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: inc,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.conversacion.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    kpisConversaciones: async (_, { mes, anio }, { prisma, user }) => {
      requireAuth(user);
      const ahora = new Date();
      const m = mes ?? ahora.getMonth() + 1,
        a = anio ?? ahora.getFullYear();
      const inicio = new Date(a, m - 1, 1),
        fin = new Date(a, m, 1);
      const convs = await prisma.conversacion.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          fecha: { gte: inicio, lt: fin },
        },
        include: { motivoPerdida: true },
      });
      const total = convs.length;
      const cotizaron = convs.filter((c) => c.cotizo).length;
      const cerraron = convs.filter((c) => c.cerro).length;
      const usaronProtocolo = convs.filter((c) => c.usoProtocolo).length;
      const noVendieron = convs.filter((c) => c.cotizo && !c.cerro);
      return {
        total,
        cotizaron,
        cerraron,
        tasaCierre:
          total > 0 ? Math.round((cerraron / total) * 10000) / 100 : 0,
        usaronProtocolo,
        pctProtocolo:
          total > 0 ? Math.round((usaronProtocolo / total) * 10000) / 100 : 0,
        perdidaSilencio: noVendieron.filter((c) => !c.motivoPerdidaId).length,
        perdidaPrecio: noVendieron.filter(
          (c) => c.motivoPerdida?.codigo === "PRECIO",
        ).length,
        perdidaStock: noVendieron.filter(
          (c) => c.motivoPerdida?.codigo === "SINPRE",
        ).length,
      };
    },

    buscarContactoPorCelular: async (
      _,
      { telefono, empresaId },
      { prisma, user },
    ) => {
      requireAuth(user);
      const t = telefono.trim().replace(/\s/g, "");
      const cliente = await prisma.tercero.findFirst({
        where: {
          empresaId: Number(empresaId),
          telefono: { contains: t },
          deletedAt: null,
        },
      });
      if (cliente) {
        return {
          clienteId: cliente.id,
          nombre: cliente.nombre,
          telefono: t,
          esCliente: true,
        };
      }
      return { clienteId: null, nombre: null, telefono: t, esCliente: false };
    },
  },

  Mutation: {
    crearConversacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      console.log("Conversacion  create...", input);
      const { piezasIds, ...data } = input;
      const conv = await prisma.$transaction(async (tx) => {
        const c = await tx.conversacion.create({
          data: {
            ...data,
            fecha: new Date(data.fecha),
            usu_creacion: user.codigo,
          },
          include: inc,
        });
        if (piezasIds?.length) await syncPiezas(tx, c.id, piezasIds);
        return tx.conversacion.findUnique({
          where: { id: c.id },
          include: inc,
        });
      });
      return conv;
    },

    actualizarConversacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, piezasIds, empresaId, ...data } = input;

      // cleanForUpdate elimina nulls/undefined/vacíos — Prisma los rechaza en updateMany
      const dataLimpia = cleanForUpdate(data);

      await prisma.$transaction(async (tx) => {
        const result = await tx.conversacion.updateMany({
          where: { id: Number(id), version: Number(version) },
          data: {
            ...dataLimpia,
            fecha: new Date(dataLimpia.fecha),
            version: { increment: 1 },
          },
        });
        if (result.count === 0) throw new Error("Modificado por otro usuario");
        if (piezasIds !== undefined)
          await syncPiezas(tx, Number(id), piezasIds);
      });
      return prisma.conversacion.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },

    eliminarConversacion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.conversacion.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

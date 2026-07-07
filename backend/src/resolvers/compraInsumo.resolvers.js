import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const incluirRelaciones = {
  piedra: { include: { tipo: true, unidad: true } },
  proveedor: true,
};

export default {
  CompraInsumo: {
    fecha: (c) => (c.fecha ? new Date(c.fecha).toISOString() : null),
  },
  Query: {
    comprasFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { numero: { contains: t, mode: "insensitive" } },
          { piedra: { nombre: { contains: t, mode: "insensitive" } } },
          { proveedor: { nombre: { contains: t, mode: "insensitive" } } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fecha: "desc" }];
      const items = await prisma.compraInsumo.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incluirRelaciones,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.compraInsumo.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    obtenerCompras: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.compraInsumo.findMany({
        where: { empresaId: user.empresaActualId, deletedAt: null },
        orderBy: { fecha: "desc" },
        include: incluirRelaciones,
      });
    },

    comprasPorPiedra: (_, { piedraId }, { prisma, user }) => {
      requireAuth(user);
      return prisma.compraInsumo.findMany({
        where: {
          empresaId: user.empresaActualId,
          piedraId: Number(piedraId),
          deletedAt: null,
          cantidadDisponible: { gt: 0 },
        },
        orderBy: { fecha: "asc" },
        include: incluirRelaciones,
      });
    },
  },

  Mutation: {
    crearCompraInsumo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.compraInsumo.findFirst({
        where: {
          numero: input.numero,
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error(`El número ${input.numero} ya existe`);
      const costoTotal = Number(input.cantidad) * Number(input.costoUnitario);
      return prisma.compraInsumo.create({
        data: {
          ...input,
          fecha: new Date(input.fecha),
          costoTotal,
          cantidadDisponible: Number(input.cantidad),
          usu_creacion: user.codigo,
        },
        include: incluirRelaciones,
      });
    },

    actualizarCompraInsumo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.compraInsumo.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Compra no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const costoTotal = Number(data.cantidad) * Number(data.costoUnitario);
      const diferencia = Number(data.cantidad) - Number(original.cantidad);
      const nuevaDisponible = Math.max(
        0,
        Number(original.cantidadDisponible) + diferencia,
      );
      const result = await prisma.compraInsumo.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          fecha: new Date(data.fecha),
          costoTotal,
          cantidadDisponible: nuevaDisponible,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.compraInsumo.findUnique({
        where: { id: Number(id) },
        include: incluirRelaciones,
      });
    },

    eliminarCompraInsumo: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.compraInsumo.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const enUso = await prisma.detalleOrdenProduccion.count({
        where: { compraInsumoId: Number(id), deletedAt: null },
      });
      if (enUso > 0)
        throw new Error(
          "Esta compra ya tiene movimientos en órdenes de producción",
        );
      await prisma.compraInsumo.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },
  },
};

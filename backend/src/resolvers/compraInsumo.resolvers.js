import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const incluirItem = {
  piedra: { include: { tipo: true, unidad: true } },
};

const incluirCompra = {
  proveedor: true,
  items: {
    where: { deletedAt: null },
    include: incluirItem,
    orderBy: { id: "asc" },
  },
};

export default {
  Compra: {
    fecha: (c) => (c.fecha ? new Date(c.fecha).toISOString() : null),
    totalItems: (c) => (c.items || []).length,
    valorTotal: (c) => (c.items || []).reduce((s, i) => s + Number(i.costoTotal), 0),
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
          { proveedor: { nombre: { contains: t, mode: "insensitive" } } },
          {
            items: {
              some: {
                deletedAt: null,
                piedra: { nombre: { contains: t, mode: "insensitive" } },
              },
            },
          },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fecha: "desc" }];
      const items = await prisma.compra.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incluirCompra,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.compra.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    obtenerCompras: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.compra.findMany({
        where: { empresaId: user.empresaActualId, deletedAt: null },
        orderBy: { fecha: "desc" },
        include: incluirCompra,
      });
    },

    comprasPorPiedra: (_, { piedraId }, { prisma, user }) => {
      requireAuth(user);
      return prisma.compraInsumo.findMany({
        where: {
          piedraId: Number(piedraId),
          deletedAt: null,
          cantidadDisponible: { gt: 0 },
          compra: { empresaId: user.empresaActualId, deletedAt: null },
        },
        orderBy: { compra: { fecha: "asc" } },
        include: { ...incluirItem, compra: true },
      });
    },
  },

  Mutation: {
    crearCompra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.compra.findFirst({
        where: {
          numero: input.numero,
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error(`El número ${input.numero} ya existe`);
      return prisma.compra.create({
        data: {
          ...input,
          fecha: new Date(input.fecha),
          usu_creacion: user.codigo,
        },
        include: incluirCompra,
      });
    },

    actualizarCompra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.compra.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Compra no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.compra.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          fecha: new Date(data.fecha),
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.compra.findUnique({
        where: { id: Number(id) },
        include: incluirCompra,
      });
    },

    eliminarCompra: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.compra.findUnique({
        where: { id: Number(id) },
        include: { items: { where: { deletedAt: null } } },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const idsItems = original.items.map((i) => i.id);
      if (idsItems.length > 0) {
        const enUso = await prisma.detalleOrdenProduccion.count({
          where: { compraInsumoId: { in: idsItems }, deletedAt: null },
        });
        if (enUso > 0)
          throw new Error(
            "Esta compra tiene insumos con movimientos en órdenes de producción — no se puede eliminar",
          );
      }
      await prisma.$transaction(async (tx) => {
        for (const it of original.items) {
          await tx.compraInsumo.update({
            where: { id: it.id },
            data: { deletedAt: new Date() },
          });
        }
        await tx.compra.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },

    agregarItemCompra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const compra = await prisma.compra.findUnique({
        where: { id: Number(input.compraId) },
      });
      if (!compra) throw new Error("Compra no existe");
      validarEmpresa(compra.empresaId, user.empresaActualId);
      const costoTotal = Number(input.cantidad) * Number(input.costoUnitario);
      return prisma.compraInsumo.create({
        data: {
          compraId: Number(input.compraId),
          piedraId: Number(input.piedraId),
          cantidad: Number(input.cantidad),
          costoUnitario: Number(input.costoUnitario),
          costoTotal,
          cantidadDisponible: Number(input.cantidad),
          usu_creacion: user.codigo,
        },
        include: incluirItem,
      });
    },

    actualizarItemCompra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, cantidad, costoUnitario } = input;
      const original = await prisma.compraInsumo.findUnique({
        where: { id: Number(id) },
        include: { compra: true },
      });
      if (!original) throw new Error("Insumo de la compra no existe");
      validarEmpresa(original.compra.empresaId, user.empresaActualId);
      const costoTotal = Number(cantidad) * Number(costoUnitario);
      const diferencia = Number(cantidad) - Number(original.cantidad);
      const nuevaDisponible = Math.max(
        0,
        Number(original.cantidadDisponible) + diferencia,
      );
      const result = await prisma.compraInsumo.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          cantidad: Number(cantidad),
          costoUnitario: Number(costoUnitario),
          costoTotal,
          cantidadDisponible: nuevaDisponible,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.compraInsumo.findUnique({
        where: { id: Number(id) },
        include: incluirItem,
      });
    },

    eliminarItemCompra: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.compraInsumo.findUnique({
        where: { id: Number(id) },
        include: { compra: true },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.compra.empresaId, user.empresaActualId);
      const enUso = await prisma.detalleOrdenProduccion.count({
        where: { compraInsumoId: Number(id), deletedAt: null },
      });
      if (enUso > 0)
        throw new Error("Este insumo ya tiene movimientos en órdenes de producción");
      await prisma.compraInsumo.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },
  },
};

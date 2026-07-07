import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

export default {
  Query: {
    catalogos: (_, { empresaId }, { prisma }) =>
      prisma.catalogo.findMany({
        where: { empresaId: Number(empresaId), deletedAt: null },
      }),

    obtenerCatalogos: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.catalogo.findMany({
        where: { empresaId: user.empresaActualId, deletedAt: null },
        orderBy: { codigo: "asc" },
      });
    },

    catalogosFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { codigo: { contains: t, mode: "insensitive" } },
          { nombre: { contains: t, mode: "insensitive" } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ codigo: "asc" }];
      const items = await prisma.catalogo.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.catalogo.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
  },

  Mutation: {
    crearCatalogo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      // Catalogo NO tiene usu_creacion en el schema
      return prisma.catalogo.create({
        data: {
          empresaId: Number(input.empresaId),
          codigo: input.codigo,
          nombre: input.nombre,
          version: input.version ?? 1,
        },
      });
    },

    actualizarCatalogo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const result = await prisma.catalogo.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          codigo: data.codigo,
          nombre: data.nombre,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.catalogo.findUnique({ where: { id: Number(id) } });
    },

    eliminarCatalogo: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.catalogo.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

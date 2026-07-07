import { requireAuth } from "../utils/authHelpers.js";

const inc = { catalogo: true };

export default {
  Query: {
    subCatalogos: (_, { catalogoId }, { prisma }) =>
      prisma.subCatalogo.findMany({
        where: { catalogoId: Number(catalogoId), deletedAt: null },
        include: inc,
      }),

    obtenerSubCatalogosPorCatalogo: (_, { catalogoId }, { prisma }) =>
      prisma.subCatalogo.findMany({
        where: { catalogoId: Number(catalogoId), deletedAt: null },
        orderBy: { codigo: "asc" },
        include: inc,
      }),

    subcatalogosFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const catalogosEmpresa = await prisma.catalogo.findMany({
        where: { empresaId: user.empresaActualId, deletedAt: null },
        select: { id: true },
      });
      const ids = catalogosEmpresa.map((c) => c.id);
      const where = { catalogoId: { in: ids }, deletedAt: null };

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

      const items = await prisma.subCatalogo.findMany({
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
            ? (await prisma.subCatalogo.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
  },

  Mutation: {
    crearSubCatalogo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      // SubCatalogo NO tiene usu_creacion en el schema
      return prisma.subCatalogo.create({
        data: {
          catalogoId: Number(input.catalogoId),
          codigo: input.codigo,
          nombre: input.nombre,
          version: input.version ?? 1,
        },
        include: inc,
      });
    },

    actualizarSubCatalogo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const result = await prisma.subCatalogo.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          codigo: data.codigo,
          nombre: data.nombre,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.subCatalogo.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },

    eliminarSubCatalogo: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.subCatalogo.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

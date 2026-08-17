import { requireAuth } from "../utils/authHelpers.js";

const inc = { subcatalogo: { include: { catalogo: true } } };

export default {
  Query: {
    grupos: (_, { subcatalogoId }, { prisma, user }) => {
      requireAuth(user);
      return prisma.grupo.findMany({
        where: { subcatalogoId: Number(subcatalogoId), deletedAt: null },
        orderBy: { nombre: "asc" },
      });
    },

    gruposPorCodigos: async (
      _,
      { catalogoCodigo, subcatalogoCodigo },
      { prisma, user },
    ) => {
      requireAuth(user);
      return prisma.grupo.findMany({
        where: {
          deletedAt: null,
          subcatalogo: {
            codigo: subcatalogoCodigo,
            catalogo: {
              codigo: catalogoCodigo,
              empresaId: user.empresaActualId,
            },
          },
        },
        orderBy: { nombre: "asc" },
      });
    },

    gruposFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const subcats = await prisma.subCatalogo.findMany({
        where: {
          catalogo: { empresaId: user.empresaActualId },
          deletedAt: null,
        },
        select: { id: true },
      });
      const ids = subcats.map((s) => s.id);
      const where = { subcatalogoId: { in: ids }, deletedAt: null };

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
          : [
              {
                subcatalogo: {
                  catalogo: { codigo: "asc" },
                },
              },
              { subcatalogoId: "asc" },
              { codigo: "asc" },
            ];

      console.log("Order by grupo", orderByClause);
      console.log("orden...", orden);

      const items = await prisma.grupo.findMany({
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
            ? (await prisma.grupo.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    validarCodigoGrupo: async (
      _,
      { subcatalogoId, codigo },
      { prisma, user },
    ) => {
      requireAuth(user);

      // Verificamos propiedad antes de validar
      const sub = await prisma.subCatalogo.findFirst({
        where: { id: Number(subcatalogoId) },
        include: { catalogo: true },
      });

      if (!sub || sub.catalogo.empresaId !== user.empresaActualId) return false;

      const existe = await prisma.grupo.findFirst({
        where: {
          subcatalogoId: Number(subcatalogoId),
          codigo: codigo.trim(),
          deletedAt: null,
        },
      });
      return !!existe;
    },
  },

  Mutation: {
    crearGrupo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      // Grupo NO tiene usu_creacion — solo subcatalogoId, codigo, nombre, version
      return prisma.grupo.create({
        data: {
          subcatalogoId: Number(input.subcatalogoId),
          codigo: input.codigo,
          nombre: input.nombre,
          version: input.version ?? 1,
        },
        include: inc,
      });
    },

    actualizarGrupo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      console.log("Input.....", input);
      const { id, version, ...data } = input;
      // Grupo NO tiene usu_actualizacion
      console.log("Data.....", data);
      const result = await prisma.grupo.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          subcatalogoId: data.subcatalogoId,
          codigo: data.codigo,
          nombre: data.nombre,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.grupo.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },

    eliminarGrupo: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.grupo.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

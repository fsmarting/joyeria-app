import { requireAuth } from "../utils/authHelpers.js";

const inc = { empresa: true, usuario: true, rol: true };

export default {
  Query: {
    usuarioEmpresasFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma },
    ) => {
      const where = { deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { usuario: { nombre: { contains: t, mode: "insensitive" } } },
          { empresa: { nombre: { contains: t, mode: "insensitive" } } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ empresa: { nombre: "asc" } }];
      const items = await prisma.usuarioEmpresa.findMany({
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
            ? (await prisma.usuarioEmpresa.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
    obtenerUsuarioEmpresas: (_, __, { prisma }) =>
      prisma.usuarioEmpresa.findMany({
        where: { deletedAt: null },
        include: inc,
      }),
    validarCodigoUsuarioEmpresa: async (
      _,
      { empresaId, usuarioId },
      { prisma },
    ) => {
      const existe = await prisma.usuarioEmpresa.findFirst({
        where: {
          empresaId: Number(empresaId),
          usuarioId: Number(usuarioId),
          deletedAt: null,
        },
      });
      return !!existe;
    },
  },
  Mutation: {
    crearUsuarioEmpresa: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      return prisma.usuarioEmpresa.create({
        data: { ...input, usu_creacion: user?.codigo },
        include: inc,
      });
    },
    actualizarUsuarioEmpresa: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const result = await prisma.usuarioEmpresa.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          version: { increment: 1 },
          usu_actualizacion: user?.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.usuarioEmpresa.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },
    eliminarUsuarioEmpresa: async (_, { id }, { prisma }) => {
      await prisma.usuarioEmpresa.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

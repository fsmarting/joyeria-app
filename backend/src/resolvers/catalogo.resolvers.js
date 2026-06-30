export default {
  Query: {
    catalogos: (_, { empresaId }, { prisma }) =>
      prisma.catalogo.findMany({ where: { empresaId, deletedAt: null } }),
  },
};

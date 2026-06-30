export default {
  Query: {
    grupos: (_, { subcatalogoId }, { prisma }) =>
      prisma.grupo.findMany({ where: { subcatalogoId, deletedAt: null } }),
  },
};

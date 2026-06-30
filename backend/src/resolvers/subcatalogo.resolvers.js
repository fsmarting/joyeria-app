export default {
  Query: {
    subCatalogos: (_, { catalogoId }, { prisma }) =>
      prisma.subCatalogo.findMany({ where: { catalogoId, deletedAt: null } }),
  },
};

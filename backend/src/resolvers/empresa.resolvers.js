export default {
  Query: {
    empresas: (_, __, { prisma }) => prisma.empresa.findMany({ where: { deletedAt: null } }),
    empresa: (_, { id }, { prisma }) => prisma.empresa.findUnique({ where: { id } }),
  },
};

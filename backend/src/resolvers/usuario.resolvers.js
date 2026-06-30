export default {
  Query: {
    yo: (_, __, { prisma, user }) => {
      if (!user) return null;
      return prisma.usuario.findUnique({ where: { id: user.id } });
    },
  },
};

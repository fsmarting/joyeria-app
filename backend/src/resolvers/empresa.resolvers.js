import { requireAuth } from "../utils/authHelpers.js";

export default {
  Query: {
    empresas: (_, __, { prisma }) =>
      prisma.empresa.findMany({ where: { deletedAt: null } }),
    empresa: (_, { id }, { prisma }) =>
      prisma.empresa.findUnique({ where: { id: Number(id) } }),
    obtenerEmpresas: (_, __, { prisma }) =>
      prisma.empresa.findMany({
        where: { deletedAt: null },
        orderBy: { nombre: "asc" },
      }),
    validarCodigoEmpresa: async (_, { codigo }, { prisma }) => {
      const existe = await prisma.empresa.findFirst({
        where: { codigo: codigo.toUpperCase(), deletedAt: null },
      });
      return !!existe;
    },
  },
  Mutation: {
    crearEmpresa: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      // 1. VALIDAR DUPLICADOS
      const existe = await prisma.empresa.findFirst({
        where: { codigo: input.codigo.trim() },
      });

      if (existe) {
        if (existe.deletedAt) {
          throw new Error(
            `El código "${input.codigo}" pertenece a una empresa eliminada.`,
          );
        }
        throw new Error(`El código "${input.codigo}" ya existe en el sistema.`);
      }
      return prisma.empresa.create({
        data: {
          ...input,
          codigo: input.codigo.toUpperCase(),
          usu_creacion: user?.codigo,
        },
      });
    },
    actualizarEmpresa: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const result = await prisma.empresa.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          codigo: data.codigo.toUpperCase(),
          version: { increment: 1 },
          usu_actualizacion: user?.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.empresa.findUnique({ where: { id: Number(id) } });
    },
    eliminarEmpresa: async (_, { id }, { prisma }) => {
      await prisma.empresa.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

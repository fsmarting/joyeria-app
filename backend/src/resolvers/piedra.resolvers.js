import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const inc = { tipo: true, unidad: true };

export default {
  Query: {
    piedrasFiltradosCursor: async (
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
      const items = await prisma.piedra.findMany({
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
            ? (await prisma.piedra.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
    obtenerPiedras: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.piedra.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          activo: true,
        },
        orderBy: { codigo: "asc" },
        include: inc,
      });
    },
    validarCodigoPiedra: async (_, { empresaId, codigo }, { prisma, user }) => {
      requireAuth(user);
      const existe = await prisma.piedra.findFirst({
        where: {
          empresaId: Number(empresaId),
          codigo: codigo,
          deletedAt: null,
        },
        select: { id: true },
      });
      console.log("Existe...", existe);
      console.log("!!Existe...", !!existe);
      return !!existe;
    },
  },
  Mutation: {
    crearPiedra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.piedra.findFirst({
        where: {
          codigo: input.codigo,
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error("El código ya existe");
      return prisma.piedra.create({
        data: {
          ...input,
          activo: input.activo ?? true,
          usu_creacion: user.codigo,
        },
        include: inc,
      });
    },
    actualizarPiedra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.piedra.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.piedra.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.piedra.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },
    eliminarPiedra: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.piedra.findUnique({
        where: { id: Number(id) },
      });
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.piedra.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },
  },
};

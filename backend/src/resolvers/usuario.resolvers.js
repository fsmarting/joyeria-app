import bcrypt from 'bcryptjs';
import { requireAuth } from '../utils/authHelpers.js';

const incEstado = { estado: true };

export default {
  Query: {
    yo: (_, __, { prisma, user }) => {
      if (!user) return null;
      return prisma.usuario.findUnique({ where: { id: user.id }, include: incEstado });
    },
    obtenerUsuarios: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.usuario.findMany({
        where: { deletedAt: null, empresasAsignadas: { some: { empresaId: user.empresaActualId, deletedAt: null } } },
        orderBy: { nombre: 'asc' }, include: incEstado,
      });
    },
    obtenerUsuariosGlobales: (_, __, { prisma }) =>
      prisma.usuario.findMany({ where: { deletedAt: null }, orderBy: { nombre: 'asc' } }),

    usuariosFiltradosCursor: async (_, { first=10, after=null, orden=[], direccion=[], busqueda='' }, { prisma }) => {
      const where = { deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [{ codigo: { contains: t, mode: 'insensitive' } }, { nombre: { contains: t, mode: 'insensitive' } }];
      }
      const orderByClause = orden.length > 0 ? orden.map((c,i) => ({ [c]: direccion[i]||'asc' })) : [{ codigo: 'asc' }];
      const items = await prisma.usuario.findMany({
        where, take: first, skip: after?1:0,
        cursor: after?{id:Number(after)}:undefined,
        orderBy: orderByClause, include: incEstado,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: { endCursor: last?String(last.id):null, hasNextPage: last?(await prisma.usuario.count({ where: { ...where, id: { gt: last.id } } }))>0:false },
      };
    },
    validarCodigoUsuario: async (_, { codigo }, { prisma }) => {
      const existe = await prisma.usuario.findFirst({ where: { codigo: codigo.toUpperCase(), deletedAt: null } });
      return !!existe;
    },
  },
  Mutation: {
    crearUsuario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const hash = await bcrypt.hash(input.password, 10);
      return prisma.usuario.create({
        data: { ...input, codigo: input.codigo.toUpperCase(), password: hash, usu_creacion: user?.codigo },
        include: incEstado,
      });
    },
    actualizarUsuario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, password, ...data } = input;
      const updateData = { ...data, version: { increment: 1 }, usu_actualizacion: user?.codigo };
      if (password && password.trim()) updateData.password = await bcrypt.hash(password, 10);
      const result = await prisma.usuario.updateMany({
        where: { id: Number(id), version: Number(version) }, data: updateData,
      });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.usuario.findUnique({ where: { id: Number(id) }, include: incEstado });
    },
    eliminarUsuario: async (_, { id }, { prisma }) => {
      await prisma.usuario.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return true;
    },
  },
};

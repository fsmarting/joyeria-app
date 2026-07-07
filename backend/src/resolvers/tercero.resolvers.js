import { requireAuth }    from '../utils/authHelpers.js';
import { validarEmpresa } from '../utils/validations.js';

const inc = {
  tipo: true, tipoDocumento: true, tier: true, canal: true,
  especialidades: {
    where: { deletedAt: null },
    include: { especialidad: true },
    orderBy: [{ esPrincipal: 'desc' }, { especialidad: { nombre: 'asc' } }],
  },
};

export default {
  Query: {
    tercerosFiltradosCursor: async (
      _, { first=10, after=null, orden=[], direccion=[], busqueda='', tipoCodigo=null },
      { prisma, user }
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (tipoCodigo) where.tipo = { codigo: tipoCodigo };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { nombre:   { contains: t, mode: 'insensitive' } },
          { telefono: { contains: t, mode: 'insensitive' } },
          { ciudad:   { contains: t, mode: 'insensitive' } },
        ];
      }
      const orderByClause = orden.length > 0
        ? orden.map((c,i) => ({ [c]: direccion[i]||'asc' }))
        : [{ nombre: 'asc' }];
      const items = await prisma.tercero.findMany({
        where, take: first, skip: after?1:0,
        cursor: after?{id:Number(after)}:undefined,
        orderBy: orderByClause, include: inc,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last?String(last.id):null,
          hasNextPage: last?(await prisma.tercero.count({ where: { ...where, id: { gt: last.id } } }))>0:false,
        },
      };
    },

    obtenerTercerosPorTipo: (_, { tipoCodigo }, { prisma, user }) => {
      requireAuth(user);
      return prisma.tercero.findMany({
        where: { empresaId: user.empresaActualId, deletedAt: null, activo: true, tipo: { codigo: tipoCodigo } },
        orderBy: { nombre: 'asc' }, include: inc,
      });
    },
  },

  Mutation: {
    crearTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      return prisma.tercero.create({
        data: { ...input, activo: input.activo ?? true, usu_creacion: user.codigo },
        include: inc,
      });
    },

    actualizarTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.tercero.findUnique({ where: { id: Number(id) } });
      if (!original) throw new Error('Tercero no existe');
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.tercero.updateMany({
        where: { id: Number(id), version: Number(version) },
        data:  { ...data, version: { increment: 1 }, usu_actualizacion: user.codigo },
      });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.tercero.findUnique({ where: { id: Number(id) }, include: inc });
    },

    eliminarTercero: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.tercero.findUnique({ where: { id: Number(id) } });
      if (!original) throw new Error('No existe');
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.tercero.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), usu_actualizacion: user.codigo } });
      return true;
    },

    agregarEspecialidadTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({ where: { id: input.terceroId } });
      if (!tercero) throw new Error('Tercero no existe');
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      const existe = await prisma.terceroEspecialidad.findFirst({ where: { terceroId: input.terceroId, especialidadId: input.especialidadId, deletedAt: null } });
      if (existe) throw new Error('Ya tiene esa especialidad');
      return prisma.terceroEspecialidad.create({ data: { ...input, esPrincipal: input.esPrincipal ?? false }, include: { especialidad: true } });
    },

    removerEspecialidadTercero: async (_, { terceroId, especialidadId }, { prisma, user }) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({ where: { id: terceroId } });
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      await prisma.terceroEspecialidad.updateMany({ where: { terceroId, especialidadId, deletedAt: null }, data: { deletedAt: new Date() } });
      return true;
    },

    actualizarNivelEspecialidadTercero: async (_, { terceroId, especialidadId, nivel, esPrincipal }, { prisma, user }) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({ where: { id: terceroId } });
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      const record = await prisma.terceroEspecialidad.findFirst({ where: { terceroId, especialidadId, deletedAt: null } });
      if (!record) throw new Error('No existe esa especialidad');
      return prisma.terceroEspecialidad.update({ where: { id: record.id }, data: { nivel, esPrincipal: esPrincipal ?? record.esPrincipal }, include: { especialidad: true } });
    },
  },
};

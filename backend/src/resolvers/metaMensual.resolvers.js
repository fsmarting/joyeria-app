import { requireAuth }    from '../utils/authHelpers.js';
import { validarEmpresa } from '../utils/validations.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default {
  MetaMensual: {
    metaIngresos: (m) => Number(m.metaIngresos),
    nombreMes:    (m) => MESES[(m.mes ?? 1) - 1] ?? '',
  },

  Query: {
    metasMensualesCursor: async (_, { first=12, after=null, orden=[], direccion=[] }, { prisma, user }) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      const orderByClause = orden.length > 0
        ? orden.map((c,i) => ({ [c]: direccion[i]||'asc' }))
        : [{ anio: 'desc' }, { mes: 'desc' }];
      const items = await prisma.metaMensual.findMany({ where, take: first, skip: after?1:0, cursor: after?{id:Number(after)}:undefined, orderBy: orderByClause });
      const last = items[items.length - 1];
      return {
        edges: items.map(item => ({ node: item, cursor: String(item.id) })),
        pageInfo: { endCursor: last?String(last.id):null, hasNextPage: last?(await prisma.metaMensual.count({ where: { ...where, id: { gt: last.id } } }))>0:false },
      };
    },
    metaDelMes: async (_, { anio, mes }, { prisma, user }) => {
      requireAuth(user);
      const m = await prisma.metaMensual.findUnique({ where: { empresaId_anio_mes: { empresaId: user.empresaActualId, anio, mes } } });
      return m ? { ...m, metaIngresos: Number(m.metaIngresos) } : null;
    },
  },

  Mutation: {
    crearMetaMensual: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.metaMensual.findUnique({ where: { empresaId_anio_mes: { empresaId: input.empresaId, anio: input.anio, mes: input.mes } } });
      if (existe) throw new Error(`Ya existe meta para ${input.mes}/${input.anio}`);
      const m = await prisma.metaMensual.create({ data: { ...input } });
      return { ...m, metaIngresos: Number(m.metaIngresos) };
    },
    actualizarMetaMensual: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const result = await prisma.metaMensual.updateMany({ where: { id: Number(id), version: Number(version) }, data: { ...data, version: { increment: 1 } } });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      const m = await prisma.metaMensual.findUnique({ where: { id: Number(id) } });
      return { ...m, metaIngresos: Number(m.metaIngresos) };
    },
    eliminarMetaMensual: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.metaMensual.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return true;
    },
  },
};

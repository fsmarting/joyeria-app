import { requireAuth } from '../utils/authHelpers.js';

const inc = {
  cliente:       true,
  usuario:       true,
  canal:         true,
  motivoPerdida: true,
  producto:      { include: { categoria: true } },
};

export default {
  Query: {
    conversacionesFiltradosCursor: async (_, { first=10, after=null, orden=[], direccion=[], busqueda='' }, { prisma, user }) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { cliente:  { nombre: { contains: t, mode: 'insensitive' } } },
          { producto: { nombre: { contains: t, mode: 'insensitive' } } },
          { nota:     { contains: t, mode: 'insensitive' } },
        ];
      }
      const orderByClause = orden.length > 0 ? orden.map((c,i) => ({ [c]: direccion[i]||'asc' })) : [{ fecha: 'desc' }];
      const items = await prisma.conversacion.findMany({ where, take: first, skip: after?1:0, cursor: after?{id:Number(after)}:undefined, orderBy: orderByClause, include: inc });
      const last = items[items.length - 1];
      return { edges: items.map(item => ({ node: item, cursor: String(item.id) })), pageInfo: { endCursor: last?String(last.id):null, hasNextPage: last?(await prisma.conversacion.count({ where: { ...where, id: { gt: last.id } } }))>0:false } };
    },

    kpisConversaciones: async (_, { mes, anio }, { prisma, user }) => {
      requireAuth(user);
      const ahora = new Date();
      const m = mes ?? (ahora.getMonth()+1), a = anio ?? ahora.getFullYear();
      const inicio = new Date(a, m-1, 1), fin = new Date(a, m, 1);
      const convs = await prisma.conversacion.findMany({ where: { empresaId: user.empresaActualId, deletedAt: null, fecha: { gte: inicio, lt: fin } }, include: { motivoPerdida: true } });
      const total = convs.length;
      const cotizaron = convs.filter(c => c.cotizo).length;
      const cerraron  = convs.filter(c => c.cerro).length;
      const usaronProtocolo = convs.filter(c => c.usoProtocolo).length;
      const noVendieron = convs.filter(c => c.cotizo && !c.cerro);
      return {
        total, cotizaron, cerraron,
        tasaCierre: total > 0 ? Math.round((cerraron/total)*10000)/100 : 0,
        usaronProtocolo,
        pctProtocolo: total > 0 ? Math.round((usaronProtocolo/total)*10000)/100 : 0,
        perdidaSilencio: noVendieron.filter(c => !c.motivoPerdidaId).length,
        perdidaPrecio:   noVendieron.filter(c => c.motivoPerdida?.codigo === 'PREC').length,
        perdidaStock:    noVendieron.filter(c => c.motivoPerdida?.codigo === 'STCK').length,
      };
    },
  },

  Mutation: {
    crearConversacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      return prisma.conversacion.create({ data: { ...input, fecha: new Date(input.fecha), usu_creacion: user.codigo }, include: inc });
    },
    actualizarConversacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const result = await prisma.conversacion.updateMany({ where: { id: Number(id), version: Number(version) }, data: { ...data, fecha: new Date(data.fecha), version: { increment: 1 }, usu_actualizacion: user.codigo } });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.conversacion.findUnique({ where: { id: Number(id) }, include: inc });
    },
    eliminarConversacion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.conversacion.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return true;
    },
  },
};

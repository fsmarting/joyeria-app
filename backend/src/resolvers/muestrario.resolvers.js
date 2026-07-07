import { requireAuth }    from '../utils/authHelpers.js';
import { validarEmpresa } from '../utils/validations.js';

const incItem = {
  producto: { include: { categoria: true } },
  ventas: {
    where: { deletedAt: null, estado: { codigo: { not: 'ANUL' } } },
    include: { cliente: true, medioPago: true, estado: true },
  },
};

const incMuestrario = {
  vendedora: true,
  items: { where: { deletedAt: null }, include: incItem, orderBy: { id: 'asc' } },
};

export default {
  Muestrario: {
    fechaSalida: (m) => m.fechaSalida ? new Date(m.fechaSalida).toISOString() : null,
    fechaCierre: (m) => m.fechaCierre ? new Date(m.fechaCierre).toISOString() : null,
    totalPiezas:            (m) => (m.items||[]).reduce((s,i)=>s+i.cantidadEntregada,0),
    totalVendidas:          (m) => (m.items||[]).reduce((s,i)=>s+(i.ventas?.length??0),0),
    totalEfectivoPendiente: (m) => (m.items||[]).flatMap(i=>i.ventas||[]).filter(v=>v.estado?.codigo==='ENPR').reduce((s,v)=>s+Number(v.precioVenta),0),
  },
  MuestrarioItem: {
    cantidadVendida:    (i) => (i.ventas||[]).length,
    cantidadDisponible: (i) => i.cantidadEntregada - (i.ventas||[]).length - i.cantidadDevuelta,
  },

  Query: {
    muestrariosFiltradosCursor: async (_, { first=10, after=null, orden=[], direccion=[], busqueda='' }, { prisma, user }) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        where.OR = [{ vendedora: { nombre: { contains: busqueda.trim(), mode: 'insensitive' } } }];
      }
      const orderByClause = orden.length > 0 ? orden.map((c,i) => ({ [c]: direccion[i]||'asc' })) : [{ fechaSalida: 'desc' }];
      const items = await prisma.muestrario.findMany({ where, take: first, skip: after?1:0, cursor: after?{id:Number(after)}:undefined, orderBy: orderByClause, include: incMuestrario });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: { endCursor: last?String(last.id):null, hasNextPage: last?(await prisma.muestrario.count({ where: { ...where, id: { gt: last.id } } }))>0:false },
      };
    },
  },

  Mutation: {
    crearMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      return prisma.muestrario.create({
        data: { ...input, fechaSalida: new Date(input.fechaSalida), estado: 'ACTIVO', usu_creacion: user.codigo },
        include: incMuestrario,
      });
    },

    // Solo permite editar la nota
    actualizarMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, nota } = input;
      const original = await prisma.muestrario.findUnique({ where: { id: Number(id) } });
      if (!original) throw new Error('Muestrario no existe');
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.muestrario.updateMany({
        where: { id: Number(id), version: Number(version) },
        data:  { nota: nota ?? null, version: { increment: 1 }, usu_actualizacion: user.codigo },
      });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.muestrario.findUnique({ where: { id: Number(id) }, include: incMuestrario });
    },

    agregarItemMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const muestrario = await prisma.muestrario.findUnique({ where: { id: input.muestrarioId } });
      if (!muestrario) throw new Error('Muestrario no existe');
      validarEmpresa(muestrario.empresaId, user.empresaActualId);
      if (muestrario.estado !== 'ACTIVO') throw new Error('El muestrario ya está liquidado');
      const producto = await prisma.producto.findUnique({ where: { id: input.productoId } });
      if (producto.enStock < input.cantidadEntregada) throw new Error(`Stock insuficiente. Disponible: ${producto.enStock}`);
      const existe = await prisma.muestrarioItem.findFirst({ where: { muestrarioId: input.muestrarioId, productoId: input.productoId, deletedAt: null } });
      if (existe) throw new Error('Este producto ya está en el muestrario');
      return prisma.$transaction(async (tx) => {
        await tx.producto.update({ where: { id: input.productoId }, data: { enStock: { decrement: input.cantidadEntregada } } });
        return tx.muestrarioItem.create({ data: { ...input }, include: incItem });
      });
    },

    eliminarItemMuestrario: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const item = await prisma.muestrarioItem.findUnique({ where: { id: Number(id) }, include: { muestrario: true, ventas: { where: { deletedAt: null } } } });
      if (!item) throw new Error('No existe');
      validarEmpresa(item.muestrario.empresaId, user.empresaActualId);
      if (item.ventas.length > 0) throw new Error('Este item ya tiene ventas registradas');
      await prisma.$transaction(async (tx) => {
        await tx.producto.update({ where: { id: item.productoId }, data: { enStock: { increment: item.cantidadEntregada } } });
        await tx.muestrarioItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      });
      return true;
    },

    registrarVentaMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { muestrarioItemId, clienteId, precioVenta, medioPagoId, vendedoraId, empresaId } = input;
      const item = await prisma.muestrarioItem.findUnique({
        where: { id: muestrarioItemId },
        include: { muestrario: true, ventas: { where: { deletedAt: null, estado: { codigo: { not: 'ANUL' } } } } },
      });
      if (!item) throw new Error('Item no existe');
      validarEmpresa(item.muestrario.empresaId, user.empresaActualId);
      if (item.muestrario.estado !== 'ACTIVO') throw new Error('El muestrario ya está liquidado');
      const disponible = item.cantidadEntregada - item.ventas.length - item.cantidadDevuelta;
      if (disponible <= 0) throw new Error('No quedan unidades disponibles en el muestrario');

      const ue         = await prisma.usuarioEmpresa.findFirst({ where: { usuarioId: Number(vendedoraId), empresaId: Number(empresaId), deletedAt: null } });
      const medioPago  = await prisma.grupo.findUnique({ where: { id: Number(medioPagoId) } });
      const porcentaje = medioPago?.codigo === 'TARJ' ? Number(ue?.comisionTarjeta??0) : Number(ue?.comisionEfectivo??0);
      const valorComision = (Number(precioVenta) * porcentaje) / 100;

      const esTarjeta  = medioPago?.codigo === 'TARJ';
      const estadoCod  = esTarjeta ? 'CONF' : 'ENPR';
      const estadoGrupo = await prisma.grupo.findFirst({ where: { codigo: estadoCod, subcatalogo: { codigo: 'ESTV', catalogo: { codigo: 'VENT' } } } });
      if (!estadoGrupo) throw new Error('Estado de venta no encontrado en catálogo');

      return prisma.venta.create({
        data: {
          empresaId: Number(empresaId), clienteId: Number(clienteId),
          productoId: item.productoId, vendedoraId: Number(vendedoraId),
          muestrarioItemId, fecha: new Date(),
          precioVenta: Number(precioVenta), medioPagoId: Number(medioPagoId),
          porcentajeComision: porcentaje, valorComision, estadoId: estadoGrupo.id,
          usu_creacion: user.codigo,
        },
        include: { cliente: true, producto: true, vendedora: true, medioPago: true, estado: true, repartos: true },
      });
    },

    confirmarVentaEfectivo: async (_, { ventaId }, { prisma, user }) => {
      requireAuth(user);
      const venta = await prisma.venta.findUnique({ where: { id: Number(ventaId) }, include: { estado: true } });
      if (!venta) throw new Error('Venta no existe');
      validarEmpresa(venta.empresaId, user.empresaActualId);
      if (venta.estado?.codigo !== 'ENPR') throw new Error('Solo se pueden confirmar ventas EN PROCESO');
      const estadoConf = await prisma.grupo.findFirst({ where: { codigo: 'CONF', subcatalogo: { codigo: 'ESTV', catalogo: { codigo: 'VENT' } } } });
      await prisma.venta.update({ where: { id: Number(ventaId) }, data: { estadoId: estadoConf.id, usu_actualizacion: user.codigo, version: { increment: 1 } } });
      return prisma.venta.findUnique({ where: { id: Number(ventaId) }, include: { cliente: true, producto: true, vendedora: true, medioPago: true, estado: true, repartos: true } });
    },

    liquidarMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { muestrarioId, devoluciones, version } = input;
      const muestrario = await prisma.muestrario.findUnique({
        where: { id: muestrarioId },
        include: { items: { where: { deletedAt: null }, include: { ventas: { where: { deletedAt: null, estado: { codigo: { not: 'ANUL' } } } } } } },
      });
      if (!muestrario) throw new Error('Muestrario no existe');
      validarEmpresa(muestrario.empresaId, user.empresaActualId);
      if (muestrario.estado !== 'ACTIVO') throw new Error('Ya está liquidado');

      await prisma.$transaction(async (tx) => {
        for (const dev of devoluciones) {
          if (dev.cantidadDevuelta <= 0) continue;
          const item = muestrario.items.find(i => i.id === dev.itemId);
          if (!item) continue;
          const maxDev = item.cantidadEntregada - item.ventas.length;
          if (dev.cantidadDevuelta > maxDev) throw new Error(`Devuelve más de lo disponible en item ${dev.itemId}`);
          await tx.muestrarioItem.update({ where: { id: dev.itemId }, data: { cantidadDevuelta: dev.cantidadDevuelta, version: { increment: 1 } } });
          await tx.producto.update({ where: { id: item.productoId }, data: { enStock: { increment: dev.cantidadDevuelta } } });
        }
        const result = await tx.muestrario.updateMany({ where: { id: muestrarioId, version: Number(version) }, data: { estado: 'LIQUIDADO', fechaCierre: new Date(), version: { increment: 1 }, usu_actualizacion: user.codigo } });
        if (result.count === 0) throw new Error('Modificado por otro usuario');
      });
      return prisma.muestrario.findUnique({ where: { id: muestrarioId }, include: incMuestrario });
    },

    eliminarMuestrario: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const m = await prisma.muestrario.findUnique({ where: { id: Number(id) }, include: { items: { include: { ventas: { where: { deletedAt: null } } } } } });
      if (!m) throw new Error('No existe');
      validarEmpresa(m.empresaId, user.empresaActualId);
      if (m.items.some(i => i.ventas.length > 0)) throw new Error('Tiene ventas registradas — no se puede eliminar');
      await prisma.$transaction(async (tx) => {
        for (const item of m.items) {
          await tx.producto.update({ where: { id: item.productoId }, data: { enStock: { increment: item.cantidadEntregada } } });
        }
        await tx.muestrario.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), usu_actualizacion: user.codigo } });
      });
      return true;
    },
  },
};

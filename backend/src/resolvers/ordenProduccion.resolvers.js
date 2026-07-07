import { requireAuth }    from '../utils/authHelpers.js';
import { validarEmpresa } from '../utils/validations.js';

const incluirOrden = {
  producto: { include: { categoria: true } },
  joyero:   true,
  estado:   true,
  detalles: {
    where:   { deletedAt: null },
    include: {
      compraInsumo: { include: { piedra: { include: { tipo: true, unidad: true } } } },
      piedra:       { include: { tipo: true, unidad: true } },
    },
    orderBy: { id: 'asc' },
  },
  entregas: {
    where:   { deletedAt: null },
    orderBy: { fecha: 'asc' },
  },
};

// Genera el número de remisión automático: REM-{numeroOrden}-{consecutivo}
const generarNumeroRemision = async (prisma, ordenProduccionId, numeroOrden) => {
  const count = await prisma.entregaOrden.count({
    where: { ordenProduccionId, deletedAt: null },
  });
  const consecutivo = String(count + 1).padStart(2, '0');
  return `REM-${numeroOrden}-${consecutivo}`;
};

export default {
  DetalleOrdenProduccion: {
    merma: (d) => {
      const e = Number(d.cantidadEnviada), r = Number(d.cantidadDevuelta);
      return e > 0 ? Math.round((e - r) * 10000) / 10000 : 0;
    },
  },
  OrdenProduccion: {
    fechaEnvio:    (o) => o.fechaEnvio    ? new Date(o.fechaEnvio).toISOString()    : null,
    fechaEstimada: (o) => o.fechaEstimada ? new Date(o.fechaEstimada).toISOString() : null,
    fechaEntrega:  (o) => o.fechaEntrega  ? new Date(o.fechaEntrega).toISOString()  : null,
  },
  EntregaOrden: {
    fecha: (e) => e.fecha ? new Date(e.fecha).toISOString() : null,
  },

  Query: {
    ordenesFiltradosCursor: async (_, { first=10, after=null, orden=[], direccion=[], busqueda='' }, { prisma, user }) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { numero: { contains: t, mode: 'insensitive' } },
          { producto: { nombre: { contains: t, mode: 'insensitive' } } },
          { joyero:   { nombre: { contains: t, mode: 'insensitive' } } },
        ];
      }
      const orderByClause = orden.length > 0 ? orden.map((c,i) => ({ [c]: direccion[i]||'asc' })) : [{ fechaEnvio: 'desc' }];
      const items = await prisma.ordenProduccion.findMany({ where, take: first, skip: after?1:0, cursor: after?{id:Number(after)}:undefined, orderBy: orderByClause, include: incluirOrden });
      const last = items[items.length - 1];
      return { edges: items.map((item) => ({ node: item, cursor: String(item.id) })), pageInfo: { endCursor: last?String(last.id):null, hasNextPage: last?(await prisma.ordenProduccion.count({ where: { ...where, id: { gt: last.id } } }))>0:false } };
    },
  },

  Mutation: {
    crearOrdenProduccion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.ordenProduccion.findFirst({ where: { numero: input.numero, empresaId: user.empresaActualId, deletedAt: null } });
      if (existe) throw new Error(`El número ${input.numero} ya existe`);
      const producto = await prisma.producto.findUnique({ where: { id: Number(input.productoId) }, include: { piedras: true } });
      if (!producto) throw new Error('Producto no existe');
      const costoInsumos = producto.piedras.reduce((s, pp) => s + Number(pp.costoEstandardTotal), 0);
      const costoUnitarioEstandard = costoInsumos + Number(producto.costoManoObra) + Number(producto.costoOtros);
      const costoTotalEstandard    = costoUnitarioEstandard * Number(input.cantidadProgramada);
      return prisma.ordenProduccion.create({
        data: { ...input, fechaEnvio: new Date(input.fechaEnvio), fechaEstimada: input.fechaEstimada?new Date(input.fechaEstimada):null, costoUnitarioEstandard, costoTotalEstandard, cantidadEntregada: 0, valorEntregado: 0, usu_creacion: user.codigo },
        include: incluirOrden,
      });
    },

    actualizarOrdenProduccion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.ordenProduccion.findUnique({ where: { id: Number(id) } });
      if (!original) throw new Error('Orden no existe');
      validarEmpresa(original.empresaId, user.empresaActualId);
      const costoTotalEstandard = Number(original.costoUnitarioEstandard) * Number(data.cantidadProgramada);
      const result = await prisma.ordenProduccion.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: { ...data, fechaEnvio: new Date(data.fechaEnvio), fechaEstimada: data.fechaEstimada?new Date(data.fechaEstimada):null, fechaEntrega: data.fechaEntrega?new Date(data.fechaEntrega):null, costoTotalEstandard, version: { increment: 1 }, usu_actualizacion: user.codigo },
      });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.ordenProduccion.findUnique({ where: { id: Number(id) }, include: incluirOrden });
    },

    // ── REGISTRAR ENTREGA — genera remisión automática ────────────
    registrarEntregaOrden: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { ordenProduccionId, cantidad, cantidadJoyero, numeroJoyero, nota } = input;

      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: ordenProduccionId },
      });
      if (!orden) throw new Error('Orden no existe');
      validarEmpresa(orden.empresaId, user.empresaActualId);

      const pendientes = orden.cantidadProgramada - orden.cantidadEntregada;
      if (cantidad > pendientes)
        throw new Error(`Solo quedan ${pendientes} piezas pendientes de entrega`);

      // Determinar estado de conciliación inicial
      const hasDiferencia = cantidadJoyero !== null && cantidadJoyero !== undefined && cantidadJoyero !== cantidad;
      const estadoConciliacion = hasDiferencia ? 'DISPUTA' : 'PENDIENTE';

      const valorPorUnidad = Number(orden.costoUnitarioEstandard);
      const valorEntregado = cantidad * valorPorUnidad;
      const esFinal        = (orden.cantidadEntregada + cantidad) >= orden.cantidadProgramada;

      // Generar número de remisión automático
      const numeroRemision = await generarNumeroRemision(prisma, ordenProduccionId, orden.numero);

      await prisma.$transaction(async (tx) => {
        await tx.entregaOrden.create({
          data: {
            ordenProduccionId,
            numeroRemision,
            numeroJoyero:       numeroJoyero ?? null,
            cantidad,
            cantidadJoyero:     cantidadJoyero ?? null,
            valorEntregado,
            estadoConciliacion,
            nota:               nota ?? null,
            usu_creacion:       user.codigo,
          },
        });

        await tx.ordenProduccion.update({
          where: { id: ordenProduccionId },
          data: {
            cantidadEntregada: { increment: cantidad },
            valorEntregado:    { increment: valorEntregado },
            ...(esFinal && { fechaEntrega: new Date() }),
            version:           { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });

        await tx.producto.update({
          where: { id: orden.productoId },
          data:  { enStock: { increment: cantidad } },
        });
      });

      return prisma.ordenProduccion.findUnique({ where: { id: ordenProduccionId }, include: incluirOrden });
    },

    // ── CONCILIAR ENTREGA ────────────────────────────────────────
    conciliarEntrega: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, estadoConciliacion, notaConciliacion } = input;
      const entrega = await prisma.entregaOrden.findUnique({ where: { id: Number(id) }, include: { ordenProduccion: true } });
      if (!entrega) throw new Error('Entrega no existe');
      validarEmpresa(entrega.ordenProduccion.empresaId, user.empresaActualId);
      const result = await prisma.entregaOrden.updateMany({
        where: { id: Number(id), version: Number(version) },
        data:  { estadoConciliacion, notaConciliacion: notaConciliacion ?? null, version: { increment: 1 } },
      });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.entregaOrden.findUnique({ where: { id: Number(id) } });
    },

    eliminarOrdenProduccion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.ordenProduccion.findUnique({ where: { id: Number(id) }, include: { detalles: { where: { deletedAt: null } } } });
      if (!original) throw new Error('Orden no existe');
      validarEmpresa(original.empresaId, user.empresaActualId);
      if (original.cantidadEntregada > 0) throw new Error('No se puede eliminar una orden con entregas registradas');
      await prisma.$transaction(async (tx) => {
        for (const d of original.detalles) {
          await tx.compraInsumo.update({ where: { id: d.compraInsumoId }, data: { cantidadDisponible: { increment: Number(d.cantidadEnviada) } } });
        }
        await tx.ordenProduccion.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), usu_actualizacion: user.codigo } });
      });
      return true;
    },

    agregarDetalleOrden: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const orden = await prisma.ordenProduccion.findUnique({ where: { id: input.ordenProduccionId } });
      if (!orden) throw new Error('Orden no existe');
      validarEmpresa(orden.empresaId, user.empresaActualId);
      const compra = await prisma.compraInsumo.findUnique({ where: { id: input.compraInsumoId } });
      if (Number(compra.cantidadDisponible) < Number(input.cantidadEnviada)) throw new Error(`Stock insuficiente. Disponible: ${compra.cantidadDisponible}`);
      return prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({ where: { id: input.compraInsumoId }, data: { cantidadDisponible: { decrement: Number(input.cantidadEnviada) } } });
        return tx.detalleOrdenProduccion.create({ data: { ...input, desperdicio: input.desperdicio??0, cantidadDevuelta: 0, valorDevuelto: 0, usu_creacion: user.codigo }, include: { compraInsumo: { include: { piedra: { include: { tipo: true, unidad: true } } } }, piedra: { include: { tipo: true, unidad: true } } } });
      });
    },

    registrarDevolucion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, cantidadDevuelta, valorDevuelto, version } = input;
      const detalle = await prisma.detalleOrdenProduccion.findUnique({ where: { id: Number(id) }, include: { ordenProduccion: true } });
      if (!detalle) throw new Error('No existe');
      validarEmpresa(detalle.ordenProduccion.empresaId, user.empresaActualId);
      if (Number(cantidadDevuelta) > Number(detalle.cantidadEnviada)) throw new Error('No puede devolver más de lo enviado');
      const result = await prisma.detalleOrdenProduccion.updateMany({ where: { id: Number(id), version: Number(version) }, data: { cantidadDevuelta: Number(cantidadDevuelta), valorDevuelto: Number(valorDevuelto), version: { increment: 1 }, usu_actualizacion: user.codigo } });
      if (result.count === 0) throw new Error('Modificado por otro usuario');
      return prisma.detalleOrdenProduccion.findUnique({ where: { id: Number(id) }, include: { compraInsumo: { include: { piedra: { include: { tipo: true, unidad: true } } } }, piedra: { include: { tipo: true, unidad: true } } } });
    },

    eliminarDetalleOrden: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const detalle = await prisma.detalleOrdenProduccion.findUnique({ where: { id: Number(id) }, include: { ordenProduccion: true } });
      if (!detalle) throw new Error('No existe');
      validarEmpresa(detalle.ordenProduccion.empresaId, user.empresaActualId);
      await prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({ where: { id: detalle.compraInsumoId }, data: { cantidadDisponible: { increment: Number(detalle.cantidadEnviada) } } });
        await tx.detalleOrdenProduccion.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), usu_actualizacion: user.codigo } });
      });
      return true;
    },
  },
};

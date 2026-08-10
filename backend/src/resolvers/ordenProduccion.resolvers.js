import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

// ⚠️ producto.include DEBE traer también "piedras" (el BOM) — la query
// del frontend (ORDEN_FIELDS → PRODUCTO_BOM_FIELDS) pide orden.producto.piedras
// para calcular las sugerencias de insumos. Producto.piedras es un campo NO
// nullable en el schema GraphQL ([ProductoPiedra!]!); si Prisma no lo incluye
// aquí llega undefined y GraphQL truena con "Cannot return null for
// non-nullable field Producto.piedras." — este include debe reflejar el
// mismo shape que incBom.piedras en producto.resolvers.js.
const incluirOrden = {
  producto: {
    include: {
      categoria: true,
      piedras: {
        where: { deletedAt: null },
        include: {
          piedra: { include: { tipo: true, unidad: true } },
          tipoPiedra: true,
        },
        orderBy: [{ tipoId: "asc" }, { id: "asc" }],
      },
    },
  },
  joyero: true,
  estado: true,
  detalles: {
    where: { deletedAt: null },
    include: {
      compraInsumo: {
        include: { piedra: { include: { tipo: true, unidad: true } } },
      },
      piedra: { include: { tipo: true, unidad: true } },
      movimientos: { where: { deletedAt: null }, orderBy: { fecha: "asc" } },
    },
    orderBy: { id: "asc" },
  },
  entregas: {
    where: { deletedAt: null },
    orderBy: { fecha: "asc" },
  },
};

const incluirDetalle = {
  compraInsumo: {
    include: { piedra: { include: { tipo: true, unidad: true } } },
  },
  piedra: { include: { tipo: true, unidad: true } },
  movimientos: { where: { deletedAt: null }, orderBy: { fecha: "asc" } },
};

// Genera el número de remisión automático: REM-{numeroOrden}-{consecutivo}
const generarNumeroRemision = async (
  prisma,
  ordenProduccionId,
  numeroOrden,
) => {
  const count = await prisma.entregaOrden.count({
    where: { ordenProduccionId, deletedAt: null },
  });
  const consecutivo = String(count + 1).padStart(2, "0");
  return `REM-${numeroOrden}-${consecutivo}`;
};

// ── Conciliación teórica de insumos (solo lectura) ─────────────────
// Ver Manual de Operación v5 §6.6. Compara lo enviado (neto de
// devoluciones) contra lo que "debería" consumirse según la línea del
// BOM del producto (cantidad por unidad + % desperdicio) multiplicada
// por las piezas realmente entregadas hasta ahora. No mueve inventario
// ni bloquea nada — es un cálculo de apoyo para detectar desperdicio
// mayor al esperado o material del joyero pendiente de devolver.
//
// Nota de rendimiento: esto hace una consulta por línea de detalle
// (para traer cantidadEntregada de la orden y el BOM del producto),
// igual que calcCosteoAsync en producto.resolvers.js hace una consulta
// por línea de oro — aceptable porque una orden normalmente tiene pocas
// líneas de insumo. Se cachea en el propio objeto (d.__conciliacion)
// para no repetir la consulta entre los 3 campos que la usan.
const calcConciliacionAsync = async (d, prisma) => {
  if (d.__conciliacion) return d.__conciliacion;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: d.ordenProduccionId },
    select: {
      cantidadEntregada: true,
      producto: {
        select: {
          piedras: {
            where: { deletedAt: null },
            select: { piedraId: true, cantidad: true, desperdicio: true },
          },
        },
      },
    },
  });

  const bomLine = orden?.producto?.piedras.find(
    (pp) => pp.piedraId === d.piedraId,
  );
  const cantidadEntregada = Number(orden?.cantidadEntregada ?? 0);

  let consumoTeorico = null;
  if (bomLine) {
    const base = Number(bomLine.cantidad) * cantidadEntregada;
    consumoTeorico = base + base * (Number(bomLine.desperdicio ?? 0) / 100);
  }

  const enviadoNeto =
    Number(d.cantidadEnviada ?? 0) - Number(d.cantidadDevuelta ?? 0);
  const diferenciaVsTeorico =
    consumoTeorico != null ? enviadoNeto - consumoTeorico : null;

  d.__conciliacion = { consumoTeorico, enviadoNeto, diferenciaVsTeorico };
  return d.__conciliacion;
};

export default {
  DetalleOrdenProduccion: {
    merma: (d) => {
      const e = Number(d.cantidadEnviada),
        r = Number(d.cantidadDevuelta);
      return e > 0 ? Math.round((e - r) * 10000) / 10000 : 0;
    },
    consumoTeorico: async (d, _, { prisma }) =>
      (await calcConciliacionAsync(d, prisma)).consumoTeorico,
    enviadoNeto: async (d, _, { prisma }) =>
      (await calcConciliacionAsync(d, prisma)).enviadoNeto,
    diferenciaVsTeorico: async (d, _, { prisma }) =>
      (await calcConciliacionAsync(d, prisma)).diferenciaVsTeorico,
  },
  MovimientoInsumoOrden: {
    fecha: (m) => (m.fecha ? new Date(m.fecha).toISOString() : null),
  },
  OrdenProduccion: {
    fechaEnvio: (o) =>
      o.fechaEnvio ? new Date(o.fechaEnvio).toISOString() : null,
    fechaEstimada: (o) =>
      o.fechaEstimada ? new Date(o.fechaEstimada).toISOString() : null,
    fechaEntrega: (o) =>
      o.fechaEntrega ? new Date(o.fechaEntrega).toISOString() : null,
  },
  EntregaOrden: {
    fecha: (e) => (e.fecha ? new Date(e.fecha).toISOString() : null),
  },

  Query: {
    ordenesFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { numero: { contains: t, mode: "insensitive" } },
          { producto: { nombre: { contains: t, mode: "insensitive" } } },
          { joyero: { nombre: { contains: t, mode: "insensitive" } } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fechaEnvio: "desc" }];
      const items = await prisma.ordenProduccion.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incluirOrden,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.ordenProduccion.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    // ── NUEVO — histórico de costo por producto (solo lectura) ─────
    // Ver Manual de Operación v5 §6.x. A propósito NO usa `incluirOrden`
    // (sería traer BOM + detalles + entregas de hasta 50 órdenes solo
    // para mostrar una tabla de 4 columnas) — el query del frontend solo
    // pide campos escalares de OrdenProduccion, así que no hace falta.
    // Si en el futuro se agrega aquí un campo que dependa de una relación
    // (producto, detalles, entregas), hay que agregar el include
    // correspondiente o va a fallar igual que Producto.piedras falló antes.
    historicoCostoOrdenes: async (
      _,
      { productoId, limit = 10 },
      { prisma, user },
    ) => {
      requireAuth(user);
      const producto = await prisma.producto.findUnique({
        where: { id: Number(productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      validarEmpresa(producto.empresaId, user.empresaActualId);
      return prisma.ordenProduccion.findMany({
        where: {
          productoId: Number(productoId),
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
        orderBy: { fechaEnvio: "desc" },
        take: Math.min(Number(limit) || 10, 50),
      });
    },
  },

  Mutation: {
    crearOrdenProduccion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.ordenProduccion.findFirst({
        where: {
          numero: input.numero,
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error(`El número ${input.numero} ya existe`);
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
        include: { piedras: true },
      });
      if (!producto) throw new Error("Producto no existe");
      const costoInsumos = producto.piedras.reduce(
        (s, pp) => s + Number(pp.costoEstandardTotal),
        0,
      );
      const costoUnitarioEstandard =
        costoInsumos +
        Number(producto.costoManoObra) +
        Number(producto.costoOtros);
      const costoTotalEstandard =
        costoUnitarioEstandard * Number(input.cantidadProgramada);
      return prisma.ordenProduccion.create({
        data: {
          ...input,
          fechaEnvio: new Date(input.fechaEnvio),
          fechaEstimada: input.fechaEstimada
            ? new Date(input.fechaEstimada)
            : null,
          costoUnitarioEstandard,
          costoTotalEstandard,
          cantidadEntregada: 0,
          valorEntregado: 0,
          usu_creacion: user.codigo,
        },
        include: incluirOrden,
      });
    },

    actualizarOrdenProduccion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Orden no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const costoTotalEstandard =
        Number(original.costoUnitarioEstandard) *
        Number(data.cantidadProgramada);
      const result = await prisma.ordenProduccion.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          fechaEnvio: new Date(data.fechaEnvio),
          fechaEstimada: data.fechaEstimada
            ? new Date(data.fechaEstimada)
            : null,
          fechaEntrega: data.fechaEntrega ? new Date(data.fechaEntrega) : null,
          costoTotalEstandard,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: incluirOrden,
      });
    },

    // ── REGISTRAR ENTREGA — genera remisión automática ────────────
    registrarEntregaOrden: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const {
        ordenProduccionId,
        cantidad,
        cantidadJoyero,
        numeroJoyero,
        nota,
      } = input;

      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: ordenProduccionId },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);

      const pendientes = orden.cantidadProgramada - orden.cantidadEntregada;
      if (cantidad > pendientes)
        throw new Error(
          `Solo quedan ${pendientes} piezas pendientes de entrega`,
        );

      // Determinar estado de conciliación inicial
      const hasDiferencia =
        cantidadJoyero !== null &&
        cantidadJoyero !== undefined &&
        cantidadJoyero !== cantidad;
      const estadoConciliacion = hasDiferencia ? "DISPUTA" : "PENDIENTE";

      const valorPorUnidad = Number(orden.costoUnitarioEstandard);
      const valorEntregado = cantidad * valorPorUnidad;
      const esFinal =
        orden.cantidadEntregada + cantidad >= orden.cantidadProgramada;

      // Generar número de remisión automático
      const numeroRemision = await generarNumeroRemision(
        prisma,
        ordenProduccionId,
        orden.numero,
      );

      await prisma.$transaction(async (tx) => {
        await tx.entregaOrden.create({
          data: {
            ordenProduccionId,
            numeroRemision,
            numeroJoyero: numeroJoyero ?? null,
            cantidad,
            cantidadJoyero: cantidadJoyero ?? null,
            valorEntregado,
            estadoConciliacion,
            nota: nota ?? null,
            usu_creacion: user.codigo,
          },
        });

        await tx.ordenProduccion.update({
          where: { id: ordenProduccionId },
          data: {
            cantidadEntregada: { increment: cantidad },
            valorEntregado: { increment: valorEntregado },
            ...(esFinal && { fechaEntrega: new Date() }),
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });

        await tx.producto.update({
          where: { id: orden.productoId },
          data: { enStock: { increment: cantidad } },
        });
      });

      return prisma.ordenProduccion.findUnique({
        where: { id: ordenProduccionId },
        include: incluirOrden,
      });
    },

    // ── CONCILIAR ENTREGA ────────────────────────────────────────
    conciliarEntrega: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, estadoConciliacion, notaConciliacion } = input;
      const entrega = await prisma.entregaOrden.findUnique({
        where: { id: Number(id) },
        include: { ordenProduccion: true },
      });
      if (!entrega) throw new Error("Entrega no existe");
      validarEmpresa(entrega.ordenProduccion.empresaId, user.empresaActualId);
      const result = await prisma.entregaOrden.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          estadoConciliacion,
          notaConciliacion: notaConciliacion ?? null,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.entregaOrden.findUnique({ where: { id: Number(id) } });
    },

    eliminarOrdenProduccion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: {
          detalles: {
            where: { deletedAt: null },
            include: { movimientos: { where: { deletedAt: null } } },
          },
        },
      });
      if (!original) throw new Error("Orden no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      if (original.cantidadEntregada > 0)
        throw new Error(
          "No se puede eliminar una orden con entregas registradas",
        );
      await prisma.$transaction(async (tx) => {
        // Revierte cada movimiento (envíos devuelven stock, devoluciones lo restan)
        // en vez de asumir un solo lote por línea — un detalle puede tener envíos
        // adicionales desde lotes distintos al inicial.
        for (const d of original.detalles) {
          for (const m of d.movimientos) {
            const ajuste =
              m.tipoMovimiento === "DEVOLUCION"
                ? -Number(m.cantidad)
                : Number(m.cantidad);
            await tx.compraInsumo.update({
              where: { id: m.compraInsumoId },
              data: { cantidadDisponible: { increment: ajuste } },
            });
          }
        }
        await tx.ordenProduccion.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },

    // ── AGREGAR DETALLE — crea la línea + su movimiento INICIAL ───
    agregarDetalleOrden: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: input.ordenProduccionId },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);
      const compra = await prisma.compraInsumo.findUnique({
        where: { id: input.compraInsumoId },
      });
      if (!compra) throw new Error("El lote de compra no existe");
      if (Number(compra.cantidadDisponible) < Number(input.cantidadEnviada))
        throw new Error(
          `Stock insuficiente. Disponible: ${compra.cantidadDisponible}`,
        );

      return prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({
          where: { id: input.compraInsumoId },
          data: {
            cantidadDisponible: { decrement: Number(input.cantidadEnviada) },
          },
        });

        const detalle = await tx.detalleOrdenProduccion.create({
          data: {
            ...input,
            desperdicio: input.desperdicio ?? 0,
            cantidadDevuelta: 0,
            valorDevuelto: 0,
            usu_creacion: user.codigo,
          },
        });

        await tx.movimientoInsumoOrden.create({
          data: {
            detalleOrdenProduccionId: detalle.id,
            compraInsumoId: input.compraInsumoId,
            tipoMovimiento: "INICIAL",
            cantidad: Number(input.cantidadEnviada),
            valor: Number(input.valorEnviado),
            usu_creacion: user.codigo,
          },
        });

        return tx.detalleOrdenProduccion.findUnique({
          where: { id: detalle.id },
          include: incluirDetalle,
        });
      });
    },

    // ── NUEVO — reemplaza a registrarDevolucion ────────────────────
    // Un solo mutation para envío adicional (al joyero le faltó
    // insumo) y para devolución (sobrante que regresa). Ambos quedan
    // como filas de MovimientoInsumoOrden; los acumulados de la
    // línea (cantidadEnviada/valorEnviado/cantidadDevuelta/valorDevuelto)
    // se actualizan con increment, nunca se sobrescriben a mano.
    registrarMovimientoInsumo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const {
        detalleOrdenProduccionId,
        compraInsumoId,
        tipoMovimiento,
        cantidad,
        nota,
      } = input;

      if (!["ADICIONAL", "DEVOLUCION"].includes(tipoMovimiento))
        throw new Error("tipoMovimiento debe ser 'ADICIONAL' o 'DEVOLUCION'");
      if (!nota?.trim())
        throw new Error(
          "La nota es obligatoria para registrar este movimiento",
        );
      if (!cantidad || Number(cantidad) <= 0)
        throw new Error("La cantidad debe ser mayor a cero");

      const detalle = await prisma.detalleOrdenProduccion.findUnique({
        where: { id: Number(detalleOrdenProduccionId) },
        include: { ordenProduccion: true },
      });
      if (!detalle) throw new Error("El detalle no existe");
      validarEmpresa(detalle.ordenProduccion.empresaId, user.empresaActualId);

      const compra = await prisma.compraInsumo.findUnique({
        where: { id: Number(compraInsumoId) },
      });
      if (!compra) throw new Error("El lote de compra no existe");

      if (tipoMovimiento === "ADICIONAL") {
        if (Number(compra.cantidadDisponible) < Number(cantidad))
          throw new Error(
            `Stock insuficiente en ese lote. Disponible: ${compra.cantidadDisponible}`,
          );

        const valor = Number(cantidad) * Number(compra.costoUnitario);

        return prisma.$transaction(async (tx) => {
          await tx.compraInsumo.update({
            where: { id: compra.id },
            data: { cantidadDisponible: { decrement: Number(cantidad) } },
          });
          await tx.movimientoInsumoOrden.create({
            data: {
              detalleOrdenProduccionId: detalle.id,
              compraInsumoId: compra.id,
              tipoMovimiento: "ADICIONAL",
              cantidad: Number(cantidad),
              valor,
              nota,
              usu_creacion: user.codigo,
            },
          });
          await tx.detalleOrdenProduccion.update({
            where: { id: detalle.id },
            data: {
              cantidadEnviada: { increment: Number(cantidad) },
              valorEnviado: { increment: valor },
              usu_actualizacion: user.codigo,
            },
          });
          return tx.detalleOrdenProduccion.findUnique({
            where: { id: detalle.id },
            include: incluirDetalle,
          });
        });
      }

      // DEVOLUCION
      const disponibleParaDevolver =
        Number(detalle.cantidadEnviada) - Number(detalle.cantidadDevuelta);
      if (Number(cantidad) > disponibleParaDevolver)
        throw new Error(
          `No puede devolver más de lo enviado. Disponible para devolver: ${disponibleParaDevolver}`,
        );

      const valor = Number(cantidad) * Number(detalle.costoUnitario);

      return prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({
          where: { id: compra.id },
          data: { cantidadDisponible: { increment: Number(cantidad) } },
        });
        await tx.movimientoInsumoOrden.create({
          data: {
            detalleOrdenProduccionId: detalle.id,
            compraInsumoId: compra.id,
            tipoMovimiento: "DEVOLUCION",
            cantidad: Number(cantidad),
            valor,
            nota,
            usu_creacion: user.codigo,
          },
        });
        await tx.detalleOrdenProduccion.update({
          where: { id: detalle.id },
          data: {
            cantidadDevuelta: { increment: Number(cantidad) },
            valorDevuelto: { increment: valor },
            usu_actualizacion: user.codigo,
          },
        });
        return tx.detalleOrdenProduccion.findUnique({
          where: { id: detalle.id },
          include: incluirDetalle,
        });
      });
    },

    eliminarDetalleOrden: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const detalle = await prisma.detalleOrdenProduccion.findUnique({
        where: { id: Number(id) },
        include: {
          ordenProduccion: true,
          movimientos: { where: { deletedAt: null } },
        },
      });
      if (!detalle) throw new Error("No existe");
      validarEmpresa(detalle.ordenProduccion.empresaId, user.empresaActualId);
      await prisma.$transaction(async (tx) => {
        for (const m of detalle.movimientos) {
          const ajuste =
            m.tipoMovimiento === "DEVOLUCION"
              ? -Number(m.cantidad)
              : Number(m.cantidad);
          await tx.compraInsumo.update({
            where: { id: m.compraInsumoId },
            data: { cantidadDisponible: { increment: ajuste } },
          });
          await tx.movimientoInsumoOrden.update({
            where: { id: m.id },
            data: { deletedAt: new Date() },
          });
        }
        await tx.detalleOrdenProduccion.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },
  },
};

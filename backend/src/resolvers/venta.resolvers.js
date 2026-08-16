import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const incItem = {
  producto: { include: { categoria: true } },
  cotizacionItem: { include: { cotizacion: true } },
};

const incVenta = {
  cliente: true,
  vendedora: true,
  canal: true,
  medioPago: true,
  estado: true,
  repartos: { where: { deletedAt: null }, include: { socio: true } },
  items: {
    where: { deletedAt: null },
    include: incItem,
    orderBy: { id: "asc" },
  },
};

const getComision = async (prisma, vendedoraId, medioPagoId, empresaId) => {
  if (!vendedoraId) return { porcentaje: 0 };
  const ue = await prisma.usuarioEmpresa.findFirst({
    where: {
      usuarioId: Number(vendedoraId),
      empresaId: Number(empresaId),
      deletedAt: null,
    },
  });
  if (!ue) return { porcentaje: 0 };
  const medioPago = await prisma.grupo.findUnique({
    where: { id: Number(medioPagoId) },
  });
  const porcentaje =
    medioPago?.codigo === "TARJ"
      ? Number(ue.comisionTarjeta)
      : Number(ue.comisionEfectivo);
  return { porcentaje };
};

// ── NUEVO — estado inicial de una venta según medio de pago, igual al
// criterio que ya usaban registrarVentaMuestrario y convertirEnVenta.
// Se centraliza aquí para que las 3 formas de venta se comporten igual.
const obtenerEstadoInicialVenta = async (prisma, medioPagoId) => {
  const medioPago = await prisma.grupo.findUnique({
    where: { id: Number(medioPagoId) },
  });
  const estadoCod = medioPago?.codigo === "TARJ" ? "CONF" : "ENPR";
  const estado = await prisma.grupo.findFirst({
    where: {
      codigo: estadoCod,
      subcatalogo: { codigo: "ESTV", catalogo: { codigo: "VENT" } },
    },
  });
  if (!estado) throw new Error("Estado de venta no encontrado en catálogo");
  return estado;
};

// ── NUEVO (ronda 34) — mismo patrón que generarNumeroMuestrario /
// generarNumeroOrden. Como convertirEnVenta puede crear varias ventas en
// un solo `for` secuencial dentro de una transacción, cada llamada ya ve
// las ventas creadas por la iteración anterior (el count corre sobre
// `tx`), así que no hay riesgo de números repetidos dentro de esa misma
// conversión.
const generarNumeroVenta = async (prisma, empresaId) => {
  const anio = new Date().getFullYear();
  const prefijo = `VTA-${anio}-`;
  const count = await prisma.venta.count({
    where: { empresaId, numero: { startsWith: prefijo } },
  });
  const consecutivo = String(count + 1).padStart(4, "0");
  return `${prefijo}${consecutivo}`;
};

// ── NUEVO (ronda 34) — mismo criterio que ya existía, solo que ahora es
// por LÍNEA (antes era por venta, porque cada venta era 1 solo producto).
const origenDeLinea = (d) => {
  if (d.cotizacionItem?.cotizacion?.numero)
    return `📋 ${d.cotizacionItem.cotizacion.numero}`;
  if (d.muestrarioItemId) return "🧳 Muestrario";
  return "🛍️ Directa";
};

export default {
  Venta: {
    totalItems: (v) => (v.items || []).length,
    valorTotal: (v) =>
      (v.items || []).reduce((s, i) => s + Number(i.subtotal), 0),
    valorComision: (v) => {
      const total = (v.items || []).reduce((s, i) => s + Number(i.subtotal), 0);
      return (total * Number(v.porcentajeComision)) / 100;
    },
    // ── Etiqueta de origen a nivel de venta — con 1 sola línea (el único
    // caso posible hoy para muestrario/cotización, ver "Fase 1" de la
    // conversación) se ve el origen real de esa línea; con varias líneas
    // solo puede ser una venta directa (agregarItemVenta nunca asigna
    // muestrarioItemId/cotizacionItemId), así que "Directa" es correcto.
    origenLabel: (v) => {
      const items = v.items || [];
      if (items.length === 1) return origenDeLinea(items[0]);
      return "🛍️ Directa";
    },
  },
  VentaDetalle: {
    origenLabel: (d) => origenDeLinea(d),
  },

  Query: {
    ventasFiltradosCursor: async (
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
          { cliente: { nombre: { contains: t, mode: "insensitive" } } },
          {
            items: {
              some: {
                deletedAt: null,
                producto: { nombre: { contains: t, mode: "insensitive" } },
              },
            },
          },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fecha: "desc" }];
      const items = await prisma.venta.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incVenta,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.venta.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    obtenerSocios: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.tercero.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          activo: true,
          tipo: { codigo: "SOCIO" },
        },
        orderBy: { nombre: "asc" },
      });
    },
  },

  Mutation: {
    // ── CAMBIO (ronda 34) — crearVenta ahora solo crea la CABEZA (sin
    // producto/cantidad/stock todavía) — los productos se agregan
    // después con agregarItemVenta, igual que crearCompra + agregarItemCompra.
    crearVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const numero = await generarNumeroVenta(prisma, user.empresaActualId);
      const { porcentaje } = await getComision(
        prisma,
        input.vendedoraId,
        input.medioPagoId,
        input.empresaId,
      );
      const estado = await obtenerEstadoInicialVenta(prisma, input.medioPagoId);
      return prisma.venta.create({
        data: {
          ...input,
          numero,
          fecha: new Date(input.fecha),
          porcentajeComision: porcentaje,
          estadoId: estado.id,
          usu_creacion: user.codigo,
        },
        include: incVenta,
      });
    },

    actualizarVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.venta.findUnique({
        where: { id: Number(id) },
        include: { estado: true },
      });
      if (!original) throw new Error("Venta no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      if (original.estado?.codigo === "ANUL")
        throw new Error("Esta venta está anulada y no se puede modificar");

      // ── Si cambia vendedora o medio de pago, la comisión % se
      // recalcula — mismo criterio que antes.
      const { porcentaje } = await getComision(
        prisma,
        data.vendedoraId,
        data.medioPagoId,
        original.empresaId,
      );

      const result = await prisma.venta.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          fecha: new Date(data.fecha),
          porcentajeComision: porcentaje,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.venta.findUnique({
        where: { id: Number(id) },
        include: incVenta,
      });
    },

    eliminarVenta: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.venta.findUnique({
        where: { id: Number(id) },
        include: { items: { where: { deletedAt: null } } },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.$transaction(async (tx) => {
        // ── CAMBIO (ronda 34) — antes restauraba el stock de UN producto;
        // ahora recorre todas las líneas de la venta, igual que eliminarCompra.
        for (const it of original.items) {
          await tx.producto.update({
            where: { id: it.productoId },
            data: { enStock: { increment: it.cantidad } },
          });
          await tx.ventaDetalle.update({
            where: { id: it.id },
            data: { deletedAt: new Date() },
          });
        }
        await tx.venta.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },

    // ── NUEVO — acción dedicada para anular una venta. Requiere motivo y
    // restaura enStock automáticamente, igual que cancelarOrdenProduccion.
    // A diferencia de eliminarVenta (borrado lógico completo), anularVenta
    // deja la venta visible en el historial con su estado en ANUL.
    anularVenta: async (_, { id, version, motivo }, { prisma, user }) => {
      requireAuth(user);
      if (!motivo?.trim())
        throw new Error("El motivo de anulación es obligatorio");
      const venta = await prisma.venta.findUnique({
        where: { id: Number(id) },
        include: { estado: true, items: { where: { deletedAt: null } } },
      });
      if (!venta) throw new Error("Venta no existe");
      validarEmpresa(venta.empresaId, user.empresaActualId);
      if (venta.estado?.codigo === "ANUL")
        throw new Error("Esta venta ya está anulada");

      const estadoAnul = await prisma.grupo.findFirst({
        where: {
          codigo: "ANUL",
          subcatalogo: { codigo: "ESTV", catalogo: { codigo: "VENT" } },
        },
      });
      if (!estadoAnul) throw new Error("Estado ANUL no encontrado en catálogo");

      await prisma.$transaction(async (tx) => {
        // ── CAMBIO (ronda 34) — restaura el stock de CADA línea, no solo
        // de un producto.
        for (const it of venta.items) {
          await tx.producto.update({
            where: { id: it.productoId },
            data: { enStock: { increment: it.cantidad } },
          });
        }
        const result = await tx.venta.updateMany({
          where: { id: venta.id, version: Number(version) },
          data: {
            estadoId: estadoAnul.id,
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });
        if (result.count === 0) throw new Error("Modificado por otro usuario");
        // Limpiar repartos de utilidad — ya no aplica repartir una venta anulada.
        await tx.repartoUtilidad.updateMany({
          where: { ventaId: venta.id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      });

      return prisma.venta.findUnique({
        where: { id: venta.id },
        include: incVenta,
      });
    },

    // ── NUEVO (ronda 34) — agregar un producto a una venta ya creada,
    // mismo patrón que agregarItemCompra. Valida y descuenta stock igual
    // que antes hacía crearVenta.
    agregarItemVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const venta = await prisma.venta.findUnique({
        where: { id: Number(input.ventaId) },
        include: { estado: true },
      });
      if (!venta) throw new Error("Venta no existe");
      validarEmpresa(venta.empresaId, user.empresaActualId);
      if (venta.estado?.codigo === "ANUL")
        throw new Error(
          "Esta venta está anulada — no se le pueden agregar productos",
        );
      const cantidad = Number(input.cantidad);
      if (cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      if (producto.enStock < cantidad)
        throw new Error(
          `Sin stock suficiente para ${producto.nombre}. Disponible: ${producto.enStock}`,
        );
      const subtotal = cantidad * Number(input.precioVenta);
      return prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: Number(input.productoId) },
          data: { enStock: { decrement: cantidad } },
        });
        return tx.ventaDetalle.create({
          data: {
            ventaId: Number(input.ventaId),
            productoId: Number(input.productoId),
            cantidad,
            precioVenta: Number(input.precioVenta),
            subtotal,
            usu_creacion: user.codigo,
          },
          include: incItem,
        });
      });
    },

    actualizarItemVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, cantidad, precioVenta } = input;
      const original = await prisma.ventaDetalle.findUnique({
        where: { id: Number(id) },
        include: { venta: { include: { estado: true } } },
      });
      if (!original) throw new Error("Línea de venta no existe");
      validarEmpresa(original.venta.empresaId, user.empresaActualId);
      if (original.venta.estado?.codigo === "ANUL")
        throw new Error("Esta venta está anulada y no se puede modificar");
      const nuevaCantidad = Number(cantidad);
      if (nuevaCantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
      const subtotal = nuevaCantidad * Number(precioVenta);
      const delta = nuevaCantidad - Number(original.cantidad);

      return prisma.$transaction(async (tx) => {
        if (delta !== 0) {
          const producto = await tx.producto.findUnique({
            where: { id: original.productoId },
          });
          if (delta > 0 && (!producto || producto.enStock < delta))
            throw new Error(
              `Sin stock suficiente para aumentar la cantidad. Disponible: ${producto?.enStock ?? 0}`,
            );
          await tx.producto.update({
            where: { id: original.productoId },
            data: { enStock: { decrement: delta } },
          });
        }
        const result = await tx.ventaDetalle.updateMany({
          where: { id: Number(id), version: Number(version) },
          data: {
            cantidad: nuevaCantidad,
            precioVenta: Number(precioVenta),
            subtotal,
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });
        if (result.count === 0) throw new Error("Modificado por otro usuario");
        return tx.ventaDetalle.findUnique({
          where: { id: Number(id) },
          include: incItem,
        });
      });
    },

    eliminarItemVenta: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.ventaDetalle.findUnique({
        where: { id: Number(id) },
        include: { venta: true },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.venta.empresaId, user.empresaActualId);
      // ── NUEVO (ronda 34) — una línea que vino de vender un ítem de
      // muestrario o de convertir una cotización no se debe quitar desde
      // aquí (dejaría esos flujos desincronizados) — se anula la venta
      // completa en su lugar si hace falta revertirla.
      if (original.muestrarioItemId || original.cotizacionItemId)
        throw new Error(
          "Esta línea viene de un muestrario o una cotización — para revertirla, anule la venta completa.",
        );
      await prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: original.productoId },
          data: { enStock: { increment: original.cantidad } },
        });
        await tx.ventaDetalle.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },

    guardarReparto: async (_, { ventaId, repartos }, { prisma, user }) => {
      requireAuth(user);
      const venta = await prisma.venta.findUnique({
        where: { id: ventaId },
        include: { items: { where: { deletedAt: null } } },
      });
      if (!venta) throw new Error("Venta no existe");
      validarEmpresa(venta.empresaId, user.empresaActualId);
      const totalPct = repartos.reduce((s, r) => s + Number(r.porcentaje), 0);
      if (Math.round(totalPct) !== 100)
        throw new Error(
          `Los porcentajes deben sumar 100% (actual: ${totalPct}%)`,
        );
      // ── CAMBIO (ronda 34) — totalVenta ahora es la suma de TODAS las
      // líneas de la venta, no solo un producto.
      const totalVenta = venta.items.reduce(
        (s, i) => s + Number(i.subtotal),
        0,
      );
      return prisma.$transaction(async (tx) => {
        await tx.repartoUtilidad.updateMany({
          where: { ventaId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return Promise.all(
          repartos.map((r) =>
            tx.repartoUtilidad.create({
              data: {
                ventaId,
                socioId: r.socioId,
                porcentaje: Number(r.porcentaje),
                valor: (totalVenta * Number(r.porcentaje)) / 100,
              },
              include: { socio: true },
            }),
          ),
        );
      });
    },
  },
};

import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";
import { calcularIvaDesglose } from "../utils/ivaHelpers.js";
import {
  calcularCostoProducto,
  incCosteoProducto,
} from "../utils/costeoHelpers.js";

const incItem = {
  producto: { include: { categoria: true } },
  cotizacionItem: { include: { cotizacion: true } },
};

// ── NUEVO (ronda 42, extraído en este fix) — misma fórmula de utilidad
// en UN solo lugar, para que el número que se MUESTRA (Venta.utilidadReparto,
// usado en el panel) y el número que se GUARDA por socia (guardarReparto)
// nunca queden desincronizados.
const calcularUtilidadReparto = (items, porcentajeComision) => {
  const margenLineas = (items || []).reduce(
    (s, i) =>
      s +
      (Number(i.baseGravable) - Number(i.costoUnitario)) * Number(i.cantidad),
    0,
  );
  const subtotalConIva = (items || []).reduce(
    (s, i) => s + Number(i.subtotal),
    0,
  );
  const comision = (subtotalConIva * Number(porcentajeComision)) / 100;
  return margenLineas - comision;
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

// ── CAMBIO (este fix, confirmado por el usuario) — antes una venta con
// medio de pago Tarjeta nacía directo en "Confirmada" (CONF), asumiendo
// que el pago con tarjeta se verifica al instante en el datáfono. El
// problema: el carrito (las líneas de la venta) SIEMPRE se arma primero
// y el pago va DESPUÉS, sin importar el medio — nunca se cobra antes de
// saber qué se está vendiendo. Como agregarItemVenta solo permite
// agregar líneas mientras la venta está en ENPR, una venta con Tarjeta
// nacía ya "confirmada" pero sin ninguna forma de agregarle productos:
// quedaba huérfana desde el momento en que se creaba (caso real
// reportado: VTA-2026-0006). Ahora TODA venta nace en ENPR, sin importar
// el medio de pago — se arma el carrito, y solo al final se confirma el
// pago con el mismo botón ("Confirmar pago"), que ya existía para
// efectivo/transferencia y ahora también cubre tarjeta.
const obtenerEstadoInicialVenta = async (prisma, medioPagoId) => {
  const estado = await prisma.grupo.findFirst({
    where: {
      codigo: "ENPR",
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
    // ── NUEVO (ronda 42) — "deber ser" acordado: la utilidad que se
    // reparte entre las socias debe ser sobre el MARGEN real, no sobre
    // el valor bruto de la venta. Por cada línea: (precio sin IVA −
    // costo de producir esa pieza, ambos ya congelados) × cantidad. La
    // comisión de la vendedora se sigue calculando y restando igual que
    // antes (sobre el valor CON IVA — eso no cambió, solo se corrigió la
    // base de la utilidad para las socias).
    utilidadReparto: (v) =>
      calcularUtilidadReparto(v.items || [], v.porcentajeComision),
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
    // ── NUEVO (ronda 42) — margen de ESTA línea (precio sin IVA − costo
    // de producir la pieza, ambos ya congelados) × cantidad. Informativo
    // — es lo que suma `Venta.utilidadReparto` antes de restar comisión.
    margen: (d) =>
      (Number(d.baseGravable) - Number(d.costoUnitario)) * Number(d.cantidad),
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
        include: { estado: true, items: { where: { deletedAt: null } } },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      // ── NUEVO (ronda 40) — una vez la venta tiene pago confirmado o ya
      // fue entregada, borrarla de un tajo (sin dejar rastro, sin motivo)
      // es demasiado peligroso — se usa anularVenta en su lugar (exige
      // motivo, deja historial visible). Solo se puede eliminar así una
      // venta que sigue "En proceso" (un borrador sin cerrar) o una que
      // ya está Anulada (limpieza de un registro que no debe seguir ahí).
      if (!["ENPR", "ANUL"].includes(original.estado?.codigo))
        throw new Error(
          "Esta venta ya tiene el pago confirmado o fue entregada — no se puede eliminar directamente. Use 'Anular venta' si necesita revertirla.",
        );
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
      // ── NUEVO (ronda 40) — una vez el cliente ya se llevó la pieza, no
      // se puede "anular" como si nada hubiera pasado (el stock ya no
      // está físicamente aquí para restaurarlo). Si hay una devolución
      // real, eso es un proceso aparte que este sistema todavía no maneja.
      if (venta.estado?.codigo === "ENTR")
        throw new Error(
          "Esta venta ya fue entregada — no se puede anular. Si el cliente hizo una devolución, gestiónela por un proceso aparte.",
        );

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

    // ── NUEVO (ronda 40) — "deber ser" acordado con el usuario: el pago
    // se confirma ANTES de entregar la pieza, nunca al revés (control
    // interno básico en mercancía de alto valor). Este mutation cierra
    // ese paso: efectivo/transferencia queda en ENPR al crearse la venta
    // porque el dinero todavía no está verificado — cuando el usuario
    // confirma que sí llegó (contó el efectivo, revisó el banco), pasa a
    // CONF. Tarjeta ya nace en CONF (se liquida al instante), así que no
    // necesita pasar por aquí.
    // ── MOVIDO (ronda 40) — antes vivía en muestrario.resolvers.js /
    // muestrario.typeDefs.js. Ya funcionaba correctamente pero solo tenía
    // botón en la página de Muestrario, así que una venta directa o por
    // cotización pagada en efectivo se quedaba en ENPR sin ninguna forma
    // de confirmarla. Es la misma mutación, sin cambios de lógica — solo
    // cambia de casa para que la pueda usar cualquier venta.
    confirmarVentaEfectivo: async (_, { ventaId }, { prisma, user }) => {
      requireAuth(user);
      const venta = await prisma.venta.findUnique({
        where: { id: Number(ventaId) },
        include: { estado: true },
      });
      if (!venta) throw new Error("Venta no existe");
      validarEmpresa(venta.empresaId, user.empresaActualId);
      if (venta.estado?.codigo !== "ENPR")
        throw new Error("Solo se pueden confirmar ventas EN PROCESO");
      const estadoConf = await prisma.grupo.findFirst({
        where: {
          codigo: "CONF",
          subcatalogo: { codigo: "ESTV", catalogo: { codigo: "VENT" } },
        },
      });
      if (!estadoConf) throw new Error("Estado CONF no encontrado en catálogo");
      await prisma.venta.update({
        where: { id: Number(ventaId) },
        data: {
          estadoId: estadoConf.id,
          usu_actualizacion: user.codigo,
          version: { increment: 1 },
        },
      });
      return prisma.venta.findUnique({
        where: { id: Number(ventaId) },
        include: incVenta,
      });
    },

    // ── NUEVO (ronda 40) — cierra el ciclo de vida de la venta: el
    // cliente ya tiene la pieza en la mano. Solo se puede llegar aquí
    // desde CONF (pago ya confirmado) — nunca directo desde ENPR, porque
    // "fiar" la pieza sin haber verificado el pago es justo el riesgo que
    // este control busca evitar. No mueve stock (ya se descontó cuando la
    // línea se agregó a la venta) — solo registra que la venta quedó
    // cerrada y en qué fecha se hizo la entrega física.
    entregarVenta: async (_, { id, version }, { prisma, user }) => {
      requireAuth(user);
      const venta = await prisma.venta.findUnique({
        where: { id: Number(id) },
        include: { estado: true },
      });
      if (!venta) throw new Error("Venta no existe");
      validarEmpresa(venta.empresaId, user.empresaActualId);
      if (venta.estado?.codigo !== "CONF")
        throw new Error(
          "Solo se puede entregar una venta con el pago ya confirmado. Confirme el pago primero.",
        );
      const estadoEntr = await prisma.grupo.findFirst({
        where: {
          codigo: "ENTR",
          subcatalogo: { codigo: "ESTV", catalogo: { codigo: "VENT" } },
        },
      });
      if (!estadoEntr)
        throw new Error(
          "Estado ENTR no encontrado en catálogo — cree el Grupo 'Entregada' (código ENTR) en Admin → SubCatálogos → Grupos, dentro del catálogo VENT / subcatálogo ESTV.",
        );
      const result = await prisma.venta.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          estadoId: estadoEntr.id,
          fechaEntrega: new Date(),
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
      // ── CAMBIO (ronda 40) — antes solo bloqueaba en ANUL. "Deber ser"
      // acordado: en cuanto se confirma el pago, esa venta se cierra para
      // nuevas líneas — si el cliente quiere algo más, es una venta
      // nueva, para que nunca quede la duda de cuánto falta por cobrar.
      if (venta.estado?.codigo !== "ENPR")
        throw new Error(
          "Esta venta ya no está en proceso (pago confirmado, entregada o anulada) — cree una venta nueva para agregar más productos.",
        );
      const cantidad = Number(input.cantidad);
      if (cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
      // ── CAMBIO (ronda 42) — se agrega `incCosteoProducto` para poder
      // calcular y congelar el costo de producir esta pieza (necesario
      // para la utilidad real que se reparte entre las socias).
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
        include: incCosteoProducto,
      });
      if (!producto) throw new Error("Producto no existe");
      if (producto.enStock < cantidad)
        throw new Error(
          `Sin stock suficiente para ${producto.nombre}. Disponible: ${producto.enStock}`,
        );
      const subtotal = cantidad * Number(input.precioVenta);
      // ── NUEVO (ronda 39) — la Venta es el evento fiscalmente
      // vinculante ("el IVA es de papá gobierno"): se congela el desglose
      // con la tarifa VIGENTE del producto en este instante — si el %
      // cambia después, esta línea histórica no se ve afectada.
      const pctIva = Number(producto.porcentajeIva ?? 19);
      const { baseGravable, valorIva } = calcularIvaDesglose(
        Number(input.precioVenta),
        pctIva,
      );
      // ── NUEVO (ronda 42) — costo de producir la pieza, congelado con
      // el costeo VIGENTE en este instante (ver costeoHelpers.js) — es
      // la base para la utilidad real que se reparte entre las socias.
      const { costoTotal: costoUnitario } = await calcularCostoProducto(
        producto,
        prisma,
      );
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
            porcentajeIva: pctIva,
            baseGravable,
            costoUnitario,
            valorIva,
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
      // ── CAMBIO (ronda 40) — mismo criterio que agregarItemVenta: solo
      // se puede editar una línea mientras la venta sigue "En proceso".
      if (original.venta.estado?.codigo !== "ENPR")
        throw new Error(
          "Esta venta ya no está en proceso (pago confirmado, entregada o anulada) y no se puede modificar.",
        );
      const nuevaCantidad = Number(cantidad);
      if (nuevaCantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
      const subtotal = nuevaCantidad * Number(precioVenta);
      const delta = nuevaCantidad - Number(original.cantidad);
      // ── NUEVO (ronda 39) — igual que en actualizarItemCotizacion: al
      // EDITAR una línea ya vendida se conserva el `porcentajeIva` ya
      // congelado (no se vuelve a consultar el producto) — editar es una
      // corrección al mismo hecho de venta, no un nuevo hecho generador
      // del impuesto. Solo se recalcula base/IVA con el (posiblemente
      // nuevo) precio, contra esa MISMA tarifa ya congelada.
      const pctIva = Number(original.porcentajeIva ?? 19);
      const { baseGravable, valorIva } = calcularIvaDesglose(
        Number(precioVenta),
        pctIva,
      );

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
            baseGravable,
            valorIva,
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
        include: { venta: { include: { estado: true } } },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.venta.empresaId, user.empresaActualId);
      // ── NUEVO (ronda 40) — antes no tenía NINGÚN control de estado
      // (se podía borrar una línea de una venta ya pagada sin que quedara
      // rastro). Mismo criterio que agregar/actualizar: solo mientras
      // sigue "En proceso".
      if (original.venta.estado?.codigo !== "ENPR")
        throw new Error(
          "Esta venta ya no está en proceso (pago confirmado, entregada o anulada) — no se pueden quitar productos.",
        );
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
      console.log("Guardar reparto");
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
      // ── FIX (este arreglo) — antes usaba el valor BRUTO de la venta
      // (con IVA, sin restar costo ni comisión) para calcular cuánto le
      // toca a cada socia. Desde la ronda 42 el panel le MUESTRA la
      // utilidad calculada sobre el margen real (venta.utilidadReparto),
      // pero acá seguía guardando con la fórmula vieja — es decir, lo que
      // se guardaba no coincidía con lo que usted veía en pantalla. Ahora
      // usa la misma fórmula (calcularUtilidadReparto), para que el valor
      // guardado por socia sea consistente con lo que se muestra.
      const utilidad = calcularUtilidadReparto(
        venta.items,
        venta.porcentajeComision,
      );
      console.log("Guardar reparto Utilidad", utilidad);
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
                valor: (utilidad * Number(r.porcentaje)) / 100,
              },
              include: { socio: true },
            }),
          ),
        );
      });
    },
  },
};

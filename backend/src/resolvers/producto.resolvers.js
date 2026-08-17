import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";
import { calcularIvaDesglose } from "../utils/ivaHelpers.js";
import { calcularCostoProducto } from "../utils/costeoHelpers.js";

const incBom = {
  categoria: true,
  piedras: {
    where: { deletedAt: null },
    include: {
      piedra: { include: { tipo: true, unidad: true } },
      tipoPiedra: true,
    },
    orderBy: [{ tipoId: "asc" }, { id: "asc" }],
  },
};

// ── Costeo ───────────────────────────────────────────────────────
// El costo de cada línea del BOM se toma de su costoEstandardUnitario
// guardado — EXCEPTO el oro (piedra.tipo.codigo === 'ORO'), cuyo costo
// se resuelve dinámicamente contra el último lote de CompraInsumo de
// ese insumo. Así el costeo siempre refleja el precio de oro más
// reciente sin tener que editar el BOM a mano cada vez que sube.
// costoOro ya no es gramosOro × costoGramoOroUsado (esos campos se
// eliminaron de Producto) — ahora es la suma de las líneas del BOM
// cuyo insumo es de tipo ORO, y esas líneas YA están incluidas dentro
// de costoPiedras (no se suman dos veces).
//
// El resultado se cachea en el propio objeto `p` (p.__costeo) para que
// los 9 campos calculados de Producto que dependen de este cálculo no
// disparen 9 consultas repetidas por cada producto de la lista.
const calcCosteoAsync = async (p, prisma) => {
  if (p.__costeo) return p.__costeo;

  // ── CAMBIO (ronda 42) — costoPiedras/costoOro/costoTotal ahora salen
  // de la misma función compartida (`calcularCostoProducto`) que usan
  // venta.resolvers.js / muestrario.resolvers.js / cotizacion.resolvers.js
  // para CONGELAR el costo de cada línea de venta en su momento — antes
  // esta lógica vivía solo aquí; duplicarla habría arriesgado que las dos
  // copias se desincronizaran con el tiempo. El resultado es idéntico al
  // de antes, esto es un refactor sin cambio de comportamiento.
  const { costoPiedras, costoOro, costoTotal } = await calcularCostoProducto(
    p,
    prisma,
  );
  const mult = Number(p.multiplicador ?? 2.25);
  const precioSugerido = Math.round(costoTotal * mult);
  // ── CAMBIO (ronda 39) — antes 1.19/0.19 fijos en el código; ahora usan
  // el % de IVA propio de ESTE producto (no todos son 19% — ver
  // Producto.porcentajeIva). ivaValor sale por diferencia contra
  // pvpConIva (no independientemente redondeado), mismo criterio de
  // ivaHelpers.js, para que pvpConIva === precioSugerido + ivaValor
  // siempre cuadre exacto.
  const pctIva = Number(p.porcentajeIva ?? 19);
  const pvpConIva = Math.round(precioSugerido * (1 + pctIva / 100));
  const ivaValor = pvpConIva - precioSugerido;
  const precioVenta = Number(p.precioVenta);
  // ── FIX (ronda 39) — precioVenta es el precio CON IVA incluido (ver
  // "deber ser" acordado); compararlo directo contra costoTotal (que no
  // tiene IVA) inflaba el margen. Ahora se le quita el IVA propio del
  // producto primero (misma regla de redondeo de ivaHelpers.js) y se
  // compara esa base sin IVA contra el costo.
  const baseVentaSinIva = calcularIvaDesglose(precioVenta, pctIva).baseGravable;
  const margen =
    baseVentaSinIva > 0
      ? Math.round(((baseVentaSinIva - costoTotal) / baseVentaSinIva) * 10000) /
        100
      : 0;
  const conTarjeta = Math.round(precioSugerido * 1.07);
  const comisionMax = Math.round(precioVenta * 0.2);

  p.__costeo = {
    costoPiedras,
    costoOro,
    costoTotal,
    precioSugerido,
    pvpConIva,
    margen,
    ivaValor,
    conTarjeta,
    comisionMax,
  };
  return p.__costeo;
};

// ── NUEVO — visibilidad de inventario (Kardex) ──────────────────────
// Mismo patrón de numeración que generarNumeroOrden/generarNumeroMuestrario.
const generarNumeroAjuste = async (prisma, empresaId) => {
  const anio = new Date().getFullYear();
  const prefijo = `AJI-${anio}-`;
  const count = await prisma.ajusteInventario.count({
    where: { empresaId, numero: { startsWith: prefijo } },
  });
  const consecutivo = String(count + 1).padStart(3, "0");
  return `${prefijo}${consecutivo}`;
};

export default {
  AjusteInventario: {
    fecha: (a) => (a.fecha ? new Date(a.fecha).toISOString() : null),
  },

  Producto: {
    multiplicador: (p) => Number(p.multiplicador ?? 2.25),
    porcentajeIva: (p) => Number(p.porcentajeIva ?? 19),
    costoPiedras: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).costoPiedras,
    costoOro: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).costoOro,
    costoTotal: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).costoTotal,
    precioSugerido: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).precioSugerido,
    pvpConIva: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).pvpConIva,
    margen: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).margen,
    ivaValor: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).ivaValor,
    conTarjeta: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).conTarjeta,
    comisionMax: async (p, _, { prisma }) =>
      (await calcCosteoAsync(p, prisma)).comisionMax,
  },

  Query: {
    productosFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { referencia: { contains: t, mode: "insensitive" } },
          { nombre: { contains: t, mode: "insensitive" } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ referencia: "asc" }];
      const items = await prisma.producto.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incBom,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.producto.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
    obtenerProductos: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.producto.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          activo: true,
        },
        orderBy: { nombre: "asc" },
        include: incBom,
      });
    },
    validarCodigoProducto: async (
      _,
      { empresaId, referencia },
      { prisma, user },
    ) => {
      requireAuth(user);
      const existe = await prisma.producto.findFirst({
        where: {
          empresaId: Number(empresaId),
          referencia: referencia,
          deletedAt: null,
        },
        select: { id: true },
      });
      return !!existe;
    },

    // ── NUEVO — visibilidad de inventario (Kardex) ────────────────────
    // Junta en una sola lista, ordenada por fecha, TODO lo que mueve el
    // stock de un producto sin importar su origen — producción entregada,
    // venta directa, venta por cotización, venta desde muestrario, salida
    // a muestrario, devolución de muestrario y ajustes manuales. El
    // frontend arma el Kardex mensual/anual a partir de esta lista (mismo
    // modelo que se validó en la simulación de Excel antes de programar
    // esto: "Reglas" = el criterio de qué entra/sale/afecta "En
    // Muestrarios" que aquí queda repartido en cada bloque de abajo).
    movimientosInventarioProducto: async (
      _,
      { productoId },
      { prisma, user },
    ) => {
      requireAuth(user);
      const producto = await prisma.producto.findUnique({
        where: { id: Number(productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      validarEmpresa(producto.empresaId, user.empresaActualId);

      const movimientos = [];

      // 1. Producción entregada
      const entregas = await prisma.entregaOrden.findMany({
        where: {
          deletedAt: null,
          ordenProduccion: { productoId: Number(productoId) },
        },
        include: { ordenProduccion: true },
      });
      for (const e of entregas) {
        movimientos.push({
          fecha: e.fecha,
          tipo: "Producción entregada",
          referencia: e.numeroRemision || e.ordenProduccion.numero,
          cantidad: e.cantidad,
          entradaStock: e.cantidad,
          salidaStock: 0,
          variacionMuestrario: 0,
          vendedora: null,
        });
      }

      // 2. Ventas — directa / por cotización / desde muestrario
      // ── CAMBIO (ronda 34) — Venta se partió en cabeza (Venta) + detalle
      // (VentaDetalle): productoId/cantidad/muestrarioItemId/
      // cotizacionItemId ahora viven en la línea, no en la venta. Se
      // consulta VentaDetalle y se sube a `.venta` para fecha/estado —
      // mismo ajuste que ya se hizo para CompraInsumo en piedra.resolvers.js.
      const ventas = await prisma.ventaDetalle.findMany({
        where: {
          productoId: Number(productoId),
          deletedAt: null,
          venta: {
            empresaId: user.empresaActualId,
            deletedAt: null,
            estado: { codigo: { not: "ANUL" } },
          },
        },
        include: {
          venta: true,
          cotizacionItem: { include: { cotizacion: true } },
          muestrarioItem: {
            include: { muestrario: { include: { vendedora: true } } },
          },
        },
      });
      for (const v of ventas) {
        if (v.muestrarioItemId) {
          movimientos.push({
            fecha: v.venta.fecha,
            tipo: "Venta desde muestrario",
            referencia: v.muestrarioItem?.muestrario?.numero || v.venta.numero,
            cantidad: v.cantidad,
            entradaStock: 0,
            salidaStock: 0,
            variacionMuestrario: -v.cantidad,
            vendedora: v.muestrarioItem?.muestrario?.vendedora?.nombre || null,
          });
        } else if (v.cotizacionItemId) {
          movimientos.push({
            fecha: v.venta.fecha,
            tipo: "Venta por cotización convertida",
            referencia: v.cotizacionItem?.cotizacion?.numero || v.venta.numero,
            cantidad: v.cantidad,
            entradaStock: 0,
            salidaStock: v.cantidad,
            variacionMuestrario: 0,
            vendedora: null,
          });
        } else {
          movimientos.push({
            fecha: v.venta.fecha,
            tipo: "Venta directa",
            referencia: v.venta.numero,
            cantidad: v.cantidad,
            entradaStock: 0,
            salidaStock: v.cantidad,
            variacionMuestrario: 0,
            vendedora: null,
          });
        }
      }

      // 3. Salida a muestrario + 4. Devolución de muestrario
      const itemsMuestrario = await prisma.muestrarioItem.findMany({
        where: { productoId: Number(productoId), deletedAt: null },
        include: { muestrario: { include: { vendedora: true } } },
      });
      for (const it of itemsMuestrario) {
        const nombreVendedora = it.muestrario?.vendedora?.nombre || null;
        movimientos.push({
          fecha: it.fechaEntrega,
          tipo: "Salida a muestrario",
          referencia: it.muestrario?.numero || `Muestrario #${it.muestrarioId}`,
          cantidad: it.cantidadEntregada,
          entradaStock: 0,
          salidaStock: it.cantidadEntregada,
          variacionMuestrario: it.cantidadEntregada,
          vendedora: nombreVendedora,
        });
        if (it.cantidadDevuelta > 0) {
          movimientos.push({
            fecha: it.muestrario?.fechaCierre || it.fechaEntrega,
            tipo: "Devolución de muestrario",
            referencia:
              it.muestrario?.numero || `Muestrario #${it.muestrarioId}`,
            cantidad: it.cantidadDevuelta,
            entradaStock: it.cantidadDevuelta,
            salidaStock: 0,
            variacionMuestrario: -it.cantidadDevuelta,
            vendedora: nombreVendedora,
          });
        }
      }

      // 5. Ajustes de inventario (pérdida / hallazgo)
      const ajustes = await prisma.ajusteInventario.findMany({
        where: { productoId: Number(productoId), deletedAt: null },
      });
      for (const a of ajustes) {
        const esHallazgo = a.tipoMovimiento === "HALLAZGO";
        movimientos.push({
          fecha: a.fecha,
          tipo: esHallazgo ? "Ajuste — hallazgo" : "Ajuste — pérdida",
          referencia: a.numero,
          cantidad: a.cantidad,
          entradaStock: esHallazgo ? a.cantidad : 0,
          salidaStock: esHallazgo ? 0 : a.cantidad,
          variacionMuestrario: 0,
          vendedora: null,
        });
      }

      movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      return movimientos.map((m) => ({
        ...m,
        fecha: new Date(m.fecha).toISOString(),
      }));
    },
  },

  Mutation: {
    crearProducto: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.producto.findFirst({
        where: {
          referencia: input.referencia,
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error("La referencia ya existe");
      return prisma.producto.create({
        data: {
          ...input,
          multiplicador: input.multiplicador ?? 2.25,
          // ── NUEVO (ronda 39) — 19% por defecto si no se especifica (la
          // mayoría de productos), pero editable por producto.
          porcentajeIva: input.porcentajeIva ?? 19,
          enStock: 0,
          activo: true,
          usu_creacion: user.codigo,
        },
        include: incBom,
      });
    },

    actualizarProducto: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.producto.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Producto no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      // ── OJO (ronda 39) — a propósito NO se hace `porcentajeIva ?? 19`
      // aquí como sí se hace con `multiplicador`. Si un producto tiene un
      // % de IVA distinto de 19 (ej. 5% o 0%) y se actualiza sin mandar
      // ese campo, forzar el default lo resetearía silenciosamente a 19%
      // — con `...data` (spread) simplemente no se toca esa columna si no
      // viene en el input, que es el comportamiento correcto.
      const result = await prisma.producto.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          multiplicador: data.multiplicador ?? 2.25,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.producto.findUnique({
        where: { id: Number(id) },
        include: incBom,
      });
    },

    eliminarProducto: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.producto.findUnique({
        where: { id: Number(id) },
      });
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.producto.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },

    agregarInsumoProducto: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const producto = await prisma.producto.findUnique({
        where: { id: input.productoId },
      });
      if (!producto) throw new Error("Producto no existe");
      validarEmpresa(producto.empresaId, user.empresaActualId);
      // Solo un tipoId por producto
      const existe = await prisma.productoPiedra.findFirst({
        where: {
          productoId: input.productoId,
          tipoId: input.tipoId,
          deletedAt: null,
        },
      });
      if (existe)
        throw new Error("Ya existe una piedra de este tipo en el producto");
      const costoEstandardTotal =
        Number(input.cantidad) * Number(input.costoEstandardUnitario);
      return prisma.productoPiedra.create({
        data: {
          ...input,
          costoEstandardTotal,
          desperdicio: input.desperdicio ?? 0,
        },
        include: {
          piedra: { include: { tipo: true, unidad: true } },
          tipoPiedra: true,
        },
      });
    },

    actualizarInsumoProducto: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const costoEstandardTotal =
        Number(data.cantidad) * Number(data.costoEstandardUnitario);
      const result = await prisma.productoPiedra.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          costoEstandardTotal,
          desperdicio: data.desperdicio ?? 0,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.productoPiedra.findUnique({
        where: { id: Number(id) },
        include: {
          piedra: { include: { tipo: true, unidad: true } },
          tipoPiedra: true,
        },
      });
    },

    eliminarInsumoProducto: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.productoPiedra.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },

    // ── NUEVO — visibilidad de inventario (Kardex): ajuste manual de
    // stock por pérdida o hallazgo. A diferencia de una venta, un ajuste
    // manual siempre exige un motivo por escrito — nunca se permite un
    // cambio de stock sin explicación (mismo principio que la liquidación
    // de muestrario con faltante).
    crearAjusteInventario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { empresaId, productoId, tipoMovimiento, cantidad, motivo } = input;
      validarEmpresa(empresaId, user.empresaActualId);
      if (!["PERDIDA", "HALLAZGO"].includes(tipoMovimiento)) {
        throw new Error("Tipo de movimiento inválido");
      }
      if (!motivo?.trim()) throw new Error("El motivo es obligatorio");
      if (Number(cantidad) <= 0)
        throw new Error("La cantidad debe ser mayor a 0");

      const producto = await prisma.producto.findUnique({
        where: { id: Number(productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      validarEmpresa(producto.empresaId, user.empresaActualId);

      if (tipoMovimiento === "PERDIDA" && producto.enStock < Number(cantidad)) {
        throw new Error(
          `No puede registrar una pérdida mayor al stock actual. Disponible: ${producto.enStock}`,
        );
      }

      const numero = await generarNumeroAjuste(prisma, Number(empresaId));
      const delta =
        tipoMovimiento === "HALLAZGO" ? Number(cantidad) : -Number(cantidad);

      return prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: Number(productoId) },
          data: { enStock: { increment: delta } },
        });
        return tx.ajusteInventario.create({
          data: {
            empresaId: Number(empresaId),
            productoId: Number(productoId),
            numero,
            tipoMovimiento,
            cantidad: Number(cantidad),
            motivo: motivo.trim(),
            usu_creacion: user.codigo,
          },
        });
      });
    },
  },
};

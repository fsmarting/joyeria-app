import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

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

  const piedras = p.piedras || [];
  let costoPiedras = 0;
  let costoOro = 0;

  for (const pp of piedras) {
    const esOro = pp.piedra?.tipo?.codigo === "ORO";
    let costoUnitario = Number(pp.costoEstandardUnitario);

    if (esOro) {
      // ── CAMBIO — CompraInsumo ya no trae empresaId/fecha propios (ahora
      // viven en su cabeza Compra, ver "deber ser" de separar cabeza/
      // detalle en Compras de Insumos) — se filtra/ordena vía la relación
      // `compra`, mismo criterio que piedra.resolvers.js.
      const ultimoLote = await prisma.compraInsumo.findFirst({
        where: {
          piedraId: pp.piedraId,
          deletedAt: null,
          compra: { empresaId: p.empresaId, deletedAt: null },
        },
        orderBy: { compra: { fecha: "desc" } },
      });
      if (ultimoLote) costoUnitario = Number(ultimoLote.costoUnitario);
    }

    const totalLinea = Number(pp.cantidad) * costoUnitario;
    costoPiedras += totalLinea;
    if (esOro) costoOro += totalLinea;
  }

  const costoTotal =
    costoPiedras + Number(p.costoManoObra) + Number(p.costoOtros);
  const mult = Number(p.multiplicador ?? 2.25);
  const precioSugerido = Math.round(costoTotal * mult);
  const pvpConIva = Math.round(precioSugerido * 1.19);
  const precioVenta = Number(p.precioVenta);
  const margen =
    precioVenta > 0
      ? Math.round(((precioVenta - costoTotal) / precioVenta) * 10000) / 100
      : 0;
  const ivaValor = Math.round(precioSugerido * 0.19);
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
      const ventas = await prisma.venta.findMany({
        where: {
          productoId: Number(productoId),
          deletedAt: null,
          estado: { codigo: { not: "ANUL" } },
        },
        include: {
          cotizacionItem: { include: { cotizacion: true } },
          muestrarioItem: {
            include: { muestrario: { include: { vendedora: true } } },
          },
        },
      });
      for (const v of ventas) {
        if (v.muestrarioItemId) {
          movimientos.push({
            fecha: v.fecha,
            tipo: "Venta desde muestrario",
            referencia:
              v.muestrarioItem?.muestrario?.numero || `Venta #${v.id}`,
            cantidad: v.cantidad,
            entradaStock: 0,
            salidaStock: 0,
            variacionMuestrario: -v.cantidad,
            vendedora: v.muestrarioItem?.muestrario?.vendedora?.nombre || null,
          });
        } else if (v.cotizacionItemId) {
          movimientos.push({
            fecha: v.fecha,
            tipo: "Venta por cotización convertida",
            referencia:
              v.cotizacionItem?.cotizacion?.numero || `Venta #${v.id}`,
            cantidad: v.cantidad,
            entradaStock: 0,
            salidaStock: v.cantidad,
            variacionMuestrario: 0,
            vendedora: null,
          });
        } else {
          movimientos.push({
            fecha: v.fecha,
            tipo: "Venta directa",
            referencia: `Venta #${v.id}`,
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

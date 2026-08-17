import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";
import { calcularIvaDesglose } from "../utils/ivaHelpers.js";

// ── CAMBIO (ronda 34) — antes: ventas { ... cliente medioPago estado }
// (la venta era 1 solo producto, así que esos campos vivían ahí mismo).
// Ahora se lee vía ventaDetalles, y cliente/medioPago/estado viven en la
// venta (cabeza) de cada línea — se incluye anidado.
const incItem = {
  producto: { include: { categoria: true } },
  ventaDetalles: {
    where: { deletedAt: null, venta: { estado: { codigo: { not: "ANUL" } } } },
    include: {
      venta: { include: { cliente: true, medioPago: true, estado: true } },
    },
  },
};

const incMuestrario = {
  vendedora: true,
  items: {
    where: { deletedAt: null },
    include: incItem,
    orderBy: { id: "asc" },
  },
};

// ── CAMBIO — antes "vendida" == número de filas en Venta (siempre 1 c/u).
// Ahora una venta puede cubrir varias unidades, así que sumamos cantidad.
// (ronda 34: la fuente es ventaDetalles, no ventas)
const unidadesVendidas = (item) =>
  (item.ventaDetalles || []).reduce((s, v) => s + v.cantidad, 0);

// ── NUEVO — mismo patrón que generarNumeroOrden en ordenProduccion.resolvers.js
const generarNumeroMuestrario = async (prisma, empresaId) => {
  const anio = new Date().getFullYear();
  const prefijo = `MST-${anio}-`;
  const count = await prisma.muestrario.count({
    where: { empresaId, numero: { startsWith: prefijo } },
  });
  const consecutivo = String(count + 1).padStart(3, "0");
  return `${prefijo}${consecutivo}`;
};

export default {
  Muestrario: {
    fechaSalida: (m) =>
      m.fechaSalida ? new Date(m.fechaSalida).toISOString() : null,
    fechaCierre: (m) =>
      m.fechaCierre ? new Date(m.fechaCierre).toISOString() : null,
    totalPiezas: (m) =>
      (m.items || []).reduce((s, i) => s + i.cantidadEntregada, 0),
    totalVendidas: (m) =>
      (m.items || []).reduce((s, i) => s + unidadesVendidas(i), 0),
    // ── CAMBIO (ronda 34) — v.estado vivía directo en la venta antes;
    // ahora está en v.venta.estado (la cabeza de esa línea).
    totalEfectivoPendiente: (m) =>
      (m.items || [])
        .flatMap((i) => i.ventaDetalles || [])
        .filter((v) => v.venta?.estado?.codigo === "ENPR")
        .reduce((s, v) => s + Number(v.precioVenta) * Number(v.cantidad), 0),
  },
  MuestrarioItem: {
    cantidadVendida: (i) => unidadesVendidas(i),
    cantidadDisponible: (i) =>
      i.cantidadEntregada - unidadesVendidas(i) - i.cantidadDevuelta,
  },

  Query: {
    muestrariosFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        where.OR = [
          {
            vendedora: {
              nombre: { contains: busqueda.trim(), mode: "insensitive" },
            },
          },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fechaSalida: "desc" }];
      const items = await prisma.muestrario.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incMuestrario,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.muestrario.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
  },

  Mutation: {
    crearMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const numero = await generarNumeroMuestrario(
        prisma,
        user.empresaActualId,
      );
      return prisma.muestrario.create({
        data: {
          ...input,
          numero,
          fechaSalida: new Date(input.fechaSalida),
          estado: "ACTIVO",
          usu_creacion: user.codigo,
        },
        include: incMuestrario,
      });
    },

    // Solo permite editar la nota
    actualizarMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, nota } = input;
      const original = await prisma.muestrario.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Muestrario no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.muestrario.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          nota: nota ?? null,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.muestrario.findUnique({
        where: { id: Number(id) },
        include: incMuestrario,
      });
    },

    agregarItemMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const muestrario = await prisma.muestrario.findUnique({
        where: { id: input.muestrarioId },
      });
      if (!muestrario) throw new Error("Muestrario no existe");
      validarEmpresa(muestrario.empresaId, user.empresaActualId);
      if (muestrario.estado !== "ACTIVO")
        throw new Error("El muestrario ya está liquidado");
      const producto = await prisma.producto.findUnique({
        where: { id: input.productoId },
      });
      if (producto.enStock < input.cantidadEntregada)
        throw new Error(`Stock insuficiente. Disponible: ${producto.enStock}`);
      const existe = await prisma.muestrarioItem.findFirst({
        where: {
          muestrarioId: input.muestrarioId,
          productoId: input.productoId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error("Este producto ya está en el muestrario");
      return prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: input.productoId },
          data: { enStock: { decrement: input.cantidadEntregada } },
        });
        return tx.muestrarioItem.create({
          data: { ...input },
          include: incItem,
        });
      });
    },

    eliminarItemMuestrario: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const item = await prisma.muestrarioItem.findUnique({
        where: { id: Number(id) },
        include: {
          muestrario: true,
          ventaDetalles: { where: { deletedAt: null } },
        },
      });
      if (!item) throw new Error("No existe");
      validarEmpresa(item.muestrario.empresaId, user.empresaActualId);
      if (item.ventaDetalles.length > 0)
        throw new Error("Este item ya tiene ventas registradas");
      await prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { enStock: { increment: item.cantidadEntregada } },
        });
        await tx.muestrarioItem.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date() },
        });
      });
      return true;
    },

    // ── CAMBIO (ronda 34) — antes creaba una sola fila de Venta (cabeza +
    // detalle mezclados). Ahora crea una Venta (cabeza) + UNA VentaDetalle
    // (línea) en transacción — "Fase 1" de la conversación sobre separar
    // cabeza/detalle en Ventas: cada venta desde muestrario sigue siendo
    // 1 sola línea, igual comportamiento externo que antes. NO se toca
    // producto.enStock aquí — el producto ya salió del stock central
    // cuando entró al muestrario (agregarItemMuestrario), venderlo desde
    // ahí no lo mueve de nuevo (mismo criterio que ya tenía esta mutation).
    registrarVentaMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const {
        muestrarioItemId,
        clienteId,
        precioVenta,
        medioPagoId,
        vendedoraId,
        empresaId,
      } = input;
      const cantidad = Number(input.cantidad ?? 1);
      if (cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
      // ── CAMBIO (ronda 39) — se agrega `producto: true` para poder leer
      // su porcentajeIva vigente y congelar el desglose de esta venta.
      const item = await prisma.muestrarioItem.findUnique({
        where: { id: muestrarioItemId },
        include: {
          muestrario: true,
          producto: true,
          ventaDetalles: {
            where: {
              deletedAt: null,
              venta: { estado: { codigo: { not: "ANUL" } } },
            },
          },
        },
      });
      if (!item) throw new Error("Item no existe");
      validarEmpresa(item.muestrario.empresaId, user.empresaActualId);
      if (item.muestrario.estado !== "ACTIVO")
        throw new Error("El muestrario ya está liquidado");
      const disponible =
        item.cantidadEntregada - unidadesVendidas(item) - item.cantidadDevuelta;
      if (cantidad > disponible)
        throw new Error(
          `No quedan suficientes unidades disponibles en el muestrario. Disponible: ${disponible}`,
        );

      const ue = await prisma.usuarioEmpresa.findFirst({
        where: {
          usuarioId: Number(vendedoraId),
          empresaId: Number(empresaId),
          deletedAt: null,
        },
      });
      const medioPago = await prisma.grupo.findUnique({
        where: { id: Number(medioPagoId) },
      });
      const porcentaje =
        medioPago?.codigo === "TARJ"
          ? Number(ue?.comisionTarjeta ?? 0)
          : Number(ue?.comisionEfectivo ?? 0);

      const esTarjeta = medioPago?.codigo === "TARJ";
      const estadoCod = esTarjeta ? "CONF" : "ENPR";
      const estadoGrupo = await prisma.grupo.findFirst({
        where: {
          codigo: estadoCod,
          subcatalogo: { codigo: "ESTV", catalogo: { codigo: "VENT" } },
        },
      });
      if (!estadoGrupo)
        throw new Error("Estado de venta no encontrado en catálogo");

      const anio = new Date().getFullYear();
      const prefijo = `VTA-${anio}-`;
      const count = await prisma.venta.count({
        where: {
          empresaId: Number(empresaId),
          numero: { startsWith: prefijo },
        },
      });
      const numero = `${prefijo}${String(count + 1).padStart(4, "0")}`;

      // ── NUEVO (ronda 39) — vender desde muestrario también es un hecho
      // de venta fiscalmente vinculante: se congela el desglose de IVA
      // con la tarifa vigente del producto en este instante.
      const pctIva = Number(item.producto?.porcentajeIva ?? 19);
      const { baseGravable, valorIva } = calcularIvaDesglose(
        Number(precioVenta),
        pctIva,
      );

      return prisma.$transaction(async (tx) => {
        const venta = await tx.venta.create({
          data: {
            empresaId: Number(empresaId),
            numero,
            clienteId: Number(clienteId),
            vendedoraId: Number(vendedoraId),
            fecha: new Date(),
            medioPagoId: Number(medioPagoId),
            porcentajeComision: porcentaje,
            estadoId: estadoGrupo.id,
            usu_creacion: user.codigo,
          },
        });
        await tx.ventaDetalle.create({
          data: {
            ventaId: venta.id,
            productoId: item.productoId,
            muestrarioItemId,
            cantidad,
            precioVenta: Number(precioVenta),
            subtotal: Number(precioVenta) * cantidad,
            porcentajeIva: pctIva,
            baseGravable,
            valorIva,
            usu_creacion: user.codigo,
          },
        });
        return tx.venta.findUnique({
          where: { id: venta.id },
          include: {
            cliente: true,
            vendedora: true,
            medioPago: true,
            estado: true,
            repartos: true,
            items: { include: { producto: true } },
          },
        });
      });
    },

    // ── MOVIDO (ronda 40) — confirmarVentaEfectivo se trasladó a
    // venta.resolvers.js (misma lógica, sin cambios) para que cualquier
    // venta la pueda usar, no solo las que salen de un muestrario.

    liquidarMuestrario: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { muestrarioId, devoluciones, version, motivo } = input;
      const muestrario = await prisma.muestrario.findUnique({
        where: { id: muestrarioId },
        include: {
          items: {
            where: { deletedAt: null },
            include: {
              ventaDetalles: {
                where: {
                  deletedAt: null,
                  venta: { estado: { codigo: { not: "ANUL" } } },
                },
              },
            },
          },
        },
      });
      if (!muestrario) throw new Error("Muestrario no existe");
      validarEmpresa(muestrario.empresaId, user.empresaActualId);
      if (muestrario.estado !== "ACTIVO") throw new Error("Ya está liquidado");

      // ── NUEVO — el invariante de negocio es:
      //   stock devuelto = cantidadEntregada − cantidadDevuelta − vendida
      // Antes de liquidar, verificamos que cada item quede en 0, o que haya
      // un motivo explicando por qué no (piezas perdidas, dañadas, con la
      // vendedora todavía, etc.). El sistema no decide qué pasó — solo
      // exige que quede una nota, igual que "Cerrar orden (entrega parcial)".
      const devolucionesPorItem = new Map(
        devoluciones.map((d) => [d.itemId, Number(d.cantidadDevuelta) || 0]),
      );
      const itemsConFaltante = [];
      for (const item of muestrario.items) {
        const vendidas = unidadesVendidas(item);
        const devuelveAhora = devolucionesPorItem.get(item.id) ?? 0;
        const devueltaTotal = item.cantidadDevuelta + devuelveAhora;
        const faltante = item.cantidadEntregada - vendidas - devueltaTotal;
        if (faltante !== 0) itemsConFaltante.push({ item, faltante });
      }
      if (itemsConFaltante.length > 0 && !motivo?.trim()) {
        const detalle = itemsConFaltante
          .map(
            ({ item, faltante }) =>
              `producto #${item.productoId}: ${faltante > 0 ? `${faltante} sin contabilizar` : `${-faltante} de más`}`,
          )
          .join("; ");
        throw new Error(
          `Hay piezas sin cuadrar (${detalle}). Indique un motivo para poder liquidar de todas formas.`,
        );
      }

      await prisma.$transaction(async (tx) => {
        for (const dev of devoluciones) {
          if (dev.cantidadDevuelta <= 0) continue;
          const item = muestrario.items.find((i) => i.id === dev.itemId);
          if (!item) continue;
          const maxDev = item.cantidadEntregada - unidadesVendidas(item);
          if (dev.cantidadDevuelta > maxDev)
            throw new Error(
              `Devuelve más de lo disponible en item ${dev.itemId}`,
            );
          await tx.muestrarioItem.update({
            where: { id: dev.itemId },
            data: {
              cantidadDevuelta: dev.cantidadDevuelta,
              version: { increment: 1 },
            },
          });
          await tx.producto.update({
            where: { id: item.productoId },
            data: { enStock: { increment: dev.cantidadDevuelta } },
          });
        }
        const fechaTexto = new Date().toLocaleDateString("es-CO");
        const notaFaltante =
          itemsConFaltante.length > 0
            ? `[LIQUIDADO CON FALTANTE ${fechaTexto}] ${motivo.trim()}`
            : null;
        const notaFinal = notaFaltante
          ? muestrario.nota
            ? `${muestrario.nota}\n${notaFaltante}`
            : notaFaltante
          : muestrario.nota;
        const result = await tx.muestrario.updateMany({
          where: { id: muestrarioId, version: Number(version) },
          data: {
            estado: "LIQUIDADO",
            fechaCierre: new Date(),
            nota: notaFinal,
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });
        if (result.count === 0) throw new Error("Modificado por otro usuario");
      });
      return prisma.muestrario.findUnique({
        where: { id: muestrarioId },
        include: incMuestrario,
      });
    },

    eliminarMuestrario: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const m = await prisma.muestrario.findUnique({
        where: { id: Number(id) },
        include: {
          items: { include: { ventaDetalles: { where: { deletedAt: null } } } },
        },
      });
      if (!m) throw new Error("No existe");
      validarEmpresa(m.empresaId, user.empresaActualId);
      if (m.items.some((i) => i.ventaDetalles.length > 0))
        throw new Error("Tiene ventas registradas — no se puede eliminar");
      await prisma.$transaction(async (tx) => {
        for (const item of m.items) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { enStock: { increment: item.cantidadEntregada } },
          });
        }
        await tx.muestrario.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },
  },
};

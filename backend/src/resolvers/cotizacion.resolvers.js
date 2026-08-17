import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";
import { calcularIvaDesglose } from "../utils/ivaHelpers.js";
import {
  calcularCostoProducto,
  incCosteoProducto,
} from "../utils/costeoHelpers.js";
import { parseFechaColombia } from "../utils/fechaHelpers.js";

const cleanForUpdate = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([_, v]) => v !== null && v !== undefined && v !== "",
    ),
  );

const incCotizacion = {
  cliente: true,
  conversacion: true,
  vendedora: true,
  estado: true,
  items: {
    where: { deletedAt: null },
    include: { producto: { include: { categoria: true } } },
    orderBy: { id: "asc" },
  },
};

const calcTotal = (c) =>
  (c.items || []).reduce((s, i) => s + Number(i.subtotal), 0);

export default {
  Cotizacion: {
    fecha: (c) => (c.fecha ? new Date(c.fecha).toISOString() : null),
    total: (c) => calcTotal(c),
  },

  Query: {
    cotizacionesFiltradosCursor: async (
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
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fecha: "desc" }];
      const items = await prisma.cotizacion.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incCotizacion,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.cotizacion.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    siguienteNumeroCotizacion: async (_, { empresaId }, { prisma, user }) => {
      requireAuth(user);
      const anio = new Date().getFullYear();
      const prefix = `COT-${anio}-`;

      // 1. Busca la última cotización ordenada de mayor a menor
      const ultimaCotizacion = await prisma.cotizacion.findFirst({
        where: {
          empresaId: Number(empresaId),
          numero: { startsWith: prefix },
        },
        orderBy: {
          numero: "desc", // Trae la más alta (ej: COT-2026-002)
        },
        select: {
          numero: true,
        },
      });

      let siguienteSecuencia = 1;

      if (ultimaCotizacion) {
        // 2. Extrae el número al final (ej: de "COT-2026-002" saca el "002")
        const partes = ultimaCotizacion.numero.split("-");
        const ultimoNumero = parseInt(partes[partes.length - 1], 10);

        if (!isNaN(ultimoNumero)) {
          siguienteSecuencia = ultimoNumero + 1; // 2 + 1 = 3
        }
      }

      // 3. Retorna el nuevo número correlativo garantizado
      return `${prefix}${String(siguienteSecuencia).padStart(3, "0")}`;
    },
  },

  Mutation: {
    crearCotizacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);

      const existe = await prisma.cotizacion.findFirst({
        where: {
          numero: input.numero,
          empresaId: input.empresaId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error(`El número ${input.numero} ya existe`);

      return prisma.$transaction(async (tx) => {
        // Crear cotización
        const cot = await tx.cotizacion.create({
          data: {
            ...input,
            fecha: parseFechaColombia(input.fecha),
            validezDias: input.validezDias ?? 15,
            usu_creacion: user.codigo,
          },
          include: incCotizacion,
        });

        // ── Auto-poblar items desde piezas de interés de la conversación ──
        if (input.conversacionId) {
          const piezas = await tx.conversacionProducto.findMany({
            where: {
              conversacionId: Number(input.conversacionId),
              deletedAt: null,
            },
            include: { producto: true },
          });
          for (const p of piezas) {
            const precio = Number(p.producto?.precioVenta ?? 0);
            // ── NUEVO (ronda 39) — precio YA incluye IVA; se congela el
            // desglose con la tarifa vigente del producto en este instante
            // (informativo, para que la cotización impresa siempre
            // muestre los mismos números aunque el % cambie después).
            const pctIva = Number(p.producto?.porcentajeIva ?? 19);
            const { baseGravable, valorIva } = calcularIvaDesglose(
              precio,
              pctIva,
            );
            await tx.cotizacionItem.create({
              data: {
                cotizacionId: cot.id,
                productoId: p.productoId,
                precioUnitario: precio,
                cantidad: 1,
                subtotal: precio,
                porcentajeIva: pctIva,
                baseGravable,
                valorIva,
              },
            });
          }
        }

        return tx.cotizacion.findUnique({
          where: { id: cot.id },
          include: incCotizacion,
        });
      });
    },

    actualizarCotizacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.cotizacion.findUnique({
        where: { id: Number(id) },
        include: { estado: true },
      });
      if (!original) throw new Error("Cotización no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);

      // Bloquear si ya fue convertida o rechazada
      if (original.estado?.codigo === "CONV")
        throw new Error(
          "No se puede modificar una cotización ya convertida en venta",
        );
      if (original.estado?.codigo === "RECHA")
        throw new Error("No se puede modificar una cotización rechazada");

      const dataLimpia = cleanForUpdate(data);
      const result = await prisma.cotizacion.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...dataLimpia,
          fecha: parseFechaColombia(dataLimpia.fecha),
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.cotizacion.findUnique({
        where: { id: Number(id) },
        include: incCotizacion,
      });
    },

    eliminarCotizacion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.cotizacion.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.cotizacion.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },

    agregarItemCotizacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const cotizacion = await prisma.cotizacion.findUnique({
        where: { id: input.cotizacionId },
      });
      if (!cotizacion) throw new Error("Cotización no existe");
      validarEmpresa(cotizacion.empresaId, user.empresaActualId);
      const subtotal =
        Number(input.precioUnitario) * Number(input.cantidad ?? 1);
      // ── NUEVO (ronda 39) — se congela el desglose de IVA con la tarifa
      // vigente del producto EN ESTE INSTANTE (ver ivaHelpers.js).
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
      });
      const pctIva = Number(producto?.porcentajeIva ?? 19);
      const { baseGravable, valorIva } = calcularIvaDesglose(
        Number(input.precioUnitario),
        pctIva,
      );
      return prisma.cotizacionItem.create({
        data: {
          ...input,
          cantidad: input.cantidad ?? 1,
          subtotal,
          porcentajeIva: pctIva,
          baseGravable,
          valorIva,
        },
        include: { producto: { include: { categoria: true } } },
      });
    },

    actualizarItemCotizacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      // ── NUEVO (ronda 39) — a diferencia de "agregar", aquí NO se vuelve
      // a consultar el % de IVA vigente del producto. Se conserva el
      // `porcentajeIva` ya congelado en la línea original (editar es una
      // corrección a la misma cotización, no un nuevo evento de cotizar)
      // y solo se recalcula base/IVA si cambia el precio, contra esa
      // MISMA tarifa ya congelada.
      const original = await prisma.cotizacionItem.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Ítem de la cotización no existe");
      const subtotal = Number(data.precioUnitario) * Number(data.cantidad ?? 1);
      const pctIva = Number(original.porcentajeIva ?? 19);
      const { baseGravable, valorIva } = calcularIvaDesglose(
        Number(data.precioUnitario),
        pctIva,
      );
      const result = await prisma.cotizacionItem.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          cantidad: data.cantidad ?? 1,
          subtotal,
          baseGravable,
          valorIva,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.cotizacionItem.findUnique({
        where: { id: Number(id) },
        include: { producto: { include: { categoria: true } } },
      });
    },

    eliminarItemCotizacion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      await prisma.cotizacionItem.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
      return true;
    },

    // ── CAMBIO — ya no exige "1 solo producto por cotización". Convierte
    // TODAS las líneas en su propia Venta (una Venta por CotizacionItem,
    // cada una con su cantidad y su precioUnitario), y devuelve la lista.
    // Si alguna línea no tiene stock suficiente, se cancela todo (transacción).
    convertirEnVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { cotizacionId, medioPagoId, fecha } = input;
      const cotizacion = await prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        include: {
          items: {
            where: { deletedAt: null },
            // ── NUEVO (ronda 42) — se necesita el include de costeo
            // (piedras/oro) para poder congelar `costoUnitario` en la
            // VentaDetalle que se crea más abajo.
            include: { producto: { include: incCosteoProducto } },
          },
          estado: true,
        },
      });
      if (!cotizacion) throw new Error("Cotización no existe");
      validarEmpresa(cotizacion.empresaId, user.empresaActualId);
      if (cotizacion.estado?.codigo === "CONV")
        throw new Error("Esta cotización ya fue convertida en venta");
      if (!cotizacion.clienteId)
        throw new Error(
          "La cotización necesita una clienta para convertirse en venta",
        );
      if (cotizacion.items.length === 0)
        throw new Error("La cotización no tiene productos");

      for (const item of cotizacion.items) {
        if (item.producto.enStock < item.cantidad)
          throw new Error(
            `Sin stock suficiente para ${item.producto.nombre}. Disponible: ${item.producto.enStock}, necesita: ${item.cantidad}`,
          );
      }

      const medioPago = await prisma.grupo.findUnique({
        where: { id: Number(medioPagoId) },
      });
      const estadoCod = medioPago?.codigo === "TARJ" ? "CONF" : "ENPR";
      const estadoVenta = await prisma.grupo.findFirst({
        where: {
          codigo: estadoCod,
          subcatalogo: { codigo: "ESTV", catalogo: { codigo: "VENT" } },
        },
      });
      if (!estadoVenta) throw new Error("Estado de venta no encontrado");

      const ue = cotizacion.vendedoraId
        ? await prisma.usuarioEmpresa.findFirst({
            where: {
              usuarioId: cotizacion.vendedoraId,
              empresaId: cotizacion.empresaId,
              deletedAt: null,
            },
          })
        : null;
      const porcentaje =
        medioPago?.codigo === "TARJ"
          ? Number(ue?.comisionTarjeta ?? 0)
          : Number(ue?.comisionEfectivo ?? 0);

      // ── CAMBIO (ronda 34) — Venta se partió en cabeza + detalle. "Fase 1"
      // de la conversación sobre separar cabeza/detalle en Ventas: se
      // mantiene el mismo comportamiento externo de siempre (una Venta por
      // cada línea de la cotización) — cada Venta ahora tiene 1 sola
      // VentaDetalle en vez de mezclar cabeza+detalle en una fila. La
      // consolidación en una sola venta con varias líneas queda para una
      // fase futura si hace falta.
      const anio = new Date().getFullYear();
      const prefijo = `VTA-${anio}-`;

      return prisma.$transaction(async (tx) => {
        const ventas = [];
        for (const item of cotizacion.items) {
          const subtotal = Number(item.precioUnitario) * Number(item.cantidad);
          const count = await tx.venta.count({
            where: {
              empresaId: cotizacion.empresaId,
              numero: { startsWith: prefijo },
            },
          });
          const numero = `${prefijo}${String(count + 1).padStart(4, "0")}`;

          const venta = await tx.venta.create({
            data: {
              empresaId: cotizacion.empresaId,
              numero,
              clienteId: cotizacion.clienteId,
              vendedoraId: cotizacion.vendedoraId ?? null,
              fecha: fecha ? parseFechaColombia(fecha) : new Date(),
              medioPagoId: Number(medioPagoId),
              porcentajeComision: porcentaje,
              estadoId: estadoVenta.id,
              usu_creacion: user.codigo,
            },
          });
          // ── NUEVO (ronda 39) — el IVA "es de papá gobierno, no de la
          // joyería": la Venta es el evento fiscalmente vinculante, así
          // que su desglose de IVA se recalcula FRESCO aquí, con la
          // tarifa VIGENTE del producto en este instante — NUNCA se copia
          // el desglose ya congelado de la cotización (item.porcentajeIva),
          // porque si el % de IVA cambió entre el día que se cotizó y el
          // día que se vende, la venta debe reflejar la tarifa con la que
          // realmente se está cobrando hoy, no la que estaba vigente
          // cuando se cotizó (ver ejemplo del "día 15" acordado).
          const pctIvaVenta = Number(item.producto?.porcentajeIva ?? 19);
          const { baseGravable, valorIva } = calcularIvaDesglose(
            Number(item.precioUnitario),
            pctIvaVenta,
          );
          // ── NUEVO (ronda 42) — mismo principio que el IVA arriba: el
          // costo de producción se congela FRESCO en este instante (no se
          // copia ningún valor de la cotización, porque la Cotización no
          // trackea costo en absoluto). Es la base para calcular la
          // utilidad real que se reparte entre las socias.
          const { costoTotal: costoUnitario } = await calcularCostoProducto(
            item.producto,
            prisma,
          );
          await tx.ventaDetalle.create({
            data: {
              ventaId: venta.id,
              productoId: item.productoId,
              // ── FIX (confirmado por el usuario) — antes no se guardaba
              // ningún vínculo con la cotización de origen. Ahora apunta a
              // la línea (item), no a la cabeza — así origenLabel y el
              // historial funcionan aunque haya varios productos.
              cotizacionItemId: item.id,
              cantidad: item.cantidad,
              precioVenta: item.precioUnitario,
              subtotal,
              porcentajeIva: pctIvaVenta,
              baseGravable,
              valorIva,
              costoUnitario,
              usu_creacion: user.codigo,
            },
          });
          await tx.producto.update({
            where: { id: item.productoId },
            data: { enStock: { decrement: item.cantidad } },
          });
          ventas.push(
            await tx.venta.findUnique({
              where: { id: venta.id },
              include: {
                cliente: true,
                vendedora: true,
                medioPago: true,
                estado: true,
                repartos: true,
                items: {
                  include: {
                    producto: true,
                    cotizacionItem: { include: { cotizacion: true } },
                  },
                },
              },
            }),
          );
        }

        const estadoConv = await prisma.grupo.findFirst({
          where: {
            codigo: "CONV",
            subcatalogo: { codigo: "ESTC", catalogo: { codigo: "COTI" } },
          },
        });
        if (estadoConv) {
          await tx.cotizacion.update({
            where: { id: cotizacionId },
            data: {
              estadoId: estadoConv.id,
              version: { increment: 1 },
              usu_actualizacion: user.codigo,
            },
          });
        }

        return ventas;
      });
    },
  },
};

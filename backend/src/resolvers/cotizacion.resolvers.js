import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

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
            fecha: new Date(input.fecha),
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
            await tx.cotizacionItem.create({
              data: {
                cotizacionId: cot.id,
                productoId: p.productoId,
                precioUnitario: precio,
                cantidad: 1,
                subtotal: precio,
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
          fecha: new Date(dataLimpia.fecha),
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
      return prisma.cotizacionItem.create({
        data: { ...input, cantidad: input.cantidad ?? 1, subtotal },
        include: { producto: { include: { categoria: true } } },
      });
    },

    actualizarItemCotizacion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const subtotal = Number(data.precioUnitario) * Number(data.cantidad ?? 1);
      const result = await prisma.cotizacionItem.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          cantidad: data.cantidad ?? 1,
          subtotal,
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

    convertirEnVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { cotizacionId, medioPagoId, fecha } = input;
      const cotizacion = await prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        include: {
          items: { where: { deletedAt: null }, include: { producto: true } },
          estado: true,
        },
      });
      if (!cotizacion) throw new Error("Cotización no existe");
      validarEmpresa(cotizacion.empresaId, user.empresaActualId);
      if (!cotizacion.clienteId)
        throw new Error(
          "La cotización necesita una clienta para convertirse en venta",
        );
      if (cotizacion.items.length === 0)
        throw new Error("La cotización no tiene productos");
      if (cotizacion.items.length > 1)
        throw new Error(
          "Para cotizaciones con múltiples productos, cree una venta por cada pieza manualmente",
        );

      const item = cotizacion.items[0];
      const producto = item.producto;
      if (producto.enStock <= 0)
        throw new Error(`Sin stock para ${producto.nombre}`);

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
      const valorComision = (Number(item.precioUnitario) * porcentaje) / 100;

      return prisma.$transaction(async (tx) => {
        const venta = await tx.venta.create({
          data: {
            empresaId: cotizacion.empresaId,
            clienteId: cotizacion.clienteId,
            productoId: item.productoId,
            vendedoraId: cotizacion.vendedoraId ?? null,
            fecha: fecha ? new Date(fecha) : new Date(),
            precioVenta: item.precioUnitario,
            medioPagoId: Number(medioPagoId),
            porcentajeComision: porcentaje,
            valorComision,
            estadoId: estadoVenta.id,
            usu_creacion: user.codigo,
          },
          include: {
            cliente: true,
            producto: true,
            vendedora: true,
            medioPago: true,
            estado: true,
            repartos: true,
          },
        });

        await tx.producto.update({
          where: { id: item.productoId },
          data: { enStock: { decrement: 1 } },
        });

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

        return venta;
      });
    },
  },
};

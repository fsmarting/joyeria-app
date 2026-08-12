import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const incVenta = {
  cliente: true,
  producto: { include: { categoria: true } },
  vendedora: true,
  canal: true,
  medioPago: true,
  estado: true,
  // ── CAMBIO — antes: cotizacion: true. Ahora la venta apunta a la línea
  // (cotizacionItem), y de ahí subimos a la cabeza solo para origenLabel.
  cotizacionItem: { include: { cotizacion: true } },
  repartos: { where: { deletedAt: null }, include: { socio: true } },
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

export default {
  // ── Campo calculado: etiqueta de origen ─────────────────────
  Venta: {
    origenLabel: (v) => {
      if (v.cotizacionItem?.cotizacion?.numero)
        return `📋 ${v.cotizacionItem.cotizacion.numero}`;
      if (v.muestrarioItemId) return "🧳 Muestrario";
      return "🛍️ Directa";
    },
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
          { cliente: { nombre: { contains: t, mode: "insensitive" } } },
          { producto: { nombre: { contains: t, mode: "insensitive" } } },
          {
            cotizacionItem: {
              cotizacion: { numero: { contains: t, mode: "insensitive" } },
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
    crearVenta: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const cantidad = Number(input.cantidad ?? 1);
      if (cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      if (producto.enStock < cantidad)
        throw new Error(
          `Sin stock suficiente para ${producto.nombre}. Disponible: ${producto.enStock}`,
        );
      const { porcentaje } = await getComision(
        prisma,
        input.vendedoraId,
        input.medioPagoId,
        input.empresaId,
      );
      const valorComision =
        (Number(input.precioVenta) * cantidad * porcentaje) / 100;
      // ── CAMBIO — antes el estado inicial lo elegía el usuario en el
      // formulario. Ahora se calcula igual que en muestrario/cotización.
      const estado = await obtenerEstadoInicialVenta(prisma, input.medioPagoId);
      return prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: Number(input.productoId) },
          data: { enStock: { decrement: cantidad } },
        });
        return tx.venta.create({
          data: {
            ...input,
            cantidad,
            fecha: new Date(input.fecha),
            porcentajeComision: porcentaje,
            valorComision,
            estadoId: estado.id,
            usu_creacion: user.codigo,
          },
          include: incVenta,
        });
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

      const nuevaCantidad = Number(data.cantidad ?? original.cantidad ?? 1);
      if (nuevaCantidad <= 0)
        throw new Error("La cantidad debe ser mayor a 0");
      const cambiaProducto =
        Number(data.productoId) !== Number(original.productoId);
      const cambiaCantidad = nuevaCantidad !== Number(original.cantidad);

      const { porcentaje } = await getComision(
        prisma,
        data.vendedoraId,
        data.medioPagoId,
        original.empresaId,
      );
      const valorComision =
        (Number(data.precioVenta) * nuevaCantidad * porcentaje) / 100;

      await prisma.$transaction(async (tx) => {
        if (cambiaProducto) {
          // Devolver toda la cantidad original al producto anterior...
          await tx.producto.update({
            where: { id: original.productoId },
            data: { enStock: { increment: original.cantidad } },
          });
          // ...y descontar la cantidad nueva del producto nuevo.
          const nuevoProducto = await tx.producto.findUnique({
            where: { id: Number(data.productoId) },
          });
          if (!nuevoProducto || nuevoProducto.enStock < nuevaCantidad)
            throw new Error(
              `Sin stock suficiente para ${nuevoProducto?.nombre ?? "el producto"}`,
            );
          await tx.producto.update({
            where: { id: Number(data.productoId) },
            data: { enStock: { decrement: nuevaCantidad } },
          });
        } else if (cambiaCantidad) {
          const delta = nuevaCantidad - Number(original.cantidad);
          if (delta > 0) {
            const producto = await tx.producto.findUnique({
              where: { id: original.productoId },
            });
            if (!producto || producto.enStock < delta)
              throw new Error(
                `Sin stock suficiente para aumentar la cantidad. Disponible: ${producto?.enStock ?? 0}`,
              );
          }
          await tx.producto.update({
            where: { id: original.productoId },
            data: { enStock: { decrement: delta } },
          });
        }
        const result = await tx.venta.updateMany({
          where: { id: Number(id), version: Number(version) },
          data: {
            ...data,
            cantidad: nuevaCantidad,
            fecha: new Date(data.fecha),
            porcentajeComision: porcentaje,
            valorComision,
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });
        if (result.count === 0) throw new Error("Modificado por otro usuario");
      });
      return prisma.venta.findUnique({
        where: { id: Number(id) },
        include: incVenta,
      });
    },

    eliminarVenta: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.venta.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: original.productoId },
          data: { enStock: { increment: original.cantidad } },
        });
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
      if (!motivo?.trim()) throw new Error("El motivo de anulación es obligatorio");
      const venta = await prisma.venta.findUnique({
        where: { id: Number(id) },
        include: { estado: true },
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
        await tx.producto.update({
          where: { id: venta.productoId },
          data: { enStock: { increment: venta.cantidad } },
        });
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

    guardarReparto: async (_, { ventaId, repartos }, { prisma, user }) => {
      requireAuth(user);
      const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
      if (!venta) throw new Error("Venta no existe");
      validarEmpresa(venta.empresaId, user.empresaActualId);
      const totalPct = repartos.reduce((s, r) => s + Number(r.porcentaje), 0);
      if (Math.round(totalPct) !== 100)
        throw new Error(
          `Los porcentajes deben sumar 100% (actual: ${totalPct}%)`,
        );
      const totalVenta = Number(venta.precioVenta) * Number(venta.cantidad);
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

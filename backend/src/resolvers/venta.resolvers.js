import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const incVenta = {
  cliente: true,
  producto: { include: { categoria: true } },
  vendedora: true,
  canal: true,
  medioPago: true,
  estado: true,
  cotizacion: true,
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

export default {
  // ── Campo calculado: etiqueta de origen ─────────────────────
  Venta: {
    origenLabel: (v) => {
      if (v.cotizacion?.numero) return `📋 ${v.cotizacion.numero}`;
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
          { cotizacion: { numero: { contains: t, mode: "insensitive" } } },
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
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      if (producto.enStock <= 0)
        throw new Error(`Sin stock disponible para ${producto.nombre}`);
      const { porcentaje } = await getComision(
        prisma,
        input.vendedoraId,
        input.medioPagoId,
        input.empresaId,
      );
      const valorComision = (Number(input.precioVenta) * porcentaje) / 100;
      return prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: Number(input.productoId) },
          data: { enStock: { decrement: 1 } },
        });
        return tx.venta.create({
          data: {
            ...input,
            fecha: new Date(input.fecha),
            porcentajeComision: porcentaje,
            valorComision,
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
      });
      if (!original) throw new Error("Venta no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const cambiaProducto =
        Number(data.productoId) !== Number(original.productoId);
      const { porcentaje } = await getComision(
        prisma,
        data.vendedoraId,
        data.medioPagoId,
        original.empresaId,
      );
      const valorComision = (Number(data.precioVenta) * porcentaje) / 100;
      await prisma.$transaction(async (tx) => {
        if (cambiaProducto) {
          await tx.producto.update({
            where: { id: original.productoId },
            data: { enStock: { increment: 1 } },
          });
          await tx.producto.update({
            where: { id: Number(data.productoId) },
            data: { enStock: { decrement: 1 } },
          });
        }
        const result = await tx.venta.updateMany({
          where: { id: Number(id), version: Number(version) },
          data: {
            ...data,
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
          data: { enStock: { increment: 1 } },
        });
        await tx.venta.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
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
                valor: (Number(venta.precioVenta) * Number(r.porcentaje)) / 100,
              },
              include: { socio: true },
            }),
          ),
        );
      });
    },
  },
};

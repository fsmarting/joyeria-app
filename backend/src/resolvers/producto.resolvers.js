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

const calcCosteo = (p) => {
  const costoPiedras = (p.piedras || []).reduce(
    (s, pp) => s + Number(pp.costoEstandardTotal),
    0,
  );
  const costoOro = Number(p.gramosOro) * Number(p.costoGramoOroUsado);
  const costoTotal =
    costoPiedras + costoOro + Number(p.costoManoObra) + Number(p.costoOtros);
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
  return {
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
};

export default {
  Producto: {
    multiplicador: (p) => Number(p.multiplicador ?? 2.25),
    costoPiedras: (p) => calcCosteo(p).costoPiedras,
    costoOro: (p) => calcCosteo(p).costoOro,
    costoTotal: (p) => calcCosteo(p).costoTotal,
    precioSugerido: (p) => calcCosteo(p).precioSugerido,
    pvpConIva: (p) => calcCosteo(p).pvpConIva,
    margen: (p) => calcCosteo(p).margen,
    ivaValor: (p) => calcCosteo(p).ivaValor,
    conTarjeta: (p) => calcCosteo(p).conTarjeta,
    comisionMax: (p) => calcCosteo(p).comisionMax,
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
      console.log("Existe...", existe);
      console.log("!!Existe...", !!existe);
      return !!existe;
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
  },
};

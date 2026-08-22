import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

// ── CAMBIO (ronda 46) — "tipo: true" se retira (ya no existe esa
// relación); se agrega "roles" con el mismo patrón de "especialidades".
const inc = {
  tipoDocumento: true,
  tier: true,
  canal: true,
  especialidades: {
    where: { deletedAt: null },
    include: { especialidad: true },
    orderBy: [{ esPrincipal: "desc" }, { especialidad: { nombre: "asc" } }],
  },
  roles: {
    where: { deletedAt: null },
    include: { rol: true },
    orderBy: { rol: { nombre: "asc" } },
  },
};

// ── NUEVO (ronda 46) — condición reutilizable "tiene el rol X entre los
// suyos" (reemplaza el antiguo "tipo: { codigo: tipoCodigo }"). Se usa en
// los dos puntos donde antes se filtraba por tipo único.
const conRol = (tipoCodigo) => ({
  some: { deletedAt: null, rol: { codigo: tipoCodigo } },
});

export default {
  Query: {
    tercerosFiltradosCursor: async (
      _,
      {
        first = 10,
        after = null,
        orden = [],
        direccion = [],
        busqueda = "",
        tipoCodigo = null,
      },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (tipoCodigo) where.roles = conRol(tipoCodigo);
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { nombre: { contains: t, mode: "insensitive" } },
          { telefono: { contains: t, mode: "insensitive" } },
          { ciudad: { contains: t, mode: "insensitive" } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ nombre: "asc" }];
      const items = await prisma.tercero.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: inc,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.tercero.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    obtenerTercerosPorTipo: (_, { tipoCodigo }, { prisma, user }) => {
      requireAuth(user);
      return prisma.tercero.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          activo: true,
          roles: conRol(tipoCodigo),
        },
        orderBy: { nombre: "asc" },
        include: inc,
      });
    },
  },

  Mutation: {
    // ── CAMBIO (ronda 46) — antes creaba con "tipoId" (columna propia
    // del Tercero). Ahora "rolId" llega en el input y se crea como la
    // primera fila de TerceroRol, dentro del mismo create anidado — el
    // tercero nunca queda sin al menos un rol.
    crearTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const { rolId, ...data } = input;
      return prisma.tercero.create({
        data: {
          ...data,
          activo: input.activo ?? true,
          usu_creacion: user.codigo,
          roles: { create: [{ rolId }] },
        },
        include: inc,
      });
    },

    actualizarTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.tercero.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("Tercero no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.tercero.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.tercero.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },

    eliminarTercero: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.tercero.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.tercero.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },

    agregarEspecialidadTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({
        where: { id: input.terceroId },
      });
      if (!tercero) throw new Error("Tercero no existe");
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      const existe = await prisma.terceroEspecialidad.findFirst({
        where: {
          terceroId: input.terceroId,
          especialidadId: input.especialidadId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error("Ya tiene esa especialidad");
      return prisma.terceroEspecialidad.create({
        data: { ...input, esPrincipal: input.esPrincipal ?? false },
        include: { especialidad: true },
      });
    },

    removerEspecialidadTercero: async (
      _,
      { terceroId, especialidadId },
      { prisma, user },
    ) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({
        where: { id: terceroId },
      });
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      await prisma.terceroEspecialidad.updateMany({
        where: { terceroId, especialidadId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return true;
    },

    actualizarNivelEspecialidadTercero: async (
      _,
      { terceroId, especialidadId, nivel, esPrincipal },
      { prisma, user },
    ) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({
        where: { id: terceroId },
      });
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      const record = await prisma.terceroEspecialidad.findFirst({
        where: { terceroId, especialidadId, deletedAt: null },
      });
      if (!record) throw new Error("No existe esa especialidad");
      return prisma.terceroEspecialidad.update({
        where: { id: record.id },
        data: { nivel, esPrincipal: esPrincipal ?? record.esPrincipal },
        include: { especialidad: true },
      });
    },

    // ── NUEVO (ronda 46) — agregar un rol adicional a un tercero que ya
    // existe (ej: un Joyero que también empieza a comprar como Cliente).
    // Mismo patrón que agregarEspecialidadTercero.
    agregarRolTercero: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({
        where: { id: input.terceroId },
      });
      if (!tercero) throw new Error("Tercero no existe");
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      const existe = await prisma.terceroRol.findFirst({
        where: {
          terceroId: input.terceroId,
          rolId: input.rolId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error("Ya tiene ese rol");
      return prisma.terceroRol.create({
        data: { terceroId: input.terceroId, rolId: input.rolId },
        include: { rol: true },
      });
    },

    // ── NUEVO (ronda 46) — un tercero siempre debe quedar con al menos
    // un rol; si es el último, se rechaza (para eso existe eliminarTercero).
    removerRolTercero: async (_, { terceroId, rolId }, { prisma, user }) => {
      requireAuth(user);
      const tercero = await prisma.tercero.findUnique({
        where: { id: terceroId },
      });
      if (!tercero) throw new Error("Tercero no existe");
      validarEmpresa(tercero.empresaId, user.empresaActualId);
      const cuantos = await prisma.terceroRol.count({
        where: { terceroId, deletedAt: null },
      });
      if (cuantos <= 1)
        throw new Error(
          "Un tercero debe conservar al menos un rol — si ya no aplica, elimínelo en su lugar",
        );
      await prisma.terceroRol.updateMany({
        where: { terceroId, rolId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return true;
    },
  },
};

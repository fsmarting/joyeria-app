import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

// ⚠️ producto.include DEBE traer también "piedras" (el BOM) — la query
// del frontend (ORDEN_FIELDS → PRODUCTO_BOM_FIELDS) pide orden.producto.piedras
// para calcular las sugerencias de insumos. Producto.piedras es un campo NO
// nullable en el schema GraphQL ([ProductoPiedra!]!); si Prisma no lo incluye
// aquí llega undefined y GraphQL truena con "Cannot return null for
// non-nullable field Producto.piedras." — este include debe reflejar el
// mismo shape que incBom.piedras en producto.resolvers.js.
const incluirOrden = {
  producto: {
    include: {
      categoria: true,
      piedras: {
        where: { deletedAt: null },
        include: {
          piedra: { include: { tipo: true, unidad: true } },
          tipoPiedra: true,
        },
        orderBy: [{ tipoId: "asc" }, { id: "asc" }],
      },
    },
  },
  joyero: true,
  estado: true,
  detalles: {
    where: { deletedAt: null },
    include: {
      // ── CAMBIO — CompraInsumo ya no trae numero/fecha propios (ahora
      // viven en su cabeza Compra) — se agrega `compra: true` para que
      // el frontend pueda mostrar compraInsumo.compra.numero/fecha.
      compraInsumo: {
        include: {
          piedra: { include: { tipo: true, unidad: true } },
          compra: true,
        },
      },
      piedra: { include: { tipo: true, unidad: true } },
      // 🩹 antes `movimientos` no incluía `compraInsumo` — el campo
      // MovimientoInsumoOrden.compraInsumo que ya pedía el frontend
      // (columna "Lote" en el historial e "Imprimir remisión") quedaba
      // siempre null porque Prisma nunca lo traía. Se agrega el include
      // aquí, con compra ya anidada para lo mismo de arriba.
      movimientos: {
        where: { deletedAt: null },
        orderBy: { fecha: "asc" },
        include: { compraInsumo: { include: { compra: true } } },
      },
    },
    orderBy: { id: "asc" },
  },
  entregas: {
    where: { deletedAt: null },
    orderBy: { fecha: "asc" },
  },
};

const incluirDetalle = {
  compraInsumo: {
    include: {
      piedra: { include: { tipo: true, unidad: true } },
      compra: true,
    },
  },
  piedra: { include: { tipo: true, unidad: true } },
  movimientos: {
    where: { deletedAt: null },
    orderBy: { fecha: "asc" },
    include: { compraInsumo: { include: { compra: true } } },
  },
};

// ── NUEVO — ciclo de vida de estados de la orden manejado por el
// sistema ────────────────────────────────────────────────────────
// Antes, estadoId era un campo 100% manual (el usuario lo escogía desde
// el formulario genérico). Deber ser acordado con el usuario: el ciclo
// normal Pendiente → En proceso → Entregada lo debe mover el sistema
// solo, con datos que ya calcula (primer insumo entregado, entrega
// completa); "Cancelada" es la única transición que sigue siendo
// decisión manual, pero ahora vive en su propia mutation
// (cancelarOrdenProduccion) con reglas — no en un simple cambio de
// campo. Catálogo confirmado por el usuario: PRODU / EORD, con
// códigos PEND / PROC / ENTR / CANC (el campo `codigo` es el
// identificador estable — no depender del `nombre`, que se puede
// editar desde Admin sin que esto se entere).
const ESTADO_ORDEN = { catalogoCodigo: "PRODU", subcatalogoCodigo: "EORD" };

const obtenerEstadoOrdenId = async (prisma, empresaId, codigo) => {
  const grupo = await prisma.grupo.findFirst({
    where: {
      codigo,
      deletedAt: null,
      subcatalogo: {
        codigo: ESTADO_ORDEN.subcatalogoCodigo,
        deletedAt: null,
        catalogo: {
          codigo: ESTADO_ORDEN.catalogoCodigo,
          empresaId,
          deletedAt: null,
        },
      },
    },
  });
  if (!grupo) {
    throw new Error(
      `No existe el estado de orden '${codigo}' en el catálogo ${ESTADO_ORDEN.catalogoCodigo}/${ESTADO_ORDEN.subcatalogoCodigo}. Verifique Admin → Grupos.`,
    );
  }
  return grupo.id;
};

// Genera el número de remisión automático: REM-{numeroOrden}-{consecutivo}
const generarNumeroRemision = async (
  prisma,
  ordenProduccionId,
  numeroOrden,
) => {
  const count = await prisma.entregaOrden.count({
    where: { ordenProduccionId, deletedAt: null },
  });
  const consecutivo = String(count + 1).padStart(2, "0");
  return `REM-${numeroOrden}-${consecutivo}`;
};

// ── NUEVO — remisión de envío de insumos ──────────────────────────
// Contraparte de generarNumeroRemision (que es para cuando el joyero
// ENTREGA piezas producidas). Esta es para cuando Río Rayo ENVÍA
// insumos al joyero — deber ser acordado con el usuario: un envío de
// material de alto valor (oro, piedras) a alguien externo a la empresa
// debería quedar respaldado por un documento firmable, no solo un
// registro en pantalla. Solo aplica a movimientos de salida (INICIAL
// al crear el detalle, ADICIONAL si se le envía más después) — las
// DEVOLUCION son la dirección contraria (el joyero regresa material) y
// por ahora no generan su propia remisión.
const generarNumeroRemisionEnvio = async (
  prisma,
  ordenProduccionId,
  numeroOrden,
) => {
  const count = await prisma.movimientoInsumoOrden.count({
    where: {
      detalle: { ordenProduccionId },
      tipoMovimiento: { in: ["INICIAL", "ADICIONAL"] },
      deletedAt: null,
    },
  });
  const consecutivo = String(count + 1).padStart(2, "0");
  return `REM-ENV-${numeroOrden}-${consecutivo}`;
};

// ── NUEVO — número de orden de producción automático ────────────────
// Antes lo escribía el usuario a mano (ej. "OP-2026-001") y el resolver
// solo validaba que no estuviera repetido — riesgo de typos, formatos
// distintos entre usuarios, o el error "el número ya existe" a mitad de
// captura. Ahora se genera solo, mismo criterio que las remisiones
// (REM-.../REM-ENV-...): un prefijo + consecutivo, contando lo que ya
// existe. Se reinicia por año (OP-2026-001, OP-2027-001, ...) porque así
// es como el usuario ya nombraba sus órdenes a mano.
const generarNumeroOrden = async (prisma, empresaId) => {
  const anio = new Date().getFullYear();
  const prefijo = `OP-${anio}-`;
  const count = await prisma.ordenProduccion.count({
    where: { empresaId, numero: { startsWith: prefijo } },
  });
  const consecutivo = String(count + 1).padStart(3, "0");
  return `${prefijo}${consecutivo}`;
};

// ── Conciliación teórica de insumos (solo lectura) ─────────────────
// Ver Manual de Operación v5 §6.6. Compara lo enviado (neto de
// devoluciones) contra lo que "debería" consumirse según la línea del
// BOM del producto (cantidad por unidad + % desperdicio) multiplicada
// por las piezas realmente entregadas hasta ahora. No mueve inventario
// ni bloquea nada — es un cálculo de apoyo para detectar desperdicio
// mayor al esperado o material del joyero pendiente de devolver.
//
// Nota de rendimiento: esto hace una consulta por línea de detalle
// (para traer cantidadEntregada de la orden y el BOM del producto),
// igual que calcCosteoAsync en producto.resolvers.js hace una consulta
// por línea de oro — aceptable porque una orden normalmente tiene pocas
// líneas de insumo. Se cachea en el propio objeto (d.__conciliacion)
// para no repetir la consulta entre los 3 campos que la usan.
const calcConciliacionAsync = async (d, prisma) => {
  if (d.__conciliacion) return d.__conciliacion;

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: d.ordenProduccionId },
    select: {
      cantidadEntregada: true,
      producto: {
        select: {
          piedras: {
            where: { deletedAt: null },
            select: { piedraId: true, cantidad: true, desperdicio: true },
          },
        },
      },
    },
  });

  const bomLine = orden?.producto?.piedras.find(
    (pp) => pp.piedraId === d.piedraId,
  );
  const cantidadEntregada = Number(orden?.cantidadEntregada ?? 0);

  let consumoTeorico = null;
  if (bomLine) {
    const base = Number(bomLine.cantidad) * cantidadEntregada;
    consumoTeorico = base + base * (Number(bomLine.desperdicio ?? 0) / 100);
  }

  const enviadoNeto =
    Number(d.cantidadEnviada ?? 0) - Number(d.cantidadDevuelta ?? 0);
  const diferenciaVsTeorico =
    consumoTeorico != null ? enviadoNeto - consumoTeorico : null;

  d.__conciliacion = { consumoTeorico, enviadoNeto, diferenciaVsTeorico };
  return d.__conciliacion;
};

export default {
  DetalleOrdenProduccion: {
    // ── CAMBIO (ronda 36) — antes: cantidadEnviada − cantidadDevuelta.
    // Ahora también resta cantidadConsumida (lo que ya se dio por
    // convertido en producto terminado real, actualizado en cada
    // entrega) — así "Sin devolver" deja de mostrar de por vida algo
    // que el joyero, en la práctica, ya no tiene porque se volvió pieza.
    merma: (d) => {
      const e = Number(d.cantidadEnviada),
        r = Number(d.cantidadDevuelta),
        c = Number(d.cantidadConsumida ?? 0);
      const val = e - r - c;
      return val > 0 ? Math.round(val * 10000) / 10000 : 0;
    },
    consumoTeorico: async (d, _, { prisma }) =>
      (await calcConciliacionAsync(d, prisma)).consumoTeorico,
    enviadoNeto: async (d, _, { prisma }) =>
      (await calcConciliacionAsync(d, prisma)).enviadoNeto,
    diferenciaVsTeorico: async (d, _, { prisma }) =>
      (await calcConciliacionAsync(d, prisma)).diferenciaVsTeorico,
  },
  MovimientoInsumoOrden: {
    fecha: (m) => (m.fecha ? new Date(m.fecha).toISOString() : null),
  },
  OrdenProduccion: {
    fechaEnvio: (o) =>
      o.fechaEnvio ? new Date(o.fechaEnvio).toISOString() : null,
    fechaEstimada: (o) =>
      o.fechaEstimada ? new Date(o.fechaEstimada).toISOString() : null,
    fechaEntrega: (o) =>
      o.fechaEntrega ? new Date(o.fechaEntrega).toISOString() : null,
  },
  EntregaOrden: {
    fecha: (e) => (e.fecha ? new Date(e.fecha).toISOString() : null),
  },

  Query: {
    ordenesFiltradosCursor: async (
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
          { producto: { nombre: { contains: t, mode: "insensitive" } } },
          { joyero: { nombre: { contains: t, mode: "insensitive" } } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ fechaEnvio: "desc" }];
      const items = await prisma.ordenProduccion.findMany({
        where,
        take: first,
        skip: after ? 1 : 0,
        cursor: after ? { id: Number(after) } : undefined,
        orderBy: orderByClause,
        include: incluirOrden,
      });
      const last = items[items.length - 1];
      return {
        edges: items.map((item) => ({ node: item, cursor: String(item.id) })),
        pageInfo: {
          endCursor: last ? String(last.id) : null,
          hasNextPage: last
            ? (await prisma.ordenProduccion.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },

    // ── NUEVO — histórico de costo por producto (solo lectura) ─────
    // Ver Manual de Operación v5 §6.x. A propósito NO usa `incluirOrden`
    // (sería traer BOM + detalles + entregas de hasta 50 órdenes solo
    // para mostrar una tabla de 4 columnas) — el query del frontend solo
    // pide campos escalares de OrdenProduccion, así que no hace falta.
    // Si en el futuro se agrega aquí un campo que dependa de una relación
    // (producto, detalles, entregas), hay que agregar el include
    // correspondiente o va a fallar igual que Producto.piedras falló antes.
    historicoCostoOrdenes: async (
      _,
      { productoId, limit = 10 },
      { prisma, user },
    ) => {
      requireAuth(user);
      const producto = await prisma.producto.findUnique({
        where: { id: Number(productoId) },
      });
      if (!producto) throw new Error("Producto no existe");
      validarEmpresa(producto.empresaId, user.empresaActualId);
      return prisma.ordenProduccion.findMany({
        where: {
          productoId: Number(productoId),
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
        orderBy: { fechaEnvio: "desc" },
        take: Math.min(Number(limit) || 10, 50),
      });
    },
  },

  Mutation: {
    crearOrdenProduccion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const producto = await prisma.producto.findUnique({
        where: { id: Number(input.productoId) },
        include: { piedras: true },
      });
      if (!producto) throw new Error("Producto no existe");
      const costoInsumos = producto.piedras.reduce(
        (s, pp) => s + Number(pp.costoEstandardTotal),
        0,
      );
      const costoUnitarioEstandard =
        costoInsumos +
        Number(producto.costoManoObra) +
        Number(producto.costoOtros);
      const costoTotalEstandard =
        costoUnitarioEstandard * Number(input.cantidadProgramada);
      // ── NUEVO — el estado inicial SIEMPRE es Pendiente, sin importar
      // lo que venga en input.estadoId (en el formulario el campo ya
      // quedó oculto/solo-lectura, pero se protege también aquí).
      const pendienteId = await obtenerEstadoOrdenId(
        prisma,
        user.empresaActualId,
        "PEND",
      );
      // ── NUEVO — el número de orden ya no lo escribe el usuario (ver
      // generarNumeroOrden arriba); lo que venga en input.numero se
      // ignora y se pisa con el generado aquí.
      const numero = await generarNumeroOrden(prisma, user.empresaActualId);
      return prisma.ordenProduccion.create({
        data: {
          ...input,
          numero,
          estadoId: pendienteId,
          fechaEnvio: new Date(input.fechaEnvio),
          fechaEstimada: input.fechaEstimada
            ? new Date(input.fechaEstimada)
            : null,
          costoUnitarioEstandard,
          costoTotalEstandard,
          cantidadEntregada: 0,
          valorEntregado: 0,
          usu_creacion: user.codigo,
        },
        include: incluirOrden,
      });
    },

    actualizarOrdenProduccion: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      // ── NUEVO — estadoId ya no se acepta desde el formulario genérico
      // de edición (lo mueve el sistema, o cancelarOrdenProduccion) —
      // se descarta aunque venga con un valor. Lo mismo con numero: una
      // vez generado al crear la orden, queda fijo — no tiene sentido
      // dejarlo editar a mano (rompería la trazabilidad con las
      // remisiones, que ya usan este número como parte del suyo).
      const { id, version, estadoId, numero, ...data } = input;
      const original = await prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: {
          detalles: { where: { deletedAt: null }, select: { id: true } },
        },
      });
      if (!original) throw new Error("Orden no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      // ── NUEVO — deber ser acordado con el usuario: cantidadProgramada
      // solo se puede modificar mientras la orden todavía no tiene
      // ningún insumo enviado (sin DetalleOrdenProduccion). Una vez se
      // confirmó el primer insumo del BOM, el material ya se compró/
      // envió pensando en esa cantidad — cambiarla después borraría esa
      // historia y descuadraría el costo total estándar (costo unitario
      // × cantidad programada). El formulario ya la deja de solo
      // lectura en ese caso; esto es el respaldo del lado del servidor.
      if (original.detalles.length > 0)
        data.cantidadProgramada = original.cantidadProgramada;
      const costoTotalEstandard =
        Number(original.costoUnitarioEstandard) *
        Number(data.cantidadProgramada);
      const result = await prisma.ordenProduccion.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          fechaEnvio: new Date(data.fechaEnvio),
          fechaEstimada: data.fechaEstimada
            ? new Date(data.fechaEstimada)
            : null,
          fechaEntrega: data.fechaEntrega ? new Date(data.fechaEntrega) : null,
          costoTotalEstandard,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: incluirOrden,
      });
    },

    // ── REGISTRAR ENTREGA — genera remisión automática ────────────
    registrarEntregaOrden: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const {
        ordenProduccionId,
        cantidad,
        cantidadJoyero,
        numeroJoyero,
        nota,
      } = input;

      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: ordenProduccionId },
        // ── CAMBIO (ronda 36) — se agrega `detalles` para poder calcular,
        // línea por línea del BOM, cuánto insumo se da por consumido con
        // esta entrega (Mecanismo 1, ver más abajo).
        include: { estado: true, detalles: { where: { deletedAt: null } } },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);
      // ── NUEVO — no se puede recibir producto de una orden cancelada.
      if (orden.estado?.codigo === "CANC")
        throw new Error(
          "Esta orden está cancelada — no se pueden registrar entregas",
        );

      const pendientes = orden.cantidadProgramada - orden.cantidadEntregada;
      if (cantidad > pendientes)
        throw new Error(
          `Solo quedan ${pendientes} piezas pendientes de entrega`,
        );

      // Determinar estado de conciliación inicial
      const hasDiferencia =
        cantidadJoyero !== null &&
        cantidadJoyero !== undefined &&
        cantidadJoyero !== cantidad;
      const estadoConciliacion = hasDiferencia ? "DISPUTA" : "PENDIENTE";

      const valorPorUnidad = Number(orden.costoUnitarioEstandard);
      const valorEntregado = cantidad * valorPorUnidad;
      const esFinal =
        orden.cantidadEntregada + cantidad >= orden.cantidadProgramada;
      // ── NUEVO — si esta entrega completa la orden, el estado pasa
      // solo a "Entregada" (mismo momento en que ya se guardaba fechaEntrega).
      const entregadaId = esFinal
        ? await obtenerEstadoOrdenId(prisma, orden.empresaId, "ENTR")
        : null;

      // Generar número de remisión automático
      const numeroRemision = await generarNumeroRemision(
        prisma,
        ordenProduccionId,
        orden.numero,
      );

      await prisma.$transaction(async (tx) => {
        await tx.entregaOrden.create({
          data: {
            ordenProduccionId,
            numeroRemision,
            numeroJoyero: numeroJoyero ?? null,
            cantidad,
            cantidadJoyero: cantidadJoyero ?? null,
            valorEntregado,
            estadoConciliacion,
            nota: nota ?? null,
            usu_creacion: user.codigo,
          },
        });

        await tx.ordenProduccion.update({
          where: { id: ordenProduccionId },
          data: {
            cantidadEntregada: { increment: cantidad },
            valorEntregado: { increment: valorEntregado },
            ...(esFinal && { fechaEntrega: new Date(), estadoId: entregadaId }),
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });

        await tx.producto.update({
          where: { id: orden.productoId },
          data: { enStock: { increment: cantidad } },
        });

        // ── NUEVO (ronda 36) — Mecanismo 1: consumo de insumo por esta
        // entrega, acordado con el usuario. Por cada línea del BOM de
        // esta orden, la porción que corresponde a las `cantidad` piezas
        // que se están entregando AHORA se da por consumida — ya se
        // convirtió en producto terminado, deja de estar "en poder del
        // joyero". Se registran DOS movimientos (no uno), para que el
        // historial cuente la historia completa: el insumo "vuelve" al
        // sistema encarnado en la pieza (ENTRADA_CONSUMO, cierra la
        // custodia) y de inmediato "sale" porque se consumió
        // (SALIDA_CONSUMO, puramente informativo — la custodia ya quedó
        // cerrada en la línea de arriba). Ninguna de las dos toca
        // `compraInsumo.cantidadDisponible`: el insumo ya había salido
        // del inventario disponible cuando se envió al joyero, y no
        // vuelve a existir como materia prima. Esto es solo para el
        // flujo NORMAL (piezas que sí se entregaron) — qué pasa con
        // insumo enviado que NUNCA se convierte en pieza (orden cerrada
        // con faltante) queda fuera de este cambio, a propósito.
        // 🩹 FIX (ronda 37) — `d.cantidad` es la cantidad POR PIEZA del
        // BOM (ver SugerenciaRow en OrdenProduccion.jsx: `cantidad:
        // Number(bom.cantidad)`, SIN multiplicar por cantidadProgramada
        // — lo que sí se multiplica es cantidadEnviada/costoTotal). La
        // fórmula anterior volvía a dividir por cantidadProgramada,
        // dejando el consumo cantidadProgramada veces más chico de lo
        // real (ej. orden de 5 piezas: consumía 1/5 de lo que debía).
        for (const d of orden.detalles) {
          const consumoLinea =
            Math.round(Number(d.cantidad) * cantidad * 10000) / 10000;
          if (consumoLinea <= 0) continue;
          const valorConsumidoLinea =
            Math.round(consumoLinea * Number(d.costoUnitario) * 100) / 100;
          const notaAuto = `Consumo automático — entrega de ${cantidad} unidad${cantidad === 1 ? "" : "es"} (remisión ${numeroRemision})`;

          await tx.movimientoInsumoOrden.create({
            data: {
              detalleOrdenProduccionId: d.id,
              compraInsumoId: d.compraInsumoId,
              tipoMovimiento: "ENTRADA_CONSUMO",
              cantidad: consumoLinea,
              valor: valorConsumidoLinea,
              nota: notaAuto,
              usu_creacion: user.codigo,
            },
          });
          await tx.movimientoInsumoOrden.create({
            data: {
              detalleOrdenProduccionId: d.id,
              compraInsumoId: d.compraInsumoId,
              tipoMovimiento: "SALIDA_CONSUMO",
              cantidad: consumoLinea,
              valor: valorConsumidoLinea,
              nota: notaAuto,
              usu_creacion: user.codigo,
            },
          });
          await tx.detalleOrdenProduccion.update({
            where: { id: d.id },
            data: {
              cantidadConsumida: { increment: consumoLinea },
              valorConsumido: { increment: valorConsumidoLinea },
              usu_actualizacion: user.codigo,
            },
          });
        }
      });

      return prisma.ordenProduccion.findUnique({
        where: { id: ordenProduccionId },
        include: incluirOrden,
      });
    },

    // ── CONCILIAR ENTREGA ────────────────────────────────────────
    conciliarEntrega: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, estadoConciliacion, notaConciliacion } = input;
      const entrega = await prisma.entregaOrden.findUnique({
        where: { id: Number(id) },
        include: { ordenProduccion: true },
      });
      if (!entrega) throw new Error("Entrega no existe");
      validarEmpresa(entrega.ordenProduccion.empresaId, user.empresaActualId);
      const result = await prisma.entregaOrden.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          estadoConciliacion,
          notaConciliacion: notaConciliacion ?? null,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.entregaOrden.findUnique({ where: { id: Number(id) } });
    },

    eliminarOrdenProduccion: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: {
          detalles: {
            where: { deletedAt: null },
            include: { movimientos: { where: { deletedAt: null } } },
          },
        },
      });
      if (!original) throw new Error("Orden no existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      if (original.cantidadEntregada > 0)
        throw new Error(
          "No se puede eliminar una orden con entregas registradas",
        );
      await prisma.$transaction(async (tx) => {
        // Revierte cada movimiento (envíos devuelven stock, devoluciones lo restan)
        // en vez de asumir un solo lote por línea — un detalle puede tener envíos
        // adicionales desde lotes distintos al inicial.
        for (const d of original.detalles) {
          for (const m of d.movimientos) {
            const ajuste =
              m.tipoMovimiento === "DEVOLUCION"
                ? -Number(m.cantidad)
                : Number(m.cantidad);
            await tx.compraInsumo.update({
              where: { id: m.compraInsumoId },
              data: { cantidadDisponible: { increment: ajuste } },
            });
          }
        }
        await tx.ordenProduccion.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },

    // ── AGREGAR DETALLE — crea la línea + su movimiento INICIAL ───
    agregarDetalleOrden: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: input.ordenProduccionId },
        include: { estado: true },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);
      // ── NUEVO — no se puede enviar más insumo a una orden cancelada.
      if (orden.estado?.codigo === "CANC")
        throw new Error(
          "Esta orden está cancelada — no se pueden enviar insumos",
        );
      const compra = await prisma.compraInsumo.findUnique({
        where: { id: input.compraInsumoId },
      });
      if (!compra) throw new Error("El lote de compra no existe");
      if (Number(compra.cantidadDisponible) < Number(input.cantidadEnviada))
        throw new Error(
          `Stock insuficiente. Disponible: ${compra.cantidadDisponible}`,
        );

      // ── NUEVO — primer insumo entregado: la orden pasa de Pendiente a
      // En proceso. Transición atómica (updateMany con el estadoId
      // actual en el where) para no pisar un estado distinto si esto se
      // llama después de que la orden ya avanzó.
      const pendienteId = await obtenerEstadoOrdenId(
        prisma,
        orden.empresaId,
        "PEND",
      );
      const procesoId = await obtenerEstadoOrdenId(
        prisma,
        orden.empresaId,
        "PROC",
      );
      // ── NUEVO — remisión de envío para este insumo.
      const numeroRemisionEnvio = await generarNumeroRemisionEnvio(
        prisma,
        orden.id,
        orden.numero,
      );

      return prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({
          where: { id: input.compraInsumoId },
          data: {
            cantidadDisponible: { decrement: Number(input.cantidadEnviada) },
          },
        });

        const detalle = await tx.detalleOrdenProduccion.create({
          data: {
            ...input,
            desperdicio: input.desperdicio ?? 0,
            cantidadDevuelta: 0,
            valorDevuelto: 0,
            usu_creacion: user.codigo,
          },
        });

        await tx.movimientoInsumoOrden.create({
          data: {
            detalleOrdenProduccionId: detalle.id,
            compraInsumoId: input.compraInsumoId,
            tipoMovimiento: "INICIAL",
            cantidad: Number(input.cantidadEnviada),
            valor: Number(input.valorEnviado),
            numeroRemision: numeroRemisionEnvio,
            usu_creacion: user.codigo,
          },
        });

        await tx.ordenProduccion.updateMany({
          where: { id: orden.id, estadoId: pendienteId },
          data: { estadoId: procesoId },
        });

        return tx.detalleOrdenProduccion.findUnique({
          where: { id: detalle.id },
          include: incluirDetalle,
        });
      });
    },

    // ── NUEVO — confirmar varios insumos del BOM en un solo envío ───
    // Contraparte "por lote" de agregarDetalleOrden. Deber ser acordado
    // con el usuario: si varios insumos se entregan juntos al joyero en
    // un solo paquete físico, deben compartir UNA sola remisión — antes,
    // cada "Confirmar envío" generaba su propio número aunque todo
    // saliera el mismo día en la misma bolsa.
    agregarDetallesOrdenLote: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { ordenProduccionId, detalles } = input;
      if (!detalles?.length) throw new Error("Debe incluir al menos un insumo");

      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: Number(ordenProduccionId) },
        include: { estado: true },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);
      if (orden.estado?.codigo === "CANC")
        throw new Error(
          "Esta orden está cancelada — no se pueden enviar insumos",
        );

      // Validar stock de cada lote ANTES de mover nada — evita dejar
      // movimientos parciales si uno de los lotes no alcanza a mitad
      // del lote de envíos.
      for (const d of detalles) {
        const compra = await prisma.compraInsumo.findUnique({
          where: { id: Number(d.compraInsumoId) },
        });
        if (!compra)
          throw new Error(`El lote de compra ${d.compraInsumoId} no existe`);
        if (Number(compra.cantidadDisponible) < Number(d.cantidadEnviada))
          throw new Error(
            `Stock insuficiente en el lote ${compra.numero}. Disponible: ${compra.cantidadDisponible}`,
          );
      }

      const pendienteId = await obtenerEstadoOrdenId(
        prisma,
        orden.empresaId,
        "PEND",
      );
      const procesoId = await obtenerEstadoOrdenId(
        prisma,
        orden.empresaId,
        "PROC",
      );
      // ── UNA sola remisión para todo el lote (se genera una vez, se
      // reutiliza en cada línea) — esto es justo lo que lo diferencia
      // de llamar agregarDetalleOrden varias veces seguidas.
      const numeroRemisionEnvio = await generarNumeroRemisionEnvio(
        prisma,
        orden.id,
        orden.numero,
      );

      const idsCreados = await prisma.$transaction(async (tx) => {
        const ids = [];
        for (const d of detalles) {
          await tx.compraInsumo.update({
            where: { id: Number(d.compraInsumoId) },
            data: {
              cantidadDisponible: { decrement: Number(d.cantidadEnviada) },
            },
          });

          const detalle = await tx.detalleOrdenProduccion.create({
            data: {
              ordenProduccionId: Number(ordenProduccionId),
              compraInsumoId: Number(d.compraInsumoId),
              piedraId: Number(d.piedraId),
              cantidad: Number(d.cantidad),
              costoUnitario: Number(d.costoUnitario),
              costoTotal: Number(d.costoTotal),
              desperdicio: d.desperdicio ?? 0,
              cantidadEnviada: Number(d.cantidadEnviada),
              valorEnviado: Number(d.valorEnviado),
              cantidadDevuelta: 0,
              valorDevuelto: 0,
              usu_creacion: user.codigo,
            },
          });

          await tx.movimientoInsumoOrden.create({
            data: {
              detalleOrdenProduccionId: detalle.id,
              compraInsumoId: Number(d.compraInsumoId),
              tipoMovimiento: "INICIAL",
              cantidad: Number(d.cantidadEnviada),
              valor: Number(d.valorEnviado),
              numeroRemision: numeroRemisionEnvio,
              usu_creacion: user.codigo,
            },
          });

          ids.push(detalle.id);
        }

        await tx.ordenProduccion.updateMany({
          where: { id: orden.id, estadoId: pendienteId },
          data: { estadoId: procesoId },
        });

        return ids;
      });

      return prisma.detalleOrdenProduccion.findMany({
        where: { id: { in: idsCreados } },
        include: incluirDetalle,
      });
    },

    // ── NUEVO — reemplaza a registrarDevolucion ────────────────────
    // Un solo mutation para envío adicional (al joyero le faltó
    // insumo) y para devolución (sobrante que regresa). Ambos quedan
    // como filas de MovimientoInsumoOrden; los acumulados de la
    // línea (cantidadEnviada/valorEnviado/cantidadDevuelta/valorDevuelto)
    // se actualizan con increment, nunca se sobrescriben a mano.
    registrarMovimientoInsumo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const {
        detalleOrdenProduccionId,
        compraInsumoId,
        tipoMovimiento,
        cantidad,
        nota,
      } = input;

      if (!["ADICIONAL", "DEVOLUCION"].includes(tipoMovimiento))
        throw new Error("tipoMovimiento debe ser 'ADICIONAL' o 'DEVOLUCION'");
      if (!nota?.trim())
        throw new Error(
          "La nota es obligatoria para registrar este movimiento",
        );
      if (!cantidad || Number(cantidad) <= 0)
        throw new Error("La cantidad debe ser mayor a cero");

      const detalle = await prisma.detalleOrdenProduccion.findUnique({
        where: { id: Number(detalleOrdenProduccionId) },
        include: { ordenProduccion: { include: { estado: true } } },
      });
      if (!detalle) throw new Error("El detalle no existe");
      validarEmpresa(detalle.ordenProduccion.empresaId, user.empresaActualId);
      // ── NUEVO — no se pueden registrar movimientos sobre una orden cancelada.
      if (detalle.ordenProduccion.estado?.codigo === "CANC")
        throw new Error(
          "Esta orden está cancelada — no se pueden registrar movimientos de insumo",
        );

      const compra = await prisma.compraInsumo.findUnique({
        where: { id: Number(compraInsumoId) },
      });
      if (!compra) throw new Error("El lote de compra no existe");

      if (tipoMovimiento === "ADICIONAL") {
        if (Number(compra.cantidadDisponible) < Number(cantidad))
          throw new Error(
            `Stock insuficiente en ese lote. Disponible: ${compra.cantidadDisponible}`,
          );

        const valor = Number(cantidad) * Number(compra.costoUnitario);
        // ── NUEVO — remisión de envío para este envío adicional.
        const numeroRemisionEnvio = await generarNumeroRemisionEnvio(
          prisma,
          detalle.ordenProduccion.id,
          detalle.ordenProduccion.numero,
        );

        return prisma.$transaction(async (tx) => {
          await tx.compraInsumo.update({
            where: { id: compra.id },
            data: { cantidadDisponible: { decrement: Number(cantidad) } },
          });
          await tx.movimientoInsumoOrden.create({
            data: {
              detalleOrdenProduccionId: detalle.id,
              compraInsumoId: compra.id,
              tipoMovimiento: "ADICIONAL",
              cantidad: Number(cantidad),
              valor,
              nota,
              numeroRemision: numeroRemisionEnvio,
              usu_creacion: user.codigo,
            },
          });
          await tx.detalleOrdenProduccion.update({
            where: { id: detalle.id },
            data: {
              cantidadEnviada: { increment: Number(cantidad) },
              valorEnviado: { increment: valor },
              usu_actualizacion: user.codigo,
            },
          });
          return tx.detalleOrdenProduccion.findUnique({
            where: { id: detalle.id },
            include: incluirDetalle,
          });
        });
      }

      // DEVOLUCION
      const disponibleParaDevolver =
        Number(detalle.cantidadEnviada) - Number(detalle.cantidadDevuelta);
      if (Number(cantidad) > disponibleParaDevolver)
        throw new Error(
          `No puede devolver más de lo enviado. Disponible para devolver: ${disponibleParaDevolver}`,
        );

      const valor = Number(cantidad) * Number(detalle.costoUnitario);

      return prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({
          where: { id: compra.id },
          data: { cantidadDisponible: { increment: Number(cantidad) } },
        });
        await tx.movimientoInsumoOrden.create({
          data: {
            detalleOrdenProduccionId: detalle.id,
            compraInsumoId: compra.id,
            tipoMovimiento: "DEVOLUCION",
            cantidad: Number(cantidad),
            valor,
            nota,
            usu_creacion: user.codigo,
          },
        });
        await tx.detalleOrdenProduccion.update({
          where: { id: detalle.id },
          data: {
            cantidadDevuelta: { increment: Number(cantidad) },
            valorDevuelto: { increment: valor },
            usu_actualizacion: user.codigo,
          },
        });
        return tx.detalleOrdenProduccion.findUnique({
          where: { id: detalle.id },
          include: incluirDetalle,
        });
      });
    },

    // ── NUEVO — cancelar orden ──────────────────────────────────────
    // Reemplaza el cambio manual de estadoId a "Cancelada" desde el
    // formulario genérico. Reglas del "deber ser" acordadas con el
    // usuario:
    //  1. No se puede cancelar una orden que ya tiene piezas entregadas
    //     por el joyero (cantidadEntregada > 0) — ya se completó
    //     producción, cancelar no tiene sentido físico ahí.
    //  2. Si la orden tenía insumos entregados al joyero sin producir
    //     (cantidadEnviada > cantidadDevuelta en alguna línea), se
    //     devuelven automáticamente al lote de compra — se registra
    //     como una DEVOLUCION más en MovimientoInsumoOrden (mismo
    //     patrón que registrarMovimientoInsumo), NO se reescribe ni se
    //     borra el historial existente.
    //  3. El motivo es obligatorio y queda registrado tanto en la nota
    //     de la orden como en la nota de cada devolución automática.
    cancelarOrdenProduccion: async (
      _,
      { id, version, motivo },
      { prisma, user },
    ) => {
      requireAuth(user);
      if (!motivo?.trim())
        throw new Error("El motivo de cancelación es obligatorio");

      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: {
          estado: true,
          detalles: { where: { deletedAt: null } },
        },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);
      if (orden.estado?.codigo === "CANC")
        throw new Error("La orden ya está cancelada");
      if (Number(orden.cantidadEntregada) > 0)
        throw new Error(
          "No se puede cancelar una orden que ya tiene piezas entregadas por el joyero",
        );

      const canceladaId = await obtenerEstadoOrdenId(
        prisma,
        orden.empresaId,
        "CANC",
      );
      const motivoTrim = motivo.trim();
      const fechaTexto = new Date().toLocaleDateString("es-CO");
      const notaNueva = orden.nota
        ? `${orden.nota}\n[CANCELADA ${fechaTexto}] ${motivoTrim}`
        : `[CANCELADA ${fechaTexto}] ${motivoTrim}`;

      await prisma.$transaction(async (tx) => {
        for (const d of orden.detalles) {
          const pendiente =
            Number(d.cantidadEnviada) - Number(d.cantidadDevuelta);
          if (pendiente <= 0) continue;
          const valor = pendiente * Number(d.costoUnitario);
          await tx.compraInsumo.update({
            where: { id: d.compraInsumoId },
            data: { cantidadDisponible: { increment: pendiente } },
          });
          await tx.movimientoInsumoOrden.create({
            data: {
              detalleOrdenProduccionId: d.id,
              compraInsumoId: d.compraInsumoId,
              tipoMovimiento: "DEVOLUCION",
              cantidad: pendiente,
              valor,
              nota: `Devolución automática por cancelación de orden — ${motivoTrim}`,
              usu_creacion: user.codigo,
            },
          });
          await tx.detalleOrdenProduccion.update({
            where: { id: d.id },
            data: {
              cantidadDevuelta: { increment: pendiente },
              valorDevuelto: { increment: valor },
              usu_actualizacion: user.codigo,
            },
          });
        }

        const result = await tx.ordenProduccion.updateMany({
          where: { id: orden.id, version: Number(version) },
          data: {
            estadoId: canceladaId,
            nota: notaNueva.length > 500 ? notaNueva.slice(0, 500) : notaNueva,
            version: { increment: 1 },
            usu_actualizacion: user.codigo,
          },
        });
        if (result.count === 0) throw new Error("Modificado por otro usuario");
      });

      return prisma.ordenProduccion.findUnique({
        where: { id: orden.id },
        include: incluirOrden,
      });
    },

    // ── NUEVO — cerrar una orden con entrega parcial ─────────────────
    // Deber ser acordado con el usuario: cuando el joyero ya entregó
    // piezas pero las que faltan no van a llegar (ej. el material de la
    // última pieza llegó con un problema de calidad y no se puede
    // reponer), NO se debe bajar cantidadProgramada — eso borraría la
    // historia real de para cuántas piezas se compró/envió material.
    // En vez de eso, esta acción solo cierra el ciclo de vida de la
    // orden pasándola a "Entregada", dejando cantidadProgramada y
    // cantidadEntregada tal cual quedaron (ej. 5 programadas, 4
    // entregadas) — la diferencia queda visible como registro honesto
    // de lo que pasó. No toca insumos para nada: qué pasa con el
    // material del faltante (devolución, reconocimiento de valor al
    // joyero, o pérdida absorbida en el costo de lo sí entregado) es
    // una decisión de negocio entre la joyería y el joyero, por fuera
    // del sistema — si aplica una devolución, se registra aparte con
    // el flujo normal de Devolución en la fila de ese insumo.
    cerrarOrdenProduccion: async (
      _,
      { id, version, motivo },
      { prisma, user },
    ) => {
      requireAuth(user);
      if (!motivo?.trim())
        throw new Error("El motivo del cierre es obligatorio");

      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: Number(id) },
        include: { estado: true },
      });
      if (!orden) throw new Error("Orden no existe");
      validarEmpresa(orden.empresaId, user.empresaActualId);
      if (orden.estado?.codigo === "CANC")
        throw new Error("Esta orden ya está cancelada");
      if (orden.estado?.codigo === "ENTR")
        throw new Error("Esta orden ya está entregada");
      if (Number(orden.cantidadEntregada) === 0)
        throw new Error(
          'Esta orden no tiene piezas entregadas — use "Cancelar orden" en vez de cerrarla',
        );
      if (Number(orden.cantidadEntregada) >= Number(orden.cantidadProgramada))
        throw new Error("Esta orden ya completó todas las piezas programadas");

      const entregadaId = await obtenerEstadoOrdenId(
        prisma,
        orden.empresaId,
        "ENTR",
      );
      const motivoTrim = motivo.trim();
      const fechaTexto = new Date().toLocaleDateString("es-CO");
      const notaNueva = orden.nota
        ? `${orden.nota}\n[CERRADA CON ENTREGA PARCIAL ${fechaTexto}] ${motivoTrim}`
        : `[CERRADA CON ENTREGA PARCIAL ${fechaTexto}] ${motivoTrim}`;

      const result = await prisma.ordenProduccion.updateMany({
        where: { id: orden.id, version: Number(version) },
        data: {
          estadoId: entregadaId,
          fechaEntrega: new Date(),
          nota: notaNueva.length > 500 ? notaNueva.slice(0, 500) : notaNueva,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.ordenProduccion.findUnique({
        where: { id: orden.id },
        include: incluirOrden,
      });
    },

    eliminarDetalleOrden: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const detalle = await prisma.detalleOrdenProduccion.findUnique({
        where: { id: Number(id) },
        include: {
          ordenProduccion: true,
          movimientos: { where: { deletedAt: null } },
        },
      });
      if (!detalle) throw new Error("No existe");
      validarEmpresa(detalle.ordenProduccion.empresaId, user.empresaActualId);
      await prisma.$transaction(async (tx) => {
        for (const m of detalle.movimientos) {
          const ajuste =
            m.tipoMovimiento === "DEVOLUCION"
              ? -Number(m.cantidad)
              : Number(m.cantidad);
          await tx.compraInsumo.update({
            where: { id: m.compraInsumoId },
            data: { cantidadDisponible: { increment: ajuste } },
          });
          await tx.movimientoInsumoOrden.update({
            where: { id: m.id },
            data: { deletedAt: new Date() },
          });
        }
        await tx.detalleOrdenProduccion.update({
          where: { id: Number(id) },
          data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
        });
      });
      return true;
    },
  },
};

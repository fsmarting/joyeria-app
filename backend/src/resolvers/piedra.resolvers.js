import { requireAuth } from "../utils/authHelpers.js";
import { validarEmpresa } from "../utils/validations.js";

const inc = { tipo: true, unidad: true };

// ── NUEVO (ronda 36) — Ajustes de Inventario de Insumos (Mecanismo 2).
// Mismo patrón que generarNumeroAjuste en producto.resolvers.js, prefijo
// distinto (AJS- de "ajuste de insumo") para no mezclarse con los
// ajustes de Producto (AJI-).
const generarNumeroAjusteInsumo = async (prisma, empresaId) => {
  const anio = new Date().getFullYear();
  const prefijo = `AJS-${anio}-`;
  const count = await prisma.ajusteInsumo.count({
    where: { empresaId, numero: { startsWith: prefijo } },
  });
  const consecutivo = String(count + 1).padStart(3, "0");
  return `${prefijo}${consecutivo}`;
};

export default {
  AjusteInsumo: {
    fecha: (a) => (a.fecha ? new Date(a.fecha).toISOString() : null),
  },
  // ── NUEVO — visibilidad de inventario de insumos ──────────────────
  Piedra: {
    stockDisponible: async (p, _, { prisma }) => {
      const agg = await prisma.compraInsumo.aggregate({
        where: { piedraId: p.id, deletedAt: null },
        _sum: { cantidadDisponible: true },
      });
      return Number(agg._sum.cantidadDisponible ?? 0);
    },
    // ── NUEVO — valorización del inventario (ronda 33) — no se puede
    // hacer con un _sum de Prisma porque es cantidadDisponible × su
    // propio costoUnitario (dos campos de la misma fila), así que se
    // trae cada lote y se reduce en JS. La cantidad de lotes vigentes de
    // un insumo es chica, no debería pesar.
    valorStockDisponible: async (p, _, { prisma }) => {
      const lotes = await prisma.compraInsumo.findMany({
        where: { piedraId: p.id, deletedAt: null },
        select: { cantidadDisponible: true, costoUnitario: true },
      });
      return lotes.reduce(
        (s, l) => s + Number(l.cantidadDisponible) * Number(l.costoUnitario),
        0,
      );
    },
  },

  Query: {
    piedrasFiltradosCursor: async (
      _,
      { first = 10, after = null, orden = [], direccion = [], busqueda = "" },
      { prisma, user },
    ) => {
      requireAuth(user);
      const where = { empresaId: user.empresaActualId, deletedAt: null };
      if (busqueda?.trim()) {
        const t = busqueda.trim();
        where.OR = [
          { codigo: { contains: t, mode: "insensitive" } },
          { nombre: { contains: t, mode: "insensitive" } },
        ];
      }
      const orderByClause =
        orden.length > 0
          ? orden.map((c, i) => ({ [c]: direccion[i] || "asc" }))
          : [{ codigo: "asc" }];
      const items = await prisma.piedra.findMany({
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
            ? (await prisma.piedra.count({
                where: { ...where, id: { gt: last.id } },
              })) > 0
            : false,
        },
      };
    },
    obtenerPiedras: (_, __, { prisma, user }) => {
      requireAuth(user);
      return prisma.piedra.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          activo: true,
        },
        orderBy: { codigo: "asc" },
        include: inc,
      });
    },
    validarCodigoPiedra: async (_, { empresaId, codigo }, { prisma, user }) => {
      requireAuth(user);
      const existe = await prisma.piedra.findFirst({
        where: {
          empresaId: Number(empresaId),
          codigo: codigo,
          deletedAt: null,
        },
        select: { id: true },
      });
      console.log("Existe...", existe);
      console.log("!!Existe...", !!existe);
      return !!existe;
    },

    // ── NUEVO — visibilidad de inventario de insumos (Kardex) ─────────
    // Junta en una sola lista, ordenada por fecha, todo lo que mueve el
    // saldo total de un insumo — compras nuevas (entrada), envíos hacia
    // órdenes de producción (salida, queda en poder del joyero) y
    // devoluciones de esas órdenes (entrada). El frontend arma el Kardex
    // mensual a partir de esta lista, mismo modelo que
    // movimientosInventarioProducto en producto.resolvers.js.
    movimientosInventarioPiedra: async (_, { piedraId }, { prisma, user }) => {
      requireAuth(user);
      const piedra = await prisma.piedra.findUnique({
        where: { id: Number(piedraId) },
      });
      if (!piedra) throw new Error("Insumo no existe");
      validarEmpresa(piedra.empresaId, user.empresaActualId);

      const movimientos = [];

      // 1. Entradas — compras del insumo
      // ── CAMBIO — CompraInsumo ya no trae numero/fecha propios (ahora
      // viven en su cabeza Compra, ver conversación sobre "deber ser" de
      // separar cabeza/detalle en Compras de Insumos) — se filtra/ordena
      // vía la relación `compra` y se lee `c.compra.numero`/`.fecha`.
      const compras = await prisma.compraInsumo.findMany({
        where: {
          piedraId: Number(piedraId),
          deletedAt: null,
          compra: { empresaId: user.empresaActualId, deletedAt: null },
        },
        include: { compra: true },
        orderBy: { compra: { fecha: "asc" } },
      });
      for (const c of compras) {
        // ── NUEVO — valorización (ronda 33): costoTotal ya está guardado
        // en el lote (cantidad × costoUnitario real de esa compra).
        const valor = Number(c.costoTotal);
        movimientos.push({
          fecha: c.compra.fecha,
          tipo: "Compra",
          referencia: c.compra.numero,
          cantidad: Number(c.cantidad),
          entradaStock: Number(c.cantidad),
          salidaStock: 0,
          variacionCustodia: 0,
          joyero: null,
          entradaValor: valor,
          salidaValor: 0,
          variacionCustodiaValor: 0,
        });
      }

      // 2. Envíos a órdenes (salida) y devoluciones (entrada) — se filtra
      // por compraInsumo.piedraId (relación confirmada en schema.prisma:
      // MovimientoInsumoOrden.compraInsumo) para traer solo los
      // movimientos de lotes de este insumo, sin importar en qué orden
      // se usaron. Se trae también el joyero de cada orden vía
      // detalle.ordenProduccion.joyero (relaciones confirmadas en
      // schema.prisma: MovimientoInsumoOrden.detalle →
      // DetalleOrdenProduccion.ordenProduccion → OrdenProduccion.joyero).
      // ── CAMBIO — mismo ajuste de la ronda 27: CompraInsumo ya no tiene
      // empresaId propio, se filtra vía su relación `compra`.
      // ── CAMBIO (ronda 33) — se agrega compraInsumo.costoUnitario al
      // include para poder valorizar cada envío/devolución con el costo
      // REAL del lote específico que se movió (no un costo estándar).
      const movs = await prisma.movimientoInsumoOrden.findMany({
        where: {
          deletedAt: null,
          compraInsumo: {
            piedraId: Number(piedraId),
            compra: { empresaId: user.empresaActualId, deletedAt: null },
          },
        },
        include: {
          detalle: {
            include: { ordenProduccion: { include: { joyero: true } } },
          },
          compraInsumo: { select: { costoUnitario: true } },
        },
        orderBy: { fecha: "asc" },
      });
      for (const m of movs) {
        const orden = m.detalle?.ordenProduccion;
        const nombreJoyero = orden?.joyero?.nombre || null;
        const referencia =
          orden?.numero || `Orden #${m.detalle?.ordenProduccionId ?? "-"}`;
        const cantidad = Number(m.cantidad);
        const costoUnitarioLote = Number(m.compraInsumo?.costoUnitario ?? 0);
        const valorMov = cantidad * costoUnitarioLote;
        if (m.tipoMovimiento === "DEVOLUCION") {
          movimientos.push({
            fecha: m.fecha,
            tipo: "Devolución de orden",
            referencia,
            cantidad,
            entradaStock: cantidad,
            salidaStock: 0,
            variacionCustodia: -cantidad,
            joyero: nombreJoyero,
            entradaValor: valorMov,
            salidaValor: 0,
            variacionCustodiaValor: -valorMov,
          });
        } else if (m.tipoMovimiento === "ENTRADA_CONSUMO") {
          // ── NUEVO (ronda 36) — Mecanismo 1, primera de las dos líneas:
          // el insumo "vuelve" al sistema encarnado en la pieza entregada
          // — cierra la custodia (el joyero ya no lo tiene), pero NO es
          // una entrada real de materia prima disponible (no suma a
          // "Compras" ni a "Saldo Actual" — el insumo no vuelve a existir
          // como tal, se convirtió en producto).
          movimientos.push({
            fecha: m.fecha,
            tipo: "Consumido en producto terminado",
            referencia,
            cantidad,
            entradaStock: 0,
            salidaStock: 0,
            variacionCustodia: -cantidad,
            joyero: nombreJoyero,
            entradaValor: 0,
            salidaValor: 0,
            variacionCustodiaValor: -valorMov,
          });
        } else if (m.tipoMovimiento === "SALIDA_CONSUMO") {
          // ── NUEVO (ronda 36) — segunda línea del mismo evento: registra
          // que ese insumo, ya "de vuelta", se consumió de inmediato — es
          // puramente informativa (la custodia ya se cerró en la línea de
          // ENTRADA_CONSUMO de arriba), no mueve ningún número adicional.
          movimientos.push({
            fecha: m.fecha,
            tipo: "Consumo confirmado — no vuelve al inventario",
            referencia,
            cantidad,
            entradaStock: 0,
            salidaStock: 0,
            variacionCustodia: 0,
            joyero: nombreJoyero,
            entradaValor: 0,
            salidaValor: 0,
            variacionCustodiaValor: 0,
          });
        } else {
          movimientos.push({
            fecha: m.fecha,
            tipo:
              m.tipoMovimiento === "INICIAL"
                ? "Envío inicial a orden"
                : "Envío adicional a orden",
            referencia,
            cantidad,
            entradaStock: 0,
            salidaStock: cantidad,
            variacionCustodia: cantidad,
            joyero: nombreJoyero,
            entradaValor: 0,
            salidaValor: valorMov,
            variacionCustodiaValor: valorMov,
          });
        }
      }

      // 3. Ajustes de inventario de insumo (pérdida en bodega) — ronda 36,
      // Mecanismo 2. Se valoriza con el costo REAL del lote afectado
      // (mismo criterio de la ronda 33), no un costo estándar.
      const ajustes = await prisma.ajusteInsumo.findMany({
        where: {
          piedraId: Number(piedraId),
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
        include: { compraInsumo: { select: { costoUnitario: true } } },
      });
      for (const a of ajustes) {
        const cantidad = Number(a.cantidad);
        const costoUnitarioLote = Number(a.compraInsumo?.costoUnitario ?? 0);
        const valorAjuste = cantidad * costoUnitarioLote;
        movimientos.push({
          fecha: a.fecha,
          tipo: "Ajuste — pérdida en bodega",
          referencia: a.numero,
          cantidad,
          entradaStock: 0,
          salidaStock: cantidad,
          variacionCustodia: 0,
          joyero: null,
          entradaValor: 0,
          salidaValor: valorAjuste,
          variacionCustodiaValor: 0,
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
    crearPiedra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      validarEmpresa(input.empresaId, user.empresaActualId);
      const existe = await prisma.piedra.findFirst({
        where: {
          codigo: input.codigo,
          empresaId: user.empresaActualId,
          deletedAt: null,
        },
      });
      if (existe) throw new Error("El código ya existe");
      return prisma.piedra.create({
        data: {
          ...input,
          activo: input.activo ?? true,
          usu_creacion: user.codigo,
        },
        include: inc,
      });
    },
    actualizarPiedra: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const { id, version, ...data } = input;
      const original = await prisma.piedra.findUnique({
        where: { id: Number(id) },
      });
      if (!original) throw new Error("No existe");
      validarEmpresa(original.empresaId, user.empresaActualId);
      const result = await prisma.piedra.updateMany({
        where: { id: Number(id), version: Number(version) },
        data: {
          ...data,
          version: { increment: 1 },
          usu_actualizacion: user.codigo,
        },
      });
      if (result.count === 0) throw new Error("Modificado por otro usuario");
      return prisma.piedra.findUnique({
        where: { id: Number(id) },
        include: inc,
      });
    },
    eliminarPiedra: async (_, { id }, { prisma, user }) => {
      requireAuth(user);
      const original = await prisma.piedra.findUnique({
        where: { id: Number(id) },
      });
      validarEmpresa(original.empresaId, user.empresaActualId);
      await prisma.piedra.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), usu_actualizacion: user.codigo },
      });
      return true;
    },

    // ── NUEVO (ronda 36) — Ajustes de Inventario de Insumos (Mecanismo
    // 2, acordado con el usuario). Solo para insumo que se pierde
    // estando TODAVÍA en la bodega de Río Rayo — nunca llegó a manos de
    // ningún joyero (eso se resuelve aparte, con el Mecanismo 1 de
    // entrada+salida en registrarEntregaOrden). Requiere elegir el lote
    // (compraInsumoId) porque cada gramo/unidad disponible vive en un
    // lote específico con su propio costo real. Solo soporta "PERDIDA"
    // por ahora — el usuario no pidió "HALLAZGO" para insumos.
    crearAjusteInsumo: async (_, { input }, { prisma, user }) => {
      requireAuth(user);
      const {
        empresaId,
        piedraId,
        compraInsumoId,
        tipoMovimiento,
        cantidad,
        motivo,
      } = input;
      validarEmpresa(empresaId, user.empresaActualId);
      if (tipoMovimiento !== "PERDIDA") {
        throw new Error(
          "Tipo de movimiento inválido — hoy solo se soporta 'PERDIDA' para insumos",
        );
      }
      if (!motivo?.trim()) throw new Error("El motivo es obligatorio");
      if (Number(cantidad) <= 0)
        throw new Error("La cantidad debe ser mayor a 0");

      const compra = await prisma.compraInsumo.findUnique({
        where: { id: Number(compraInsumoId) },
        include: { compra: true },
      });
      if (!compra) throw new Error("El lote no existe");
      validarEmpresa(compra.compra.empresaId, user.empresaActualId);
      if (compra.piedraId !== Number(piedraId)) {
        throw new Error("Ese lote no corresponde a este insumo");
      }
      if (Number(compra.cantidadDisponible) < Number(cantidad)) {
        throw new Error(
          `No puede registrar una pérdida mayor a la cantidad disponible de ese lote. Disponible: ${compra.cantidadDisponible}`,
        );
      }

      const numero = await generarNumeroAjusteInsumo(prisma, Number(empresaId));

      return prisma.$transaction(async (tx) => {
        await tx.compraInsumo.update({
          where: { id: Number(compraInsumoId) },
          data: { cantidadDisponible: { decrement: Number(cantidad) } },
        });
        return tx.ajusteInsumo.create({
          data: {
            empresaId: Number(empresaId),
            piedraId: Number(piedraId),
            compraInsumoId: Number(compraInsumoId),
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

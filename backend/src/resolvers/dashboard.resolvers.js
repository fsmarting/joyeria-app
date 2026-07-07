import { requireAuth } from "../utils/authHelpers.js";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Líneas base del Excel de Río Rayo (Mayo 2026)
const LINEA_BASE_CIERRE = 0.575; // 57.5%
const LINEA_BASE_TICKET = 1157650; // $1.157.650
const LINEA_BASE_RECURRENCIA = 0.22; // 22%

// Metas del plan 30-60-90
const META_CIERRE = 0.65; // 65% a 30 días
const META_TICKET = 1400000; // $1.4M a 30 días
const META_RECURRENCIA = 0.28; // 28% a 60 días

export default {
  Query: {
    // ── Dashboard principal ──────────────────────────────────────
    dashboardVentas: async (_, { mes, anio }, { prisma, user }) => {
      requireAuth(user);
      const ahora = new Date();
      const m = mes ?? ahora.getMonth() + 1;
      const a = anio ?? ahora.getFullYear();
      const inicio = new Date(a, m - 1, 1);
      const fin = new Date(a, m, 1);

      const ventas = await prisma.venta.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          fecha: { gte: inicio, lt: fin },
        },
        include: { medioPago: true, estado: true },
      });
      const activas = ventas.filter((v) => v.estado?.codigo !== "ANUL");

      const ingresosTotales = activas.reduce(
        (s, v) => s + Number(v.precioVenta),
        0,
      );
      const comisionesTotales = activas.reduce(
        (s, v) => s + Number(v.valorComision),
        0,
      );
      const utilidadNeta = ingresosTotales - comisionesTotales;
      const ventasEfectivo = activas.filter(
        (v) => v.medioPago?.codigo === "EFEC",
      ).length;
      const ventasTarjeta = activas.filter(
        (v) => v.medioPago?.codigo === "TARJ",
      ).length;
      const ventasTransferencia = activas.filter(
        (v) => v.medioPago?.codigo === "TRANS",
      ).length;

      const meta = await prisma.metaMensual.findFirst({
        where: { empresaId: user.empresaActualId, anio: a, mes: m },
      });
      const metaMensual = meta ? Number(meta.metaIngresos) : 0;
      const pctMeta =
        metaMensual > 0
          ? Math.round((ingresosTotales / metaMensual) * 10000) / 100
          : 0;

      return {
        totalVentas: activas.length,
        ingresosTotales: Math.round(ingresosTotales),
        comisionesTotales: Math.round(comisionesTotales),
        utilidadNeta: Math.round(utilidadNeta),
        ticketPromedio:
          activas.length > 0 ? Math.round(ingresosTotales / activas.length) : 0,
        ventasEfectivo,
        ventasTarjeta,
        ventasTransferencia,
        metaMensual,
        pctMeta,
      };
    },

    // ── Los 3 KPIs del plan ─────────────────────────────────────
    dashboardKpis: async (_, { mes, anio }, { prisma, user }) => {
      requireAuth(user);
      const ahora = new Date();
      const m = mes ?? ahora.getMonth() + 1;
      const a = anio ?? ahora.getFullYear();
      const inicio = new Date(a, m - 1, 1);
      const fin = new Date(a, m, 1);

      // ── KPI 01: Tasa de Cierre ──────────────────────────────
      const convs = await prisma.conversacion.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          fecha: { gte: inicio, lt: fin },
        },
      });
      const totalConversaciones = convs.length;
      const conversacionesCerradas = convs.filter((c) => c.cerro).length;
      const tasaCierre =
        totalConversaciones > 0
          ? Math.round((conversacionesCerradas / totalConversaciones) * 10000) /
            10000
          : 0;
      const cumpleCierre =
        META_CIERRE > 0
          ? Math.round((tasaCierre / META_CIERRE) * 10000) / 100
          : 0;

      // ── KPI 02: Ticket Promedio ─────────────────────────────
      const ventas = await prisma.venta.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          fecha: { gte: inicio, lt: fin },
          estado: { codigo: { not: "ANUL" } },
        },
      });
      const ticketPromedio =
        ventas.length > 0
          ? Math.round(
              ventas.reduce((s, v) => s + Number(v.precioVenta), 0) /
                ventas.length,
            )
          : 0;
      const cumpleTicket =
        META_TICKET > 0
          ? Math.round((ticketPromedio / META_TICKET) * 10000) / 100
          : 0;

      // ── KPI 03: Tasa de Recurrencia ─────────────────────────
      // Clientas que han comprado MÁS de una vez (histórico, no solo el mes)
      const todasVentas = await prisma.venta.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          estado: { codigo: { not: "ANUL" } },
        },
        select: { clienteId: true },
      });
      const ventasPorCliente = {};
      for (const v of todasVentas) {
        ventasPorCliente[v.clienteId] =
          (ventasPorCliente[v.clienteId] || 0) + 1;
      }
      const totalClientas = Object.keys(ventasPorCliente).length;
      const clientasRecurrentes = Object.values(ventasPorCliente).filter(
        (c) => c > 1,
      ).length;
      const tasaRecurrencia =
        totalClientas > 0
          ? Math.round((clientasRecurrentes / totalClientas) * 10000) / 10000
          : 0;
      const cumpleRecurrencia =
        META_RECURRENCIA > 0
          ? Math.round((tasaRecurrencia / META_RECURRENCIA) * 10000) / 100
          : 0;

      return {
        mes: m,
        anio: a,
        nombreMes: MESES[m - 1],
        tasaCierre: {
          totalConversaciones,
          conversacionesCerradas,
          tasaCierre,
          metaTasaCierre: META_CIERRE,
          lineaBase: LINEA_BASE_CIERRE,
          cumplePct: cumpleCierre,
        },
        ticketPromedio: {
          ticketPromedio,
          metaTicket: META_TICKET,
          lineaBase: LINEA_BASE_TICKET,
          cumplePct: cumpleTicket,
          totalVentas: ventas.length,
        },
        recurrencia: {
          totalClientas,
          clientasRecurrentes,
          tasaRecurrencia,
          metaRecurrencia: META_RECURRENCIA,
          lineaBase: LINEA_BASE_RECURRENCIA,
          cumplePct: cumpleRecurrencia,
        },
      };
    },

    topProductos: async (_, { mes, anio, limit = 5 }, { prisma, user }) => {
      requireAuth(user);
      const ahora = new Date();
      const m = mes ?? ahora.getMonth() + 1;
      const a = anio ?? ahora.getFullYear();
      const inicio = new Date(a, m - 1, 1);
      const fin = new Date(a, m, 1);
      const ventas = await prisma.venta.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          fecha: { gte: inicio, lt: fin },
          estado: { codigo: { not: "ANUL" } },
        },
        include: { producto: true },
      });
      const agrupado = {};
      for (const v of ventas) {
        const pid = v.productoId;
        if (!agrupado[pid])
          agrupado[pid] = {
            productoId: pid,
            referencia: v.producto?.referencia ?? "",
            nombre: v.producto?.nombre ?? "",
            totalVendido: 0,
            ingresos: 0,
          };
        agrupado[pid].totalVendido += 1;
        agrupado[pid].ingresos += Number(v.precioVenta);
      }
      return Object.values(agrupado)
        .sort((a, b) => b.ingresos - a.ingresos)
        .slice(0, limit)
        .map((p) => ({ ...p, ingresos: Math.round(p.ingresos) }));
    },

    alertasStock: async (_, { umbralPct = 20 }, { prisma, user }) => {
      requireAuth(user);
      const compras = await prisma.compraInsumo.findMany({
        where: { empresaId: user.empresaActualId, deletedAt: null },
        include: { piedra: { include: { unidad: true } } },
      });
      const porPiedra = {};
      for (const c of compras) {
        const pid = c.piedraId;
        if (!porPiedra[pid])
          porPiedra[pid] = {
            id: c.piedra?.id,
            codigo: c.piedra?.codigo ?? "",
            nombre: c.piedra?.nombre ?? "",
            unidad: c.piedra?.unidad?.nombre ?? "",
            totalComprado: 0,
            cantidadDisponible: 0,
          };
        porPiedra[pid].totalComprado += Number(c.cantidad);
        porPiedra[pid].cantidadDisponible += Number(c.cantidadDisponible);
      }
      return Object.values(porPiedra)
        .filter(
          (p) =>
            p.totalComprado > 0 &&
            (p.cantidadDisponible / p.totalComprado) * 100 <= umbralPct,
        )
        .sort((a, b) => a.cantidadDisponible - b.cantidadDisponible)
        .map(({ id, codigo, nombre, cantidadDisponible, unidad }) => ({
          id,
          codigo,
          nombre,
          cantidadDisponible: Math.round(cantidadDisponible * 10000) / 10000,
          unidad,
        }));
    },

    ordenesAbiertas: async (_, __, { prisma, user }) => {
      requireAuth(user);
      const ordenes = await prisma.ordenProduccion.findMany({
        where: {
          empresaId: user.empresaActualId,
          deletedAt: null,
          estado: { codigo: { in: ["PEND", "PROC"] } },
        },
        include: { producto: true, joyero: true, estado: true },
        orderBy: { fechaEstimada: "asc" },
      });
      return ordenes.map((o) => ({
        id: o.id,
        numero: o.numero,
        producto: o.producto?.nombre ?? "",
        joyero: o.joyero?.nombre ?? "",
        cantidadProgramada: o.cantidadProgramada,
        cantidadEntregada: o.cantidadEntregada,
        fechaEstimada: o.fechaEstimada
          ? o.fechaEstimada.toISOString().split("T")[0]
          : null,
        estado: o.estado?.nombre ?? "",
      }));
    },
  },
};

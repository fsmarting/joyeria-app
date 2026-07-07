import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const DASHBOARD_VENTAS = gql`
  query DashboardVentas($mes: Int, $anio: Int) {
    dashboardVentas(mes: $mes, anio: $anio) {
      totalVentas ingresosTotales comisionesTotales utilidadNeta
      ticketPromedio ventasEfectivo ventasTarjeta ventasTransferencia
      metaMensual pctMeta
    }
  }
`;

const DASHBOARD_KPIS = gql`
  query DashboardKpis($mes: Int, $anio: Int) {
    dashboardKpis(mes: $mes, anio: $anio) {
      mes anio nombreMes
      tasaCierre {
        totalConversaciones conversacionesCerradas tasaCierre
        metaTasaCierre lineaBase cumplePct
      }
      ticketPromedio {
        ticketPromedio metaTicket lineaBase cumplePct totalVentas
      }
      recurrencia {
        totalClientas clientasRecurrentes tasaRecurrencia
        metaRecurrencia lineaBase cumplePct
      }
    }
  }
`;

const TOP_PRODUCTOS = gql`
  query TopProductos($mes: Int, $anio: Int) {
    topProductos(mes: $mes, anio: $anio, limit: 5) {
      productoId referencia nombre totalVendido ingresos
    }
  }
`;

const ALERTAS_STOCK  = gql`query { alertasStock { id codigo nombre cantidadDisponible unidad } }`;
const ORDENES_ABIERTAS = gql`query { ordenesAbiertas { id numero producto joyero cantidadProgramada cantidadEntregada fechaEstimada estado } }`;

const fmt  = (n) => `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const pct  = (n) => `${Number(n).toFixed(1)}%`;
const fmtR = (n) => `${(Number(n) * 100).toFixed(1)}%`;

function GaugeBar({ value, max=100, color='primary' }) {
  const w = Math.min(100, Math.max(0, (value / max) * 100));
  const bg = value >= 100 ? 'bg-success' : value >= 70 ? `bg-${color}` : value >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="progress mt-1" style={{ height: 8 }}>
      <div className={`progress-bar ${bg}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function KpiCard({ titulo, actual, meta, lineaBase, cumplePct, formatActual, formatMeta, subtitulo, detalle }) {
  const color = cumplePct >= 100 ? 'success' : cumplePct >= 70 ? 'primary' : cumplePct >= 40 ? 'warning' : 'danger';
  return (
    <div className="col-md-4">
      <div className={`card border-${color} h-100`}>
        <div className={`card-header bg-${color} text-white d-flex justify-content-between align-items-center py-2`}>
          <span className="fw-bold" style={{ fontSize: 13 }}>{titulo}</span>
          <span className="badge bg-white" style={{ color: `var(--bs-${color})`, fontSize: 12 }}>
            {pct(cumplePct)} de meta
          </span>
        </div>
        <div className="card-body py-2">
          <div className="text-center mb-2">
            <div style={{ fontSize: 28, fontWeight: 700, color: `var(--bs-${color})` }}>
              {formatActual(actual)}
            </div>
            {subtitulo && <div className="text-muted" style={{ fontSize: 11 }}>{subtitulo}</div>}
          </div>
          <GaugeBar value={cumplePct} color={color} />
          <div className="d-flex justify-content-between mt-2" style={{ fontSize: 11 }}>
            <span className="text-muted">Base: <strong>{formatActual(lineaBase)}</strong></span>
            <span className="text-muted">Meta: <strong>{formatMeta(meta)}</strong></span>
          </div>
          {detalle && <div className="text-muted mt-1" style={{ fontSize: 11 }}>{detalle}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const ahora = new Date();
  const [mes,  setMes]  = useState(ahora.getMonth() + 1);
  const [anio, setAnio] = useState(ahora.getFullYear());

  const vars = { mes, anio };
  const { data: dv } = useQuery(DASHBOARD_VENTAS,    { variables: vars, fetchPolicy: 'network-only' });
  const { data: dk } = useQuery(DASHBOARD_KPIS,      { variables: vars, fetchPolicy: 'network-only' });
  const { data: dt } = useQuery(TOP_PRODUCTOS,        { variables: vars, fetchPolicy: 'network-only' });
  const { data: da } = useQuery(ALERTAS_STOCK,        { fetchPolicy: 'network-only' });
  const { data: do_ } = useQuery(ORDENES_ABIERTAS,   { fetchPolicy: 'network-only' });

  const v   = dv?.dashboardVentas;
  const k   = dk?.dashboardKpis;
  const top = dt?.topProductos || [];
  const alertas = da?.alertasStock || [];
  const ordenes = do_?.ordenesAbiertas || [];

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const ANIOS = [ahora.getFullYear()-1, ahora.getFullYear(), ahora.getFullYear()+1];

  return (
    <div>
      {/* ── Header ── */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 className="mb-0 fw-bold">💎 Dashboard Río Rayo</h5>
          <small className="text-muted">{k?.nombreMes} {anio}</small>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ width: 120 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 90 }} value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── Resumen financiero ── */}
      <div className="row g-2 mb-3">
        {[
          { label: 'Ingresos del mes', value: fmt(v?.ingresosTotales ?? 0), icon: '💰', color: 'success' },
          { label: 'Meta del mes',     value: fmt(v?.metaMensual ?? 0),     icon: '🎯', color: 'primary' },
          { label: '% Cumplimiento',   value: pct(v?.pctMeta ?? 0),         icon: '📈', color: v?.pctMeta >= 100 ? 'success' : v?.pctMeta >= 70 ? 'warning' : 'danger' },
          { label: 'Utilidad neta',    value: fmt(v?.utilidadNeta ?? 0),    icon: '✨', color: 'info' },
          { label: 'Total ventas',     value: v?.totalVentas ?? 0,           icon: '🛍️', color: 'secondary' },
          { label: 'Ticket promedio',  value: fmt(v?.ticketPromedio ?? 0),  icon: '🏷️', color: 'secondary' },
        ].map((item, i) => (
          <div key={i} className="col-6 col-md-2">
            <div className={`card border-${item.color} text-center py-2`}>
              <div style={{ fontSize: 20 }}>{item.icon}</div>
              <div className={`fw-bold text-${item.color}`} style={{ fontSize: 15 }}>{item.value}</div>
              <div className="text-muted" style={{ fontSize: 10 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Barra de progreso meta ── */}
      {v?.metaMensual > 0 && (
        <div className="card mb-3 border-0 shadow-sm">
          <div className="card-body py-2">
            <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12 }}>
              <span className="fw-bold">Progreso hacia la meta de {MESES[mes-1]}</span>
              <span>{fmt(v.ingresosTotales)} / {fmt(v.metaMensual)}</span>
            </div>
            <div className="progress" style={{ height: 16, borderRadius: 8 }}>
              <div
                className={`progress-bar ${v.pctMeta >= 100 ? 'bg-success' : v.pctMeta >= 70 ? 'bg-primary' : v.pctMeta >= 40 ? 'bg-warning' : 'bg-danger'}`}
                style={{ width: `${Math.min(100, v.pctMeta)}%`, borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                {v.pctMeta > 15 && `${pct(v.pctMeta)}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Los 3 KPIs del plan ── */}
      <div className="mb-1">
        <h6 className="fw-bold text-muted mb-2" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          KPIs del Plan — {k?.nombreMes} {anio}
        </h6>
      </div>
      <div className="row g-2 mb-3">
        {k && <>
          <KpiCard
            titulo="KPI 01 — Tasa de Cierre"
            actual={k.tasaCierre.tasaCierre}
            meta={k.tasaCierre.metaTasaCierre}
            lineaBase={k.tasaCierre.lineaBase}
            cumplePct={k.tasaCierre.cumplePct}
            formatActual={fmtR}
            formatMeta={fmtR}
            subtitulo={`${k.tasaCierre.conversacionesCerradas} cierres de ${k.tasaCierre.totalConversaciones} conversaciones`}
            detalle={k.tasaCierre.totalConversaciones === 0 ? '⚠ Sin conversaciones registradas este mes' : null}
          />
          <KpiCard
            titulo="KPI 02 — Ticket Promedio"
            actual={k.ticketPromedio.ticketPromedio}
            meta={k.ticketPromedio.metaTicket}
            lineaBase={k.ticketPromedio.lineaBase}
            cumplePct={k.ticketPromedio.cumplePct}
            formatActual={fmt}
            formatMeta={fmt}
            subtitulo={`${k.ticketPromedio.totalVentas} ventas este mes`}
            detalle={k.ticketPromedio.totalVentas === 0 ? '⚠ Sin ventas registradas este mes' : null}
          />
          <KpiCard
            titulo="KPI 03 — Recurrencia"
            actual={k.recurrencia.tasaRecurrencia}
            meta={k.recurrencia.metaRecurrencia}
            lineaBase={k.recurrencia.lineaBase}
            cumplePct={k.recurrencia.cumplePct}
            formatActual={fmtR}
            formatMeta={fmtR}
            subtitulo={`${k.recurrencia.clientasRecurrentes} clientas recurrentes de ${k.recurrencia.totalClientas} totales`}
            detalle={k.recurrencia.totalClientas === 0 ? '⚠ Sin clientas registradas' : null}
          />
        </>}
      </div>

      {/* ── Medios de pago ── */}
      {v && (v.ventasEfectivo + v.ventasTarjeta + v.ventasTransferencia) > 0 && (
        <div className="card mb-3 border-0 shadow-sm">
          <div className="card-body py-2">
            <div className="fw-bold mb-2" style={{ fontSize: 12 }}>Ventas por medio de pago</div>
            <div className="d-flex gap-3 flex-wrap">
              <span><span className="badge bg-success me-1">{v.ventasEfectivo}</span>Efectivo</span>
              <span><span className="badge bg-primary me-1">{v.ventasTarjeta}</span>Tarjeta</span>
              <span><span className="badge bg-info me-1">{v.ventasTransferencia}</span>Transferencia</span>
            </div>
          </div>
        </div>
      )}

      <div className="row g-3">
        {/* ── Top productos ── */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header py-2 fw-bold" style={{ fontSize: 13 }}>🏆 Top productos del mes</div>
            <div className="card-body py-2">
              {top.length === 0
                ? <p className="text-muted small mb-0">Sin ventas este mes</p>
                : top.map((p, i) => (
                  <div key={p.productoId} className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: 12 }}>
                    <span><span className="text-muted me-1">#{i+1}</span>{p.nombre}</span>
                    <span className="fw-bold text-success">{fmt(p.ingresos)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ── Alertas de stock ── */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header py-2 fw-bold" style={{ fontSize: 13 }}>
              ⚠️ Alertas de insumos
              {alertas.length > 0 && <span className="badge bg-danger ms-2">{alertas.length}</span>}
            </div>
            <div className="card-body py-2">
              {alertas.length === 0
                ? <p className="text-success small mb-0">✓ Todos los insumos con stock suficiente</p>
                : alertas.map(a => (
                  <div key={a.id} className="d-flex justify-content-between mb-1" style={{ fontSize: 12 }}>
                    <span className="text-danger"><strong>{a.codigo}</strong> {a.nombre}</span>
                    <span className="badge bg-danger">{a.cantidadDisponible} {a.unidad}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ── Órdenes abiertas ── */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header py-2 fw-bold" style={{ fontSize: 13 }}>
              🔨 Producción en curso
              {ordenes.length > 0 && <span className="badge bg-warning text-dark ms-2">{ordenes.length}</span>}
            </div>
            <div className="card-body py-2">
              {ordenes.length === 0
                ? <p className="text-muted small mb-0">Sin órdenes abiertas</p>
                : ordenes.map(o => (
                  <div key={o.id} className="mb-2 border-bottom pb-1" style={{ fontSize: 11 }}>
                    <div className="fw-bold">{o.numero} — {o.producto}</div>
                    <div className="text-muted">
                      {o.joyero} · {o.cantidadEntregada}/{o.cantidadProgramada} piezas
                      {o.fechaEstimada && ` · Est: ${o.fechaEstimada}`}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

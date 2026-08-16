import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposVenta }  from '../../data/camposVenta.jsx';
import {
  GET_VENTAS_CURSOR, CREAR_VENTA, ACTUALIZAR_VENTA, ELIMINAR_VENTA,
  ANULAR_VENTA, GUARDAR_REPARTO, OBTENER_SOCIOS,
} from '../../graphql/ventaQueries.js';

const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}` : '-';

// ── Panel de reparto de utilidad ─────────────────────────────────────
function RepartoPanel({ venta, refetch }) {
  const { data: dataSocios } = useQuery(OBTENER_SOCIOS, { fetchPolicy: 'network-only' });
  const socios = dataSocios?.obtenerSocios || [];

  // Inicializar con repartos existentes o % por defecto de cada socio
  const initRepartos = () => {
    if (venta.repartos?.length > 0) {
      return venta.repartos.map((r) => ({ socioId: r.socioId, porcentaje: r.porcentaje }));
    }
    return socios.map((s) => ({ socioId: s.id, porcentaje: Number(s.porcentajeDefecto ?? 0) }));
  };

  const [repartos, setRepartos] = useState(initRepartos);
  const [guardar] = useMutation(GUARDAR_REPARTO);

  const totalPct   = repartos.reduce((s, r) => s + Number(r.porcentaje), 0);
  // ── CAMBIO — el total de la venta ahora es precioVenta (unitario) × cantidad.
  const totalVenta = Number(venta.precioVenta) * Number(venta.cantidad ?? 1);
  const utilidad   = totalVenta - Number(venta.valorComision);

  const updatePct = (socioId, pct) => {
    setRepartos((prev) => prev.map((r) => r.socioId === socioId ? { ...r, porcentaje: Number(pct) } : r));
  };

  const handleGuardar = async () => {
    if (Math.round(totalPct) !== 100) return toast.error(`Los % deben sumar 100 (actual: ${totalPct})`);
    try {
      await guardar({ variables: { ventaId: venta.id, repartos } });
      toast.success('Reparto guardado');
      await refetch();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <strong style={{ fontSize: 13 }}>Reparto de utilidad — {venta.cliente?.nombre}</strong>
        <span className="text-muted small">
          Total: {fmt(totalVenta)} ({fmt(venta.precioVenta)} × {venta.cantidad ?? 1}) · Comisión {venta.vendedora?.nombre}: {fmt(venta.valorComision)} ({Number(venta.porcentajeComision).toFixed(1)}%) ·
          <strong> Utilidad a repartir: {fmt(utilidad)}</strong>
        </span>
      </div>

      <div className="d-flex flex-wrap gap-3 align-items-end">
        {socios.map((s) => {
          const r = repartos.find((x) => x.socioId === s.id) || { porcentaje: 0 };
          const valor = (utilidad * Number(r.porcentaje)) / 100;
          return (
            <div key={s.id} className="border rounded p-2 bg-white" style={{ minWidth: 160 }}>
              <div className="fw-bold mb-1" style={{ fontSize: 13 }}>{s.nombre}</div>
              <div className="d-flex align-items-center gap-1 mb-1">
                <input type="number" className="form-control form-control-sm"
                  style={{ width: 70 }} min="0" max="100"
                  value={r.porcentaje}
                  onChange={(e) => updatePct(s.id, e.target.value)}
                />
                <span className="text-muted small">%</span>
              </div>
              <div className="text-success small fw-bold">{fmt(valor)}</div>
            </div>
          );
        })}

        <div>
          <div className={`badge mb-2 ${Math.round(totalPct) === 100 ? 'bg-success' : 'bg-danger'}`}>
            Total: {totalPct}%
          </div>
          <br />
          <button className="btn btn-primary btn-sm" onClick={handleGuardar}
            disabled={Math.round(totalPct) !== 100}>
            Guardar reparto
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NUEVO — panel de anulación, mismo patrón que "Cerrar orden (entrega
// parcial)" en Órdenes de Producción: acción dedicada + motivo obligatorio.
function AnularVentaPanel({ venta, refetch }) {
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [anular, { loading }] = useMutation(ANULAR_VENTA);

  const handleAnular = async () => {
    if (!motivo.trim()) return toast.warning('Indique el motivo de la anulación');
    try {
      await anular({ variables: { id: venta.id, version: venta.version, motivo: motivo.trim() } });
      toast.success('Venta anulada — el stock fue restaurado');
      setAnulando(false);
      setMotivo('');
      await refetch();
    } catch (e) { toast.error(e.message); }
  };

  if (venta.estado?.codigo === 'ANUL') {
    return (
      <div className="alert alert-secondary py-2 mb-0" style={{ fontSize: 12 }}>
        🚫 Esta venta está anulada.
      </div>
    );
  }

  if (!anulando) {
    return (
      <button className="btn btn-outline-danger btn-sm" onClick={() => setAnulando(true)}>
        🚫 Anular venta
      </button>
    );
  }

  return (
    <div className="border border-danger rounded p-3 bg-white" style={{ fontSize: 12 }}>
      <div className="fw-bold mb-2 text-danger">Anular venta</div>
      <p className="text-muted mb-2" style={{ fontSize: 11 }}>
        Se restaura automáticamente el stock del producto y se elimina el reparto de utilidad guardado.
      </p>
      <textarea
        className="form-control form-control-sm mb-2"
        placeholder="Motivo de la anulación (obligatorio)"
        rows={2}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="d-flex gap-2">
        <button className="btn btn-danger btn-sm" onClick={handleAnular} disabled={loading}>
          {loading ? '⏳ Anulando...' : 'Confirmar anulación'}
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => setAnulando(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function VentaDetalle({ venta, refetch }) {
  return (
    <>
      {venta.estado?.codigo !== 'ANUL' && <RepartoPanel venta={venta} refetch={refetch} />}
      <div className="p-3 bg-light border-top">
        <AnularVentaPanel venta={venta} refetch={refetch} />
      </div>
    </>
  );
}

export default function Venta() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); } catch { return {}; }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="venta" campos={camposVenta}
      titulo="Ventas"
      descripcion="Registro de ventas — la comisión se calcula automáticamente según medio de pago y vendedora. Expanda para repartir utilidad entre socias o anular."
      textoBoton="Venta"
      queries={{ GET: GET_VENTAS_CURSOR, CREAR: CREAR_VENTA, ACTUALIZAR: ACTUALIZAR_VENTA, ELIMINAR: ELIMINAR_VENTA }}
      fixedValues={{ empresaId: empresaActual.id, fecha: new Date().toISOString().split('T')[0] }}
      getDetalle={(venta, refetch) => <VentaDetalle venta={venta} refetch={refetch} />}
    />
  );
}

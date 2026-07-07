import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposVenta }  from '../../data/camposVenta.jsx';
import {
  GET_VENTAS_CURSOR, CREAR_VENTA, ACTUALIZAR_VENTA, ELIMINAR_VENTA,
  GUARDAR_REPARTO, OBTENER_SOCIOS,
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
  const utilidad   = Number(venta.precioVenta) - Number(venta.valorComision);

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
          PVP: {fmt(venta.precioVenta)} · Comisión {venta.vendedora?.nombre}: {fmt(venta.valorComision)} ({Number(venta.porcentajeComision).toFixed(1)}%) ·
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

export default function Venta() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); } catch { return {}; }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="venta" campos={camposVenta}
      titulo="Ventas"
      descripcion="Registro de ventas — la comisión se calcula automáticamente según medio de pago y vendedora. Expanda para repartir utilidad entre socias."
      textoBoton="Venta"
      queries={{ GET: GET_VENTAS_CURSOR, CREAR: CREAR_VENTA, ACTUALIZAR: ACTUALIZAR_VENTA, ELIMINAR: ELIMINAR_VENTA }}
      fixedValues={{ empresaId: empresaActual.id, fecha: new Date().toISOString().split('T')[0] }}
      getDetalle={(venta, refetch) => <RepartoPanel venta={venta} refetch={refetch} />}
    />
  );
}

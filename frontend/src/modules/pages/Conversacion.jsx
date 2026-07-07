import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposConversacion } from '../../data/camposConversacion.jsx';
import {
  GET_CONVERSACIONES_CURSOR, CREAR_CONVERSACION,
  ACTUALIZAR_CONVERSACION, ELIMINAR_CONVERSACION,
  GET_KPIS_CONVERSACIONES,
} from '../../graphql/conversacionQueries.js';

// ── Mini-dashboard de KPIs arriba de la tabla ─────────────────────
function KpisBar() {
  const ahora = new Date();
  const { data, loading } = useQuery(GET_KPIS_CONVERSACIONES, {
    variables: { mes: ahora.getMonth() + 1, anio: ahora.getFullYear() },
    fetchPolicy: 'network-only',
  });

  const k = data?.kpisConversaciones;
  if (loading || !k) return null;

  const kpis = [
    { label: 'Conversaciones',  valor: k.total,              color: 'primary',  icon: '💬' },
    { label: 'Cotizaron',       valor: k.cotizaron,          color: 'info',     icon: '📋' },
    { label: 'Cerraron',        valor: k.cerraron,           color: 'success',  icon: '✅' },
    { label: 'Tasa de cierre',  valor: `${k.tasaCierre}%`,   color: k.tasaCierre >= 30 ? 'success' : 'warning', icon: '🎯' },
    { label: 'Usaron protocolo',valor: `${k.pctProtocolo}%`, color: 'secondary',icon: '📖' },
    { label: 'Perdidas silencio',valor: k.perdidaSilencio,   color: 'secondary',icon: '🔇' },
    { label: 'Perdidas precio', valor: k.perdidaPrecio,      color: 'warning',  icon: '💸' },
  ];

  return (
    <div className="d-flex flex-wrap gap-2 mb-4">
      {kpis.map((kpi) => (
        <div key={kpi.label}
          className={`border rounded px-3 py-2 bg-white`}
          style={{ minWidth: 130, textAlign: 'center' }}
        >
          <div style={{ fontSize: 20 }}>{kpi.icon}</div>
          <div className={`fw-bold text-${kpi.color}`} style={{ fontSize: 18 }}>
            {kpi.valor}
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>{kpi.label}</div>
          <div className="text-muted" style={{ fontSize: 10 }}>Este mes</div>
        </div>
      ))}
    </div>
  );
}

export default function Conversacion() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); }
    catch { return {}; }
  }, []);

  return (
    <div>
      <KpisBar />
      <EntidadGenerica
        tipoEntidad="conversacion"
        campos={camposConversacion}
        titulo="Registro de Chats"
        descripcion="Cada conversación de WhatsApp o Instagram — cotizó, cerró, motivo si no cerró"
        textoBoton="Conversación"
        queries={{
          GET:        GET_CONVERSACIONES_CURSOR,
          CREAR:      CREAR_CONVERSACION,
          ACTUALIZAR: ACTUALIZAR_CONVERSACION,
          ELIMINAR:   ELIMINAR_CONVERSACION,
        }}
        fixedValues={{
          empresaId: empresaActual.id,
          fecha:     new Date().toISOString().split('T')[0],
          cotizo:    false,
          cerro:     false,
          usoProtocolo: false,
        }}
      />
    </div>
  );
}

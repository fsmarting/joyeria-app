import { GET_PIEDRAS_CURSOR }       from '../graphql/piedraQueries.js';
import { OBTENER_TERCEROS_POR_TIPO } from '../graphql/terceroQueries.js';

const fmt  = (n) => n != null ? `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}` : '-';
const fmtQ = (n, u) => n != null ? `${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 4 })} ${u||''}`.trim() : '-';

export const camposCompraInsumo = [
  // ── Número de compra ────────────────────────────────────────────
  {
    nombre: 'numero', etiqueta: 'N° Compra', tipoForm: 'text',
    obligatorio: true, maxLength: 20, ancho: '120px', ordenListado: 1,
    placeholder: 'Ej: OC-2026-001',
  },

  // ── Fecha ────────────────────────────────────────────────────────
  {
    nombre: 'fecha', etiqueta: 'Fecha', tipoForm: 'date',
    obligatorio: true, ancho: '110px', ordenListado: 2,
    render: (f) => f.fecha ? new Date(f.fecha).toLocaleDateString('es-CO') : '-',
  },

  // ── Insumo (Piedra) ─────────────────────────────────────────────
  {
    nombre: 'piedraId', etiqueta: 'Insumo', tipoForm: 'autocomplete',
    obligatorio: true, ancho: '180px', ordenListado: 3,
    relationConfig: {
      query: GET_PIEDRAS_CURSOR, dataKey: 'piedrasFiltradosCursor', isEdge: true,
      valueField: 'id', displayField: 'nombre',
      formatLabel: (p) => `${p.codigo} — ${p.nombre}`,
      fixedVariables: { first: 50 },
    },
    render: (f) => f.piedra ? `${f.piedra.codigo} — ${f.piedra.nombre}` : '-',
  },

  // ── Proveedor (Tercero tipo PROVEEDOR) ───────────────────────────
  {
    nombre: 'proveedorId', etiqueta: 'Proveedor', tipoForm: 'select',
    ancho: '160px', ordenListado: 4,
    relationConfig: {
      query:       OBTENER_TERCEROS_POR_TIPO,
      dataKey:     'obtenerTercerosPorTipo',
      valueField:  'id',
      displayField:'nombre',
      fixedVariables: { tipoCodigo: 'PROVEEDOR' },
    },
    render: (f) => f.proveedor?.nombre ?? <span className="text-muted">—</span>,
  },

  // ── Cantidad comprada ────────────────────────────────────────────
  {
    nombre: 'cantidad', etiqueta: 'Cantidad', tipoForm: 'number',
    obligatorio: true, ancho: '110px', ordenListado: 5, valorDefecto: 0,
    render: (f) => fmtQ(f.cantidad, f.piedra?.unidad?.nombre),
  },

  // ── Costo unitario ───────────────────────────────────────────────
  {
    nombre: 'costoUnitario', etiqueta: '$ / Unidad', tipoForm: 'number',
    obligatorio: true, ancho: '120px', ordenListado: 6, valorDefecto: 0,
    render: (f) => fmt(f.costoUnitario),
  },

  // ── Costo total (calculado, solo listado) ────────────────────────
  {
    nombre: 'costoTotal', etiqueta: 'Costo Total', soloListado: true,
    ancho: '120px', ordenListado: 7,
    render: (f) => fmt(f.costoTotal),
  },

  // ── Disponible (solo listado) ────────────────────────────────────
  {
    nombre: 'cantidadDisponible', etiqueta: 'Disponible', soloListado: true,
    ancho: '110px', ordenListado: 8,
    render: (f) => {
      const disp = Number(f.cantidadDisponible);
      const tot  = Number(f.cantidad);
      const pct  = tot > 0 ? (disp / tot) * 100 : 0;
      const color = pct > 50 ? 'success' : pct > 20 ? 'warning' : 'danger';
      return <span className={`badge bg-${color}`}>{fmtQ(disp, f.piedra?.unidad?.nombre)}</span>;
    },
  },

  // ── Nota (solo formulario) ────────────────────────────────────────
  { nombre: 'nota', etiqueta: 'Nota', tipoForm: 'text', maxLength: 500, soloFormulario: true },

  // ── Version (hidden) ─────────────────────────────────────────────
  { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
];

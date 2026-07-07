import { GET_GRUPOS_POR_CODIGOS } from '../graphql/grupoQueries.js';

const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}` : '-';
const pct = (n) => n != null ? `${Number(n).toFixed(1)}%` : '-';

export const camposProducto = [
  // ── Foto (miniatura en listado, URL en formulario) ───────────
  {
    nombre: 'foto', etiqueta: 'Foto', tipoForm: 'text',
    maxLength: 500, ancho: '70px', ordenListado: 1,
    placeholder: 'https://... URL de la imagen',
    render: (f) => f.foto
      ? <img src={f.foto} alt={f.nombre} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} onError={(e) => { e.target.style.display='none'; }} />
      : <span style={{ display:'inline-block', width:44, height:44, borderRadius:6, background:'var(--surface-1)', border:'1px solid var(--border)' }} />,
  },
  { nombre: 'referencia', etiqueta: 'Referencia', tipoForm: 'text', obligatorio: true, maxLength: 50, ancho: '110px', ordenListado: 2, soloLecturaEnEdicion: true },
  { nombre: 'nombre',     etiqueta: 'Nombre',     tipoForm: 'text', obligatorio: true, maxLength: 150, ancho: 'auto', ordenListado: 3 },
  {
    nombre: 'categoriaId', etiqueta: 'Categoría', tipoForm: 'select', ancho: '120px', ordenListado: 4,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'PRODU', subcatalogoCodigo: 'CATP' } },
    render: (f) => f.categoria?.nombre ?? '-',
  },
  { nombre: 'gramosOro',          etiqueta: 'Gramos Oro',   tipoForm: 'number', ancho: '90px',  ordenListado: 5, valorDefecto: 0 },
  { nombre: 'costoGramoOroUsado', etiqueta: '$ / Gramo',    tipoForm: 'number', ancho: '110px', ordenListado: 6, valorDefecto: 0 },
  { nombre: 'costoManoObra',      etiqueta: 'Mano de Obra', tipoForm: 'number', ancho: '110px', ordenListado: 7, valorDefecto: 0, render: (f) => fmt(f.costoManoObra) },
  { nombre: 'costoOtros',         etiqueta: 'Otros',        tipoForm: 'number', ancho: '90px',  ordenListado: 8, valorDefecto: 0, render: (f) => fmt(f.costoOtros) },
  { nombre: 'costoTotal',  etiqueta: 'Costo',  soloListado: true, ancho: '100px', ordenListado: 9,  render: (f) => fmt(f.costoTotal) },
  { nombre: 'precioVenta', etiqueta: 'PVP',    tipoForm: 'number', ancho: '100px', ordenListado: 10, valorDefecto: 0, render: (f) => fmt(f.precioVenta) },
  {
    nombre: 'margen', etiqueta: 'Margen', soloListado: true, ancho: '80px', ordenListado: 11,
    render: (f) => {
      const m = Number(f.margen);
      const c = m >= 50 ? 'success' : m >= 30 ? 'warning' : 'danger';
      return <span className={`badge bg-${c}`}>{pct(m)}</span>;
    },
  },
  // ── Stock de producto terminado (solo listado — lo maneja el sistema) ──
  {
    nombre: 'enStock', etiqueta: 'Stock', soloListado: true, ancho: '80px', ordenListado: 12,
    render: (f) => {
      const s = Number(f.enStock ?? 0);
      const c = s > 3 ? 'success' : s > 0 ? 'warning' : 'secondary';
      return <span className={`badge bg-${c}`}>{s} uds</span>;
    },
  },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipoForm: 'text', maxLength: 500, soloFormulario: true },
  { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
];

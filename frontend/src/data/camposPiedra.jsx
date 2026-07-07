import { GET_GRUPOS_POR_CODIGOS } from '../graphql/grupoQueries.js';

const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}` : '-';

export const camposPiedra = [
  // ── Foto ─────────────────────────────────────────────────────
  {
    nombre: 'foto', etiqueta: 'Foto', tipoForm: 'text',
    maxLength: 500, ancho: '70px', ordenListado: 1,
    placeholder: 'https://... URL de la imagen',
    render: (f) => f.foto
      ? <img src={f.foto} alt={f.nombre} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} onError={(e) => { e.target.style.display='none'; }} />
      : <span style={{ display:'inline-block', width:44, height:44, borderRadius:6, background:'var(--surface-1)', border:'1px solid var(--border)' }} />,
  },
  { nombre: 'codigo', etiqueta: 'Código', tipoForm: 'text', obligatorio: true, maxLength: 20, ancho: '110px', ordenListado: 2, soloLecturaEnEdicion: true },
  { nombre: 'nombre', etiqueta: 'Nombre', tipoForm: 'text', obligatorio: true, maxLength: 100, ancho: 'auto',  ordenListado: 3 },
  {
    nombre: 'tipoId', etiqueta: 'Tipo', tipoForm: 'select', ancho: '120px', ordenListado: 4,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'PRODU', subcatalogoCodigo: 'TPIE' } },
    render: (f) => f.tipo?.nombre ?? '-',
  },
  {
    nombre: 'unidadId', etiqueta: 'Unidad', tipoForm: 'select', ancho: '100px', ordenListado: 5,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'INV', subcatalogoCodigo: 'UNID' } },
    render: (f) => f.unidad?.nombre ?? '-',
  },
  {
    nombre: 'costoEstandardPorUnidad', etiqueta: 'Costo estándar/unidad', tipoForm: 'number',
    ancho: '150px', ordenListado: 6, valorDefecto: 0,
    render: (f) => fmt(f.costoEstandardPorUnidad),
  },
  {
    nombre: 'activo', etiqueta: 'Activo', tipoForm: 'custom', ancho: '80px', ordenListado: 7, valorDefecto: true,
    renderForm: ({ form, handleChange }) => (
      <select className="form-select" name="activo" value={String(form.activo ?? true)} onChange={handleChange}>
        <option value="true">Sí</option><option value="false">No</option>
      </select>
    ),
    render: (f) => <span className={`badge ${f.activo ? 'bg-success' : 'bg-secondary'}`}>{f.activo ? 'Activo' : 'Inactivo'}</span>,
  },
  { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
];

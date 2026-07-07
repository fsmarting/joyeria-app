import { GET_GRUPOS_POR_CODIGOS }  from '../graphql/grupoQueries.js';
import { OBTENER_TERCEROS_POR_TIPO } from '../graphql/terceroQueries.js';
import { OBTENER_USUARIOS }         from '../graphql/ventaQueries.js';
import { GET_PRODUCTOS_CURSOR }     from '../graphql/productoQueries.js';

const fmtF = (s) => s ? new Date(s).toLocaleDateString('es-CO') : '-';

export const camposConversacion = [
  {
    nombre: 'fecha', etiqueta: 'Fecha', tipoForm: 'date',
    obligatorio: true, ancho: '100px', ordenListado: 1,
    valorDefecto: new Date().toISOString().split('T')[0],
    valueTransformer: (v) => v ? v.split('T')[0] : '',
    render: (f) => fmtF(f.fecha),
  },
  {
    nombre: 'clienteId', etiqueta: 'Clienta', tipoForm: 'select',
    ancho: '160px', ordenListado: 2,
    relationConfig: { query: OBTENER_TERCEROS_POR_TIPO, dataKey: 'obtenerTercerosPorTipo', valueField: 'id', displayField: 'nombre', fixedVariables: { tipoCodigo: 'CLIENTE' } },
    render: (f) => f.cliente?.nombre ?? '-',
  },
  {
    nombre: 'canalId', etiqueta: 'Canal', tipoForm: 'select',
    ancho: '110px', ordenListado: 3,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'CRM', subcatalogoCodigo: 'CANA' } },
    render: (f) => f.canal?.nombre ?? '-',
  },
  {
    nombre: 'productoId', etiqueta: 'Pieza de interés', tipoForm: 'select',
    ancho: '160px', ordenListado: 4,
    relationConfig: { query: GET_PRODUCTOS_CURSOR, dataKey: 'productosFiltradosCursor', isEdge: true, valueField: 'id', displayField: 'nombre', fixedVariables: { first: 100 } },
    render: (f) => f.producto ? `${f.producto.referencia} — ${f.producto.nombre}` : <span className="text-muted">—</span>,
  },
  {
    nombre: 'usuarioId', etiqueta: 'Atendió', tipoForm: 'select',
    ancho: '130px', ordenListado: 5,
    relationConfig: { query: OBTENER_USUARIOS, dataKey: 'obtenerUsuarios', valueField: 'id', displayField: 'nombre' },
    render: (f) => f.usuario?.nombre ?? '-',
  },
  {
    nombre: 'cotizo', etiqueta: 'Cotizó', tipoForm: 'custom',
    ancho: '70px', ordenListado: 6, valorDefecto: false,
    renderForm: ({ form, handleChange }) => (
      <select className="form-select" name="cotizo" value={String(form.cotizo ?? false)} onChange={handleChange}>
        <option value="false">No</option><option value="true">Sí</option>
      </select>
    ),
    render: (f) => <span className={`badge ${f.cotizo?'bg-primary':'bg-secondary'}`}>{f.cotizo?'Sí':'No'}</span>,
  },
  {
    nombre: 'cerro', etiqueta: 'Cerró', tipoForm: 'custom',
    ancho: '70px', ordenListado: 7, valorDefecto: false,
    renderForm: ({ form, handleChange }) => (
      <select className="form-select" name="cerro" value={String(form.cerro ?? false)} onChange={handleChange}>
        <option value="false">No</option><option value="true">Sí</option>
      </select>
    ),
    render: (f) => <span className={`badge ${f.cerro?'bg-success':'bg-secondary'}`}>{f.cerro?'Sí':'No'}</span>,
  },
  {
    nombre: 'usoProtocolo', etiqueta: 'Protocolo', tipoForm: 'custom',
    ancho: '80px', ordenListado: 8, valorDefecto: false,
    renderForm: ({ form, handleChange }) => (
      <select className="form-select" name="usoProtocolo" value={String(form.usoProtocolo ?? false)} onChange={handleChange}>
        <option value="false">No</option><option value="true">Sí</option>
      </select>
    ),
    render: (f) => <span className={`badge ${f.usoProtocolo?'bg-success':'bg-secondary'}`}>{f.usoProtocolo?'Sí':'No'}</span>,
  },
  {
    nombre: 'motivoPerdidaId', etiqueta: 'Motivo no cierre', tipoForm: 'select',
    ancho: '140px', ordenListado: 9,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'CRM', subcatalogoCodigo: 'MOTI' } },
    render: (f) => f.motivoPerdida?.nombre ?? '-',
  },
  { nombre: 'nota', etiqueta: 'Nota', tipoForm: 'text', maxLength: 500, soloFormulario: true },
  { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
];

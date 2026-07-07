import { GET_GRUPOS_POR_CODIGOS }   from '../graphql/grupoQueries.js';
import { OBTENER_TERCEROS_POR_TIPO } from '../graphql/terceroQueries.js';
import { OBTENER_USUARIOS }          from '../graphql/ventaQueries.js';
import { GET_PRODUCTOS_CURSOR }      from '../graphql/productoQueries.js';

const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0})}` : '-';

export const camposVenta = [
  {
    nombre: 'fecha', etiqueta: 'Fecha', tipoForm: 'date',
    obligatorio: true, ancho: '100px', ordenListado: 1,
    valorDefecto: new Date().toISOString().split('T')[0],
    valueTransformer: (v) => v ? v.split('T')[0] : '',
    render: (f) => f.fecha ? new Date(f.fecha).toLocaleDateString('es-CO') : '-',
  },
  {
    nombre: 'clienteId', etiqueta: 'Clienta', tipoForm: 'select',
    obligatorio: true, ancho: '160px', ordenListado: 2,
    relationConfig: { query: OBTENER_TERCEROS_POR_TIPO, dataKey: 'obtenerTercerosPorTipo', valueField: 'id', displayField: 'nombre', fixedVariables: { tipoCodigo: 'CLIENTE' } },
    render: (f) => f.cliente?.nombre ?? '-',
  },
  {
    nombre: 'productoId', etiqueta: 'Producto', tipoForm: 'select',
    obligatorio: true, ancho: '160px', ordenListado: 3,
    relationConfig: { query: GET_PRODUCTOS_CURSOR, dataKey: 'productosFiltradosCursor', isEdge: true, valueField: 'id', displayField: 'nombre', fixedVariables: { first: 100 } },
    render: (f) => f.producto ? `${f.producto.referencia} — ${f.producto.nombre}` : '-',
  },
  {
    nombre: 'canalId', etiqueta: 'Canal llegada', tipoForm: 'select',
    ancho: '120px', ordenListado: 4,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'CRM', subcatalogoCodigo: 'CANA' } },
    render: (f) => f.canal?.nombre ?? '-',
  },
  {
    nombre: 'medioPagoId', etiqueta: 'Medio pago', tipoForm: 'select',
    obligatorio: true, ancho: '120px', ordenListado: 5,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'VENT', subcatalogoCodigo: 'MPAG' } },
    render: (f) => f.medioPago?.nombre ?? '-',
  },
  {
    nombre: 'precioVenta', etiqueta: 'Precio venta', tipoForm: 'number',
    obligatorio: true, ancho: '130px', ordenListado: 6, valorDefecto: 0,
    render: (f) => fmt(f.precioVenta),
  },
  {
    nombre: 'vendedoraId', etiqueta: 'Vendedora', tipoForm: 'select',
    ancho: '140px', ordenListado: 7,
    relationConfig: { query: OBTENER_USUARIOS, dataKey: 'obtenerUsuarios', valueField: 'id', displayField: 'nombre' },
    render: (f) => f.vendedora?.nombre ?? '-',
  },
  {
    nombre: 'estadoId', etiqueta: 'Estado', tipoForm: 'select',
    obligatorio: true, ancho: '120px', ordenListado: 8,
    relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'VENT', subcatalogoCodigo: 'ESTV' } },
    render: (f) => {
      const c = f.estado?.codigo === 'CONF' ? 'success' : f.estado?.codigo === 'ENPR' ? 'warning' : f.estado?.codigo === 'ANUL' ? 'danger' : 'secondary';
      return <span className={`badge bg-${c}`}>{f.estado?.nombre ?? '-'}</span>;
    },
  },
  { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
];

import { OBTENER_USUARIOS } from '../graphql/ventaQueries.js';

const fmtF = (s) => s ? new Date(s).toLocaleDateString('es-CO') : '-';
const fmt  = (n) => n != null ? `$${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0})}` : '-';

export const camposMuestrario = [
  {
    nombre: 'vendedoraId', etiqueta: 'Vendedora', tipoForm: 'select',
    obligatorio: true, ancho: '160px', ordenListado: 1,
    relationConfig: { query: OBTENER_USUARIOS, dataKey: 'obtenerUsuarios', valueField: 'id', displayField: 'nombre' },
    render: (f) => f.vendedora?.nombre ?? '-',
  },
  {
    nombre: 'fechaSalida', etiqueta: 'Fecha Salida', tipoForm: 'date',
    obligatorio: true, ancho: '110px', ordenListado: 2,
    valorDefecto: new Date().toISOString().split('T')[0],
    valueTransformer: (val) => val ? val.split('T')[0] : '',
    render: (f) => fmtF(f.fechaSalida),
  },
  {
    nombre: 'estado', etiqueta: 'Estado', soloListado: true, ancho: '100px', ordenListado: 3,
    render: (f) => {
      const c = f.estado === 'ACTIVO' ? 'success' : 'secondary';
      return <span className={`badge bg-${c}`}>{f.estado}</span>;
    },
  },
  { nombre: 'totalPiezas',   etiqueta: 'Piezas',   soloListado: true, ancho: '80px',  ordenListado: 4, render: (f) => f.totalPiezas ?? 0 },
  { nombre: 'totalVendidas', etiqueta: 'Vendidas',  soloListado: true, ancho: '80px',  ordenListado: 5, render: (f) => <span className={`badge ${f.totalVendidas>0?'bg-success':'bg-secondary'}`}>{f.totalVendidas ?? 0}</span> },
  {
    nombre: 'totalEfectivoPendiente', etiqueta: 'Efectivo pendiente', soloListado: true, ancho: '140px', ordenListado: 6,
    render: (f) => Number(f.totalEfectivoPendiente) > 0
      ? <span className="badge bg-warning text-dark">{fmt(f.totalEfectivoPendiente)}</span>
      : <span className="text-muted">—</span>,
  },
  {
    nombre: 'fechaCierre', etiqueta: 'Fecha cierre', soloListado: true, ancho: '110px', ordenListado: 7,
    render: (f) => f.fechaCierre ? fmtF(f.fechaCierre) : <span className="text-muted">—</span>,
  },
  { nombre: 'nota',    etiqueta: 'Nota',    tipoForm: 'text', maxLength: 500, soloFormulario: true },
  { nombre: 'version', tipoForm: 'hidden',  soloFormulario: true, valorDefecto: 1 },
];

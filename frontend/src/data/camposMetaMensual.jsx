const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0})}` : '-';

const MESES = [
  {v:1,l:'Enero'},{v:2,l:'Febrero'},{v:3,l:'Marzo'},{v:4,l:'Abril'},
  {v:5,l:'Mayo'},{v:6,l:'Junio'},{v:7,l:'Julio'},{v:8,l:'Agosto'},
  {v:9,l:'Septiembre'},{v:10,l:'Octubre'},{v:11,l:'Noviembre'},{v:12,l:'Diciembre'},
];

const anioActual = new Date().getFullYear();
const ANIOS = [anioActual-1, anioActual, anioActual+1];

export const camposMetaMensual = [
  {
    nombre: 'anio', etiqueta: 'Año', tipoForm: 'select',
    obligatorio: true, ancho: '80px', ordenListado: 1, valorDefecto: anioActual,
    renderForm: ({ form, handleChange }) => (
      <select className="form-select" name="anio" value={form.anio ?? anioActual} onChange={handleChange}>
        {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    ),
    render: (f) => f.anio,
  },
  {
    nombre: 'mes', etiqueta: 'Mes', tipoForm: 'select',
    obligatorio: true, ancho: '120px', ordenListado: 2, valorDefecto: new Date().getMonth() + 1,
    renderForm: ({ form, handleChange }) => (
      <select className="form-select" name="mes" value={form.mes ?? (new Date().getMonth()+1)} onChange={handleChange}>
        {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
      </select>
    ),
    render: (f) => f.nombreMes ?? f.mes,
  },
  {
    nombre: 'metaIngresos', etiqueta: 'Meta Ingresos', tipoForm: 'number',
    obligatorio: true, ancho: '140px', ordenListado: 3, valorDefecto: 0,
    render: (f) => fmt(f.metaIngresos),
  },
  {
    nombre: 'metaVentas', etiqueta: 'Meta Ventas (uds)', tipoForm: 'number',
    ancho: '120px', ordenListado: 4,
    render: (f) => f.metaVentas ?? '-',
  },
  { nombre: 'observaciones', etiqueta: 'Observaciones', tipoForm: 'text', maxLength: 500, soloFormulario: true },
  { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
];

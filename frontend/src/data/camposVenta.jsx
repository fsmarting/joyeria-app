import { GET_GRUPOS_POR_CODIGOS } from "../graphql/grupoQueries.js";
import { OBTENER_TERCEROS_POR_TIPO } from "../graphql/terceroQueries.js";
import { OBTENER_USUARIOS } from "../graphql/ventaQueries.js";
import { GET_PRODUCTOS_CURSOR } from "../graphql/productoQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";

export const camposVenta = [
  {
    nombre: "fecha",
    etiqueta: "Fecha",
    tipoForm: "date",
    obligatorio: true,
    ancho: "100px",
    ordenListado: 1,
    valorDefecto: new Date().toISOString().split("T")[0],
    valueTransformer: (v) => {
      if (!v) return "";
      const s = String(v);
      return s.includes("T")
        ? s.split("T")[0]
        : new Date(Number(s)).toISOString().split("T")[0];
    },
    render: (f) => {
      if (!f.fecha) return "-";
      const d = new Date(Number(f.fecha));
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-CO");
    },
  },
  {
    nombre: "clienteId",
    etiqueta: "Clienta",
    tipoForm: "select",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 2,
    relationConfig: {
      query: OBTENER_TERCEROS_POR_TIPO,
      dataKey: "obtenerTercerosPorTipo",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { tipoCodigo: "CLIENTE" },
    },
    render: (f) => f.cliente?.nombre ?? "-",
  },
  {
    nombre: "productoId",
    etiqueta: "Producto",
    tipoForm: "select",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 3,
    relationConfig: {
      query: GET_PRODUCTOS_CURSOR,
      dataKey: "productosFiltradosCursor",
      isEdge: true,
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { first: 100 },
    },
    render: (f) =>
      f.producto ? `${f.producto.referencia} — ${f.producto.nombre}` : "-",
  },
  {
    // ── NUEVO — antes cada venta era siempre 1 unidad (implícito, sin
    // campo). Ahora es un valor real y precioVenta pasa a ser el precio
    // POR UNIDAD.
    nombre: "cantidad",
    etiqueta: "Cantidad",
    tipoForm: "number",
    obligatorio: true,
    ancho: "90px",
    ordenListado: 4,
    valorDefecto: 1,
    render: (f) => f.cantidad ?? 1,
  },
  {
    nombre: "canalId",
    etiqueta: "Canal llegada",
    tipoForm: "select",
    ancho: "120px",
    ordenListado: 5,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "CRM", subcatalogoCodigo: "CANA" },
    },
    render: (f) => f.canal?.nombre ?? "-",
  },
  {
    nombre: "medioPagoId",
    etiqueta: "Medio pago",
    tipoForm: "select",
    obligatorio: true,
    ancho: "120px",
    ordenListado: 6,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "VENT", subcatalogoCodigo: "MPAG" },
    },
    render: (f) => f.medioPago?.nombre ?? "-",
  },
  {
    nombre: "precioVenta",
    etiqueta: "Precio venta (unitario)",
    tipoForm: "number",
    obligatorio: true,
    ancho: "140px",
    ordenListado: 7,
    valorDefecto: 0,
    render: (f) => fmt(f.precioVenta),
  },
  {
    // ── NUEVO — total = precioVenta (unitario) × cantidad. Solo listado,
    // no se edita — se deriva de los otros dos campos.
    nombre: "total",
    etiqueta: "Total",
    soloListado: true,
    ancho: "130px",
    ordenListado: 8,
    ordenable: false,
    render: (f) => (
      <strong className="text-success">
        {fmt(Number(f.precioVenta ?? 0) * Number(f.cantidad ?? 1))}
      </strong>
    ),
  },
  {
    nombre: "vendedoraId",
    etiqueta: "Vendedora",
    tipoForm: "select",
    ancho: "140px",
    ordenListado: 9,
    relationConfig: {
      query: OBTENER_USUARIOS,
      dataKey: "obtenerUsuarios",
      valueField: "id",
      displayField: "nombre",
    },
    render: (f) => f.vendedora?.nombre ?? "-",
  },
  {
    // ── CAMBIO — antes se elegía manualmente al crear la venta (única de
    // las 3 formas que lo pedía). Ahora lo calcula el servidor según medio
    // de pago (igual que muestrario y cotización), y solo cambia por medio
    // de "✓ Confirmar pago" o "🚫 Anular venta". Por eso sale del formulario.
    nombre: "estadoId",
    etiqueta: "Estado",
    soloListado: true,
    ancho: "120px",
    ordenListado: 10,
    render: (f) => {
      const c =
        f.estado?.codigo === "CONF"
          ? "success"
          : f.estado?.codigo === "ENPR"
            ? "warning"
            : f.estado?.codigo === "ANUL"
              ? "danger"
              : "secondary";
      return <span className={`badge bg-${c}`}>{f.estado?.nombre ?? "-"}</span>;
    },
  },
  {
    // Columna de origen — solo listado, no aparece en formulario
    nombre: "origenLabel",
    etiqueta: "Origen",
    soloListado: true,
    ancho: "140px",
    ordenListado: 11,
    ordenable: false,
    render: (f) => {
      const label = f.origenLabel ?? "🛍️ Directa";
      const isCot = label.startsWith("📋");
      const isMue = label.startsWith("🧳");
      const color = isCot ? "info" : isMue ? "secondary" : "light";
      const text = isCot || isMue ? "white" : "dark";
      return (
        <span
          className={`badge bg-${color} text-${text}`}
          style={{ fontSize: 11 }}
        >
          {label}
        </span>
      );
    },
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

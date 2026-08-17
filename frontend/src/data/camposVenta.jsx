import { GET_GRUPOS_POR_CODIGOS } from "../graphql/grupoQueries.js";
import { OBTENER_TERCEROS_POR_TIPO } from "../graphql/terceroQueries.js";
import { OBTENER_USUARIOS } from "../graphql/ventaQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";

// ── CAMBIO (ronda 34) — campos de la CABEZA de una venta (numero
// autogenerado/cliente/vendedora/canal/medio de pago/fecha). Los
// productos (antes mezclados en esta misma fila: productoId/cantidad/
// precioVenta/total) ahora se agregan desde el panel de detalle, igual
// que los insumos de una Compra — ver Venta.jsx (VentaPanel).
export const camposVenta = [
  {
    // ── NUEVO — número correlativo VTA-{año}-{consecutivo}, generado por
    // el servidor. Mismo tratamiento que "numero" en camposMuestrario.
    nombre: "numero",
    etiqueta: "N° Venta",
    tipoForm: "text",
    maxLength: 20,
    ancho: "120px",
    ordenListado: 1,
    ocultarEnCreacion: true,
    readOnly: true,
  },
  {
    nombre: "fecha",
    etiqueta: "Fecha",
    tipoForm: "date",
    obligatorio: true,
    ancho: "100px",
    ordenListado: 2,
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
    ordenListado: 3,
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
    nombre: "canalId",
    etiqueta: "Canal llegada",
    tipoForm: "select",
    ancho: "120px",
    ordenListado: 4,
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
    ordenListado: 5,
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
    nombre: "vendedoraId",
    etiqueta: "Vendedora",
    tipoForm: "select",
    ancho: "140px",
    ordenListado: 6,
    relationConfig: {
      query: OBTENER_USUARIOS,
      dataKey: "obtenerUsuarios",
      valueField: "id",
      displayField: "nombre",
    },
    render: (f) => f.vendedora?.nombre ?? "-",
  },
  {
    // ── NUEVO — antes solo había 1 producto por venta. Ahora la cantidad
    // de líneas se ve aquí, igual que "N° Insumos" en camposCompra.
    nombre: "totalItems",
    etiqueta: "N° Productos",
    soloListado: true,
    ancho: "100px",
    ordenListado: 7,
    render: (f) => f.totalItems ?? 0,
  },
  {
    // ── CAMBIO — antes "Total" era precioVenta × cantidad de una sola
    // fila. Ahora es la suma de todas las líneas de la venta (calculado
    // en el servidor, ver Venta.valorTotal).
    nombre: "valorTotal",
    etiqueta: "Valor Total",
    soloListado: true,
    ancho: "130px",
    ordenListado: 8,
    render: (f) => (
      <strong className="text-success">{fmt(f.valorTotal)}</strong>
    ),
  },
  {
    nombre: "estadoId",
    etiqueta: "Estado",
    soloListado: true,
    ancho: "120px",
    ordenListado: 9,
    // ── CAMBIO (ronda 40) — se agrega ENTR ("Entregada", el cierre real
    // del ciclo — cliente ya tiene la pieza). CONF cambia de verde a azul
    // porque ya no es el estado "final": ahora verde queda reservado para
    // Entregada, y Confirmada (pago verificado, pieza aún sin entregar)
    // se ve como un paso intermedio, no como el punto de llegada.
    render: (f) => {
      const c =
        f.estado?.codigo === "ENTR"
          ? "success"
          : f.estado?.codigo === "CONF"
            ? "primary"
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
    ordenListado: 10,
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

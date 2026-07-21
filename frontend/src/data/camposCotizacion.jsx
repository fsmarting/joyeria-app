import { GET_GRUPOS_POR_CODIGOS } from "../graphql/grupoQueries.js";
import { OBTENER_TERCEROS_POR_TIPO } from "../graphql/terceroQueries.js";
import { OBTENER_USUARIOS } from "../graphql/ventaQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";
const fmtF = (s) => (s ? new Date(s).toLocaleDateString("es-CO") : "-");

export const camposCotizacion = [
  {
    nombre: "numero",
    etiqueta: "N° Cotización",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 20,
    ancho: "130px",
    ordenListado: 1,
    soloLecturaEnEdicion: true,
  },
  {
    nombre: "fecha",
    etiqueta: "Fecha",
    tipoForm: "date",
    obligatorio: true,
    ancho: "100px",
    ordenListado: 2,
    valorDefecto: new Date().toISOString().split("T")[0],
    valueTransformer: (v) => (v ? v.split("T")[0] : ""),
    render: (f) => fmtF(f.fecha),
  },
  {
    nombre: "clienteId",
    etiqueta: "Clienta",
    tipoForm: "select",
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
    nombre: "vendedoraId",
    etiqueta: "Vendedora",
    tipoForm: "select",
    ancho: "130px",
    ordenListado: 4,
    relationConfig: {
      query: OBTENER_USUARIOS,
      dataKey: "obtenerUsuarios",
      valueField: "id",
      displayField: "nombre",
    },
    render: (f) => f.vendedora?.nombre ?? "-",
  },
  {
    nombre: "estadoId",
    etiqueta: "Estado",
    tipoForm: "select",
    obligatorio: true,
    ancho: "110px",
    ordenListado: 5,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "COTI", subcatalogoCodigo: "ESTC" },
    },
    render: (f) => {
      const color =
        {
          BORRA: "secondary",
          ENVIA: "primary",
          ACEPT: "success",
          RECHA: "danger",
          CONV: "info",
        }[f.estado?.codigo] ?? "secondary";
      return (
        <span className={`badge bg-${color}`}>{f.estado?.nombre ?? "-"}</span>
      );
    },
  },
  {
    nombre: "total",
    etiqueta: "Total",
    soloListado: true,
    ancho: "120px",
    ordenListado: 6,
    render: (f) => <strong className="text-success">{fmt(f.total)}</strong>,
  },
  {
    nombre: "validezDias",
    etiqueta: "Válida (días)",
    tipoForm: "number",
    ancho: "100px",
    ordenListado: 7,
    valorDefecto: 15,
    soloFormulario: false,
    render: (f) => `${f.validezDias ?? 15} días`,
  },
  {
    nombre: "nota",
    etiqueta: "Nota",
    tipoForm: "text",
    maxLength: 500,
    soloFormulario: true,
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

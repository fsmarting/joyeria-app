import { OBTENER_TERCEROS_POR_TIPO } from "../graphql/terceroQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";
const fmtF = (s) => (s ? new Date(s).toLocaleDateString("es-CO") : "-");

// ── NUEVO — campos de la CABEZA de una compra (numero/fecha/proveedor/
// nota). Los insumos (antes mezclados en esta misma fila) ahora se
// agregan desde el panel de detalle, igual que los productos de un
// Muestrario — ver camposMuestrario.jsx.
export const camposCompra = [
  {
    nombre: "numero",
    etiqueta: "N° Compra",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 20,
    ancho: "120px",
    ordenListado: 1,
    placeholder: "Ej: OC-2026-001",
  },
  {
    nombre: "fecha",
    etiqueta: "Fecha",
    tipoForm: "date",
    obligatorio: true,
    ancho: "110px",
    ordenListado: 2,
    valorDefecto: new Date().toISOString().split("T")[0],
    valueTransformer: (val) => (val ? val.split("T")[0] : ""),
    render: (f) => fmtF(f.fecha),
  },
  {
    nombre: "proveedorId",
    etiqueta: "Proveedor",
    tipoForm: "select",
    ancho: "160px",
    ordenListado: 3,
    relationConfig: {
      query: OBTENER_TERCEROS_POR_TIPO,
      dataKey: "obtenerTercerosPorTipo",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { tipoCodigo: "PROVEEDOR" },
    },
    render: (f) => f.proveedor?.nombre ?? <span className="text-muted">—</span>,
  },
  {
    nombre: "totalItems",
    etiqueta: "N° Insumos",
    soloListado: true,
    ancho: "100px",
    ordenListado: 4,
    render: (f) => f.totalItems ?? 0,
  },
  {
    nombre: "valorTotal",
    etiqueta: "Valor Total",
    soloListado: true,
    ancho: "130px",
    ordenListado: 5,
    render: (f) => fmt(f.valorTotal),
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

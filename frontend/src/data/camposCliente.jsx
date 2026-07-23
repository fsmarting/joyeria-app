import { GET_GRUPOS_POR_CODIGOS } from "../graphql/grupoQueries.js";

export const camposCliente = [
  {
    nombre: "telefono",
    etiqueta: "Teléfono",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 30,
    ancho: "120px",
    ordenListado: 1,
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    maxLength: 150,
    ancho: "auto",
    ordenListado: 2,
  },

  {
    nombre: "tierId",
    etiqueta: "Tier",
    tipoForm: "select",
    ancho: "100px",
    ordenListado: 3,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "CRM", subcatalogoCodigo: "TIER" },
    },
    render: (f) => {
      const n = f.tier?.nombre;
      if (!n) return "-";
      const c =
        n === "VIP" ? "warning" : n === "Recurrente" ? "primary" : "secondary";
      return <span className={`badge bg-${c}`}>{n}</span>;
    },
  },
  {
    nombre: "canalId",
    etiqueta: "Canal",
    tipoForm: "select",
    ancho: "110px",
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

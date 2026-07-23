import { GET_GRUPOS_POR_CODIGOS } from "../graphql/grupoQueries.js";
import {
  OBTENER_CATALOGOS,
  OBTENER_SUBCATALOGOS_POR_CATALOGO,
  OBTENER_EMPRESAS,
} from "../graphql/adminQueries.js";
import { OBTENER_USUARIOS_GLOBALES } from "../graphql/adminQueries.js";

// ── Empresa ──────────────────────────────────────────────────────
export const camposEmpresa = [
  {
    nombre: "codigo",
    etiqueta: "Código",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 20,
    ancho: "120px",
    ordenListado: 1,
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 100,
    ancho: "auto",
    ordenListado: 2,
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

// ── Usuario ──────────────────────────────────────────────────────
export const camposUsuario = [
  {
    nombre: "codigo",
    etiqueta: "Código",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 30,
    ancho: "120px",
    ordenListado: 1,
    soloLecturaEnEdicion: true,
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 100,
    ancho: "auto",
    ordenListado: 2,
  },
  {
    nombre: "password",
    etiqueta: "Contraseña",
    tipoForm: "password",
    obligatorio: true,
    soloFormulario: true,
  },
  {
    nombre: "correo",
    etiqueta: "correo",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 30,
    ancho: "200px",
    ordenListado: 3,
  },
  {
    nombre: "estadoId",
    etiqueta: "Estado",
    tipoForm: "select",
    ancho: "120px",
    ordenListado: 3,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "GRAL", subcatalogoCodigo: "EST" },
    },
    render: (f) => f.estado?.nombre ?? "-",
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

// ── UsuarioEmpresa ───────────────────────────────────────────────
export const camposUsuarioEmpresa = [
  {
    nombre: "empresaId",
    etiqueta: "Empresa",
    tipoForm: "select",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 1,
    soloLecturaEnEdicion: true,
    relationConfig: {
      query: OBTENER_EMPRESAS,
      dataKey: "obtenerEmpresas",
      valueField: "id",
      displayField: "nombre",
    },
    render: (f) => f.empresa?.nombre ?? "-",
  },
  {
    nombre: "usuarioId",
    etiqueta: "Usuario",
    tipoForm: "select",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 2,
    soloLecturaEnEdicion: true,
    relationConfig: {
      query: OBTENER_USUARIOS_GLOBALES,
      dataKey: "obtenerUsuariosGlobales",
      valueField: "id",
      displayField: "nombre",
      formatLabel: (u) => `${u.codigo} — ${u.nombre}`,
    },
    render: (f) =>
      f.usuario ? `${f.usuario.codigo} — ${f.usuario.nombre}` : "-",
  },
  {
    nombre: "rolId",
    etiqueta: "Rol",
    tipoForm: "select",
    obligatorio: true,
    ancho: "130px",
    ordenListado: 3,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "GRAL", subcatalogoCodigo: "ROL" },
    },
    render: (f) => f.rol?.nombre ?? "-",
  },
  {
    nombre: "costoHora",
    etiqueta: "Costo Hora",
    tipoForm: "number",
    ancho: "110px",
    ordenListado: 4,
    valorDefecto: 0,
  },
  {
    nombre: "comisionEfectivo",
    etiqueta: "Com. Efectivo %",
    tipoForm: "number",
    ancho: "120px",
    ordenListado: 5,
    valorDefecto: 20,
  },
  {
    nombre: "comisionTarjeta",
    etiqueta: "Com. Tarjeta %",
    tipoForm: "number",
    ancho: "120px",
    ordenListado: 6,
    valorDefecto: 13,
  },
  {
    nombre: "metaMensual",
    etiqueta: "Meta Mensual",
    tipoForm: "number",
    ancho: "120px",
    ordenListado: 7,
    valorDefecto: 0,
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

// ── Catálogo ─────────────────────────────────────────────────────
export const camposCatalogo = [
  {
    nombre: "empresa.codigo",
    etiqueta: "Empresa",
    tipoForm: "text",
    readOnly: true,
    disabled: true,
    soloFormulario: true,
  },
  {
    nombre: "codigo",
    etiqueta: "Código",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 20,
    ancho: "120px",
    ordenListado: 1,
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 100,
    ancho: "auto",
    ordenListado: 2,
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

// ── SubCatálogo ──────────────────────────────────────────────────
export const camposSubCatalogo = [
  {
    nombre: "catalogoId",
    etiqueta: "Catálogo",
    tipoForm: "select",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 1,
    soloLecturaEnEdicion: true,
    relationConfig: {
      query: OBTENER_CATALOGOS,
      dataKey: "obtenerCatalogos",
      valueField: "id",
      displayField: "nombre",
      formatLabel: (c) => `${c.codigo} — ${c.nombre}`,
      rellenarCampos: {
        "catalogo.codigo": "codigo",
        "catalogo.nombre": "nombre",
      },
    },
    render: (f) =>
      f.catalogo ? `${f.catalogo.codigo} — ${f.catalogo.nombre}` : "-",
  },
  {
    nombre: "catalogo.codigo",
    etiqueta: "Cód. Catálogo",
    tipoForm: "text",
    readOnly: true,
    soloFormulario: true,
  },
  {
    nombre: "codigo",
    etiqueta: "Código",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 20,
    ancho: "120px",
    ordenListado: 2,
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 100,
    ancho: "auto",
    ordenListado: 3,
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

// ── Grupo ────────────────────────────────────────────────────────
export const camposGrupo = [
  {
    nombre: "catalogoId",
    etiqueta: "Catálogo",
    tipoForm: "select",
    obligatorio: true,
    ancho: "150px",
    ordenListado: 1,
    soloFormulario: true,
    relationConfig: {
      query: OBTENER_CATALOGOS,
      dataKey: "obtenerCatalogos",
      valueField: "id",
      displayField: "nombre",
      formatLabel: (c) => `${c.codigo} — ${c.nombre}`,
    },
  },
  {
    nombre: "subcatalogoId",
    etiqueta: "SubCatálogo",
    tipoForm: "select",
    obligatorio: true,
    ancho: "150px",
    ordenListado: 2,
    soloFormulario: true,
    relationConfig: {
      query: OBTENER_SUBCATALOGOS_POR_CATALOGO,
      dataKey: "obtenerSubCatalogosPorCatalogo",
      valueField: "id",
      displayField: "nombre",
      formatLabel: (s) => `${s.codigo} — ${s.nombre}`,
      variables: { catalogoId: "catalogoId" },
      dependsOn: "catalogoId",
    },
    render: (f) =>
      f.subcatalogo
        ? `${f.subcatalogo.catalogo?.codigo} › ${f.subcatalogo.codigo}`
        : "-",
  },
  {
    nombre: "subcatalogo.catalogo.codigo",
    etiqueta: "Catálogo",
    soloListado: true,
    ancho: "100px",
    ordenListado: 3,
    render: (f) => f.subcatalogo?.catalogo?.codigo ?? "-",
  },
  {
    nombre: "subcatalogo.codigo",
    etiqueta: "SubCatálogo",
    soloListado: true,
    ancho: "120px",
    ordenListado: 4,
    render: (f) => f.subcatalogo?.codigo ?? "-",
  },
  {
    nombre: "codigo",
    etiqueta: "Código",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 20,
    ancho: "100px",
    ordenListado: 5,
  },
  {
    nombre: "nombre",
    etiqueta: "Nombre",
    tipoForm: "text",
    obligatorio: true,
    maxLength: 100,
    ancho: "auto",
    ordenListado: 6,
  },
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

import { GET_GRUPOS_POR_CODIGOS } from "../graphql/grupoQueries.js";
import { GET_PRODUCTOS_CURSOR } from "../graphql/productoQueries.js";
import { GET_JOYEROS_CURSOR } from "../graphql/joyeroQueries.js";
import { OBTENER_TERCEROS_POR_TIPO } from "../graphql/terceroQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";

export const camposOrdenProduccion = [
  // ── Número ──────────────────────────────────────────────────────
  // ── NUEVO — el número ya no lo escribe el usuario: el backend lo
  // genera solo al crear la orden (OP-{año}-{consecutivo}, ej.
  // OP-2026-001), igual que ya pasa con las remisiones. Se oculta en
  // el formulario de creación (no hay nada que capturar) y se muestra
  // de solo lectura al editar — mismo criterio que "estadoId".
  {
    nombre: "numero",
    etiqueta: "N° Orden",
    tipoForm: "text",
    maxLength: 20,
    ancho: "110px",
    ordenListado: 1,
    ocultarEnCreacion: true,
    readOnly: true,
  },
  // ── Producto ────────────────────────────────────────────────────
  {
    nombre: "productoId",
    etiqueta: "Producto",
    tipoForm: "autocomplete",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 2,
    relationConfig: {
      query: GET_PRODUCTOS_CURSOR,
      dataKey: "productosFiltradosCursor",
      isEdge: true,
      valueField: "id",
      displayField: "nombre",
      formatLabel: (p) => `${p.referencia} — ${p.nombre}`,
      fixedVariables: { first: 50 },
    },
    render: (fila) =>
      fila.producto
        ? `${fila.producto.referencia} — ${fila.producto.nombre}`
        : "-",
  },

  // ── Joyero ──────────────────────────────────────────────────────
  {
    nombre: "joyeroId",
    etiqueta: "Joyero",
    tipoForm: "select",
    obligatorio: true,
    ancho: "160px",
    ordenListado: 3,
    relationConfig: {
      query: OBTENER_TERCEROS_POR_TIPO,
      dataKey: "obtenerTercerosPorTipo",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { tipoCodigo: "JOYERO" },
    },
    render: (f) => f.joyero?.nombre ?? "-",
  },
  // ── Estado ──────────────────────────────────────────────────────
  // ── NUEVO — el ciclo de vida (Pendiente → En proceso → Entregada)
  // ahora lo mueve el sistema solo, según lo que ya calcula (primer
  // insumo entregado, cantidadEntregada === cantidadProgramada) — ver
  // ordenProduccion.resolvers.js (obtenerEstadoOrdenId + las 3
  // mutations que lo mueven). "Cancelada" pasa a ser una acción
  // dedicada (botón "🚫 Cancelar orden" en el detalle expandido, con
  // sus propias validaciones), no una opción más de este select.
  // Por eso:
  //  - ocultarEnCreacion: al crear la orden siempre queda en Pendiente
  //    — no hay nada real que mostrar ni que el usuario deba escoger.
  //  - readOnly: al editar, se ve el estado actual pero no se puede
  //    cambiar a mano desde aquí.
  //  - se quitó `obligatorio: true` — ya no aplica (el campo ni
  //    siquiera se muestra al crear).
  {
    nombre: "estadoId",
    etiqueta: "Estado",
    tipoForm: "select",
    ancho: "130px",
    ordenListado: 4,
    ocultarEnCreacion: true,
    readOnly: true,
    relationConfig: {
      query: GET_GRUPOS_POR_CODIGOS,
      dataKey: "gruposPorCodigos",
      valueField: "id",
      displayField: "nombre",
      fixedVariables: { catalogoCodigo: "PRODU", subcatalogoCodigo: "EORD" },
    },
    render: (fila) => {
      const n = fila.estado?.nombre ?? "-";
      const color =
        n === "Entregada"
          ? "success"
          : n === "Cancelada"
            ? "danger"
            : // 🩹 PARCHE: el nombre real del grupo (confirmado por el
              // usuario vía CSV de catálogos) es "En proceso" (código
              // PROC) — el texto anterior decía "En proceso con
              // joyero", que nunca hacía match, así que este badge se
              // quedaba siempre gris para las órdenes en proceso.
              n === "En proceso"
              ? "warning"
              : "secondary";
      return <span className={`badge bg-${color}`}>{n}</span>;
    },
  },
  // ── Cantidad programada ──────────────────────────────────────────
  {
    nombre: "cantidadProgramada",
    etiqueta: "Cant. Programada",
    tipoForm: "number",
    obligatorio: true,
    ancho: "120px",
    ordenListado: 5,
    valorDefecto: 1,
  },
  // ── Costo estándar unitario (solo listado) ───────────────────────
  {
    nombre: "costoUnitarioEstandard",
    etiqueta: "$ Costo Unit. Std",
    soloListado: true,
    ancho: "130px",
    ordenListado: 6,
    render: (fila) => fmt(fila.costoUnitarioEstandard),
  },
  // ── Costo total estándar (solo listado) ─────────────────────────
  {
    nombre: "costoTotalEstandard",
    etiqueta: "$ Total Std",
    soloListado: true,
    ancho: "120px",
    ordenListado: 7,
    render: (fila) => fmt(fila.costoTotalEstandard),
  },
  // ── Cantidad entregada (solo listado) ───────────────────────────
  {
    nombre: "cantidadEntregada",
    etiqueta: "Entregadas",
    soloListado: true,
    ancho: "90px",
    ordenListado: 8,
    render: (fila) => {
      const e = Number(fila.cantidadEntregada);
      const p = Number(fila.cantidadProgramada);
      const color = e === p ? "success" : e > 0 ? "warning" : "secondary";
      return (
        <span className={`badge bg-${color}`}>
          {e}/{p}
        </span>
      );
    },
  },
  // ── Fecha envío ──────────────────────────────────────────────────
  {
    nombre: "fechaEnvio",
    etiqueta: "Fecha Envío",
    tipoForm: "date",
    obligatorio: true,
    ancho: "110px",
    ordenListado: 9,
    valorDefecto: new Date().toISOString().split("T")[0],
    valueTransformer: (val) => (val ? val.split("T")[0] : ""),
    render: (f) => (f.fechaEnvio ? f.fechaEnvio.split("T")[0] : "-"),
  },
  // ── Fecha estimada ───────────────────────────────────────────────
  {
    nombre: "fechaEstimada",
    etiqueta: "Fecha Estimada",
    tipoForm: "date",
    ancho: "120px",
    ordenListado: 10,
    valueTransformer: (val) => (val ? val.split("T")[0] : ""),
    render: (f) => (f.fechaEstimada ? f.fechaEstimada.split("T")[0] : "-"),
  },
  // ── Descripción (solo formulario) ────────────────────────────────
  {
    nombre: "descripcion",
    etiqueta: "Descripción",
    tipoForm: "text",
    maxLength: 500,
    soloFormulario: true,
  },
  // ── Nota ────────────────────────────────────────────────────────
  {
    nombre: "nota",
    etiqueta: "Nota",
    tipoForm: "text",
    maxLength: 500,
    soloFormulario: true,
    placeholder: "Ej: Revisar peso al entregar — pedir comprobante",
  },
  // ── Version (hidden) ────────────────────────────────────────────
  {
    nombre: "version",
    tipoForm: "hidden",
    soloFormulario: true,
    valorDefecto: 1,
  },
];

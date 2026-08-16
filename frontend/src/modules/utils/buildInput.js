//buildinput.js
export function stripTypename(obj) {
  if (Array.isArray(obj)) return obj.map(stripTypename);
  if (obj && typeof obj === "object") {
    const o = {};
    for (const k of Object.keys(obj)) {
      if (k !== "__typename") o[k] = stripTypename(obj[k]);
    }
    return o;
  }
  return obj;
}

const ALLOWED_INPUT = {
  empresa: ["codigo", "nombre", "version"],
  catalogo: ["empresaId", "codigo", "nombre", "version"],
  subcatalogo: ["catalogoId", "codigo", "nombre", "version"],
  grupo: ["subcatalogoId", "codigo", "nombre", "version"],
  usuario: [
    "codigo",
    "nombre",
    "password",
    "correo",
    "estadoId",
    "foto",
    "version",
  ],
  usuarioempresa: [
    "empresaId",
    "usuarioId",
    "rolId",
    "costoHora",
    "comisionEfectivo",
    "comisionTarjeta",
    "metaMensual",
    "version",
  ],
  tercero: [
    "empresaId",
    "tipoId",
    "tipoDocumentoId",
    "numeroDocumento",
    "nombre",
    "telefono",
    "ciudad",
    "correo",
    "nota",
    "activo",
    "tierId",
    "canalId",
    "porcentajeDefecto",
    "version",
  ],
  // ── producto ─────────────────────────────────────────────────
  // "gramosOro" / "costoGramoOroUsado" ELIMINADOS — el oro ahora es
  // una línea más del BOM (ver entidad "productopiedra" gestionada
  // por AGREGAR_INSUMO_PRODUCTO / ACTUALIZAR_INSUMO_PRODUCTO desde
  // el panel de costeo, no por este buildInput genérico). Ya no
  // existen en ProductoInput/ProductoUpdateInput del backend — si se
  // llegaran a colar aquí, la mutación fallaría con un error de
  // GraphQL ("field is not defined"), así que se quitan también de
  // ALLOWED_INPUT/NUMERIC_FIELDS para que quede consistente.
  producto: [
    "empresaId",
    "referencia",
    "nombre",
    "categoriaId",
    "descripcion",
    "foto",
    "costoManoObra",
    "costoOtros",
    "multiplicador",
    "precioVenta",
    "version",
  ],
  piedra: [
    "empresaId",
    "codigo",
    "nombre",
    "tipoId",
    "unidadId",
    "foto",
    "costoEstandardPorUnidad",
    "activo",
    "version",
  ],
  // ── CAMBIO — "comprainsumo" (empresaId/numero/piedraId/proveedorId/
  // fecha/cantidad/costoUnitario/nota) se partió en cabeza + detalle:
  // "compra" es la cabeza (este EntidadGenerica genérico), los insumos
  // (piedraId/cantidad/costoUnitario) se agregan aparte desde el panel
  // de detalle de CompraInsumo.jsx, con sus propias mutations
  // (agregarItemCompra/actualizarItemCompra) — no pasan por buildInput,
  // mismo criterio que "muestrarioitem" (tampoco está en esta lista).
  compra: ["empresaId", "numero", "proveedorId", "fecha", "nota", "version"],
  ordenproduccion: [
    "empresaId",
    "numero",
    "descripcion",
    "productoId",
    "joyeroId",
    "estadoId",
    "cantidadProgramada",
    "cantidadEntregada",
    "fechaEnvio",
    "fechaEstimada",
    "fechaEntrega",
    "nota",
    "version",
  ],
  // ── CAMBIO (ronda 34) — Venta ahora es cabeza/detalle (mismo patrón
  // que Compra/CompraInsumo): productoId/cantidad/precioVenta salen de
  // aquí — se agregan con agregarItemVenta después de crear la cabeza.
  // numero tampoco viaja: lo genera el servidor, igual que Muestrario.
  // estadoId ya no viaja: el servidor lo calcula solo, o cambia por
  // confirmarVentaEfectivo/anularVenta.
  venta: [
    "empresaId",
    "clienteId",
    "vendedoraId",
    "canalId",
    "fecha",
    "medioPagoId",
    "version",
  ],
  conversacion: [
    "empresaId",
    "telefono",
    "nombreContacto",
    "clienteId",
    "usuarioId",
    "canalId",
    "tierEstimadoId",
    "fecha",
    "cotizo",
    "cerro",
    "motivoPerdidaId",
    "tiempoRespuesta",
    "usoProtocolo",
    "nota",
    "version",
  ],
  muestrario: ["empresaId", "vendedoraId", "fechaSalida", "nota", "version"],
  metamensual: [
    "anio",
    "mes",
    "metaIngresos",
    "metaVentas",
    "observaciones",
    "version",
  ],
  cotizacion: [
    "empresaId",
    "numero",
    "clienteId",
    "conversacionId",
    "vendedoraId",
    "fecha",
    "validezDias",
    "estadoId",
    "nota",
    "version",
  ],
  cotizacionitem: [
    "cotizacionId",
    "productoId",
    "precioUnitario",
    "cantidad",
    "nota",
    "version",
  ],
};

const NUMERIC_FIELDS = {
  empresa: ["id", "version"],
  catalogo: ["empresaId", "version"],
  subcatalogo: ["catalogoId", "version"],
  grupo: ["subcatalogoId", "version"],
  usuario: ["estadoId", "version"],
  usuarioempresa: [
    "empresaId",
    "usuarioId",
    "rolId",
    "costoHora",
    "comisionEfectivo",
    "comisionTarjeta",
    "metaMensual",
    "version",
  ],
  tercero: [
    "empresaId",
    "tipoId",
    "tipoDocumentoId",
    "tierId",
    "canalId",
    "porcentajeDefecto",
    "version",
  ],
  // "gramosOro" / "costoGramoOroUsado" eliminados — ver nota arriba.
  producto: [
    "empresaId",
    "categoriaId",
    "costoManoObra",
    "costoOtros",
    "multiplicador",
    "precioVenta",
    "version",
  ],
  piedra: [
    "empresaId",
    "tipoId",
    "unidadId",
    "costoEstandardPorUnidad",
    "version",
  ],
  compra: ["empresaId", "proveedorId", "version"],
  ordenproduccion: [
    "empresaId",
    "productoId",
    "joyeroId",
    "estadoId",
    "cantidadProgramada",
    "cantidadEntregada",
    "version",
  ],
  // ── CAMBIO (ronda 34) — productoId/cantidad/precioVenta salen de aquí,
  // ver comentario arriba en ALLOWED_INPUT.venta.
  venta: [
    "empresaId",
    "clienteId",
    "vendedoraId",
    "canalId",
    "medioPagoId",
    "version",
  ],
  conversacion: [
    "empresaId",
    "clienteId",
    "usuarioId",
    "canalId",
    "tierEstimadoId",
    "motivoPerdidaId",
    "version",
  ],
  muestrario: ["empresaId", "vendedoraId", "version"],
  metamensual: ["anio", "mes", "metaIngresos", "metaVentas", "version"],
  cotizacion: [
    "empresaId",
    "clienteId",
    "conversacionId",
    "vendedoraId",
    "estadoId",
    "validezDias",
    "version",
  ],
  cotizacionitem: [
    "cotizacionId",
    "productoId",
    "precioUnitario",
    "cantidad",
    "version",
  ],
};

const BOOLEAN_FIELDS = {
  tercero: ["activo"],
  piedra: ["activo"],
  conversacion: ["cotizo", "cerro", "usoProtocolo"],
};

export function buildInput({ form, entity, isUpdate }) {
  const allowed = ALLOWED_INPUT[entity] || [];
  const numeric = new Set(NUMERIC_FIELDS[entity] || []);
  const booleans = new Set(BOOLEAN_FIELDS[entity] || []);
  const clean = stripTypename({ ...form });

  Object.keys(clean).forEach((k) => {
    if (k.includes(".")) {
      delete clean[k];
      return;
    }
    if (
      typeof clean[k] === "object" &&
      clean[k] !== null &&
      !Array.isArray(clean[k])
    )
      delete clean[k];
  });

  [
    "costoTotal",
    "margen",
    "enStock",
    "cantidadDisponible",
    "valorEntregado",
    "costoUnitarioEstandard",
    "costoTotalEstandard",
    "merma",
    "totalPiezas",
    "totalVendidas",
    "totalEfectivoPendiente",
    "porcentajeComision",
    "valorComision",
    "especialidades",
    "nombreMes",
    "fec_creacion",
    "fec_actualizacion",
    "usu_creacion",
    "usu_actualizacion",
    "ultimo_login",
    "costoPiedras",
    "costoOro",
    "precioSugerido",
    "pvpConIva",
    "ivaValor",
    "conTarjeta",
    "comisionMax",
  ].forEach((k) => delete clean[k]);

  // ── CAMBIO — el cálculo de costoTotal a partir de cantidad ×
  // costoUnitario ya no aplica aquí (esos campos son de un insumo/ítem,
  // no de la cabeza "compra") — ahora vive en agregarItemCompra /
  // actualizarItemCompra del lado del servidor.

  const base = {};
  for (const key of allowed) {
    if (clean[key] !== undefined && clean[key] !== null && clean[key] !== "") {
      if (booleans.has(key))
        base[key] = clean[key] === true || clean[key] === "true";
      else base[key] = numeric.has(key) ? Number(clean[key]) : clean[key];
    }
  }

  for (const key of booleans) {
    if (allowed.includes(key))
      base[key] = clean[key] === true || clean[key] === "true";
  }

  if (isUpdate && clean.id != null) base.id = Number(clean.id);
  if (entity === "usuario" && isUpdate && !base.password) delete base.password;

  // ── Limpiar nulls en UPDATE ────────────────────────────────────
  // Prisma rechaza null en campos de relación en updateMany.
  // En update omitimos los campos null — Prisma los deja como estaban.
  if (isUpdate) {
    Object.keys(base).forEach((k) => {
      if (base[k] === null || base[k] === undefined) delete base[k];
    });
  }

  return base;
}

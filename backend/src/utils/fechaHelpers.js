// ── NUEVO — fechas "de calendario" elegidas con un selector de fecha
// (sin hora): Venta.fecha, Compra.fecha, Cotización.fecha, Muestrario.
// fechaSalida, OrdenProduccion.fechaEnvio/fechaEstimada. El frontend las
// manda como texto "2026-08-17", sin hora ni zona horaria.
//
// `new Date("2026-08-17")` lo interpreta como MEDIANOCHE UTC — no
// medianoche en Colombia. Bogotá está en UTC-5 (Colombia no tiene
// horario de verano, el offset nunca cambia), así que medianoche UTC cae
// en las 7:00 PM del día ANTERIOR en Bogotá. Como el resto de la
// aplicación siempre muestra las fechas en la hora LOCAL de quien la
// consulta (que en Río Rayo es hora de Colombia), esa media noche UTC se
// termina mostrando como el día de ANTES del que realmente se digitó —
// aunque en la base de datos (y en herramientas como DBeaver, que
// también la leen en UTC) quede guardada con el día correcto.
//
// Esta función ancla la fecha a medianoche en COLOMBIA en vez de
// medianoche UTC — así el mismo código que ya muestra las fechas en hora
// local en todo el frontend (Ventas, Compras, Cotizaciones, Muestrarios,
// Producción, Kardex de Productos y Piedras) las muestra correctas, sin
// tener que tocar ninguna pantalla.
//
// OJO — esto es distinto de los campos que capturan un INSTANTE real
// (Venta.fechaEntrega, Muestrario.fechaCierre, OrdenProduccion.
// fechaEntrega automática, movimientos de Kardex) — esos se crean con
// `new Date()` en el momento exacto en que ocurre la acción, ya están
// bien, y NO deben pasar por esta función.
const OFFSET_COLOMBIA = "-05:00";

export function parseFechaColombia(valor) {
  if (!valor) return null;
  const s = String(valor);
  // Ya viene con hora y/o zona horaria (por ejemplo un ISO completo) —
  // se respeta tal cual, no se reinterpreta.
  if (s.includes("T")) return new Date(s);
  return new Date(`${s}T00:00:00${OFFSET_COLOMBIA}`);
}

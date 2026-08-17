// ── NUEVO (ronda 39) — IVA discriminado en Producto/Cotización/Venta.
// "Deber ser" acordado con el usuario: en Colombia el precio que ve el
// cliente YA incluye el IVA (precioVenta/precioUnitario = precio con IVA
// incluido) — pero el IVA "es de papá gobierno, no de la joyería", así
// que el sistema debe poder discriminar cuánto de ese precio es base
// gravable y cuánto es IVA, usando SIEMPRE la tarifa vigente en el
// producto al momento de cada evento (cotizar, vender), nunca una tarifa
// fija en el código — porque si el gobierno cambia el % (ej. 19% → 20%),
// las transacciones ya hechas deben conservar la tarifa con la que
// realmente se cobraron, y las nuevas deben usar la tarifa vigente hoy.
//
// Regla de redondeo (confirmada con el usuario, con su propio ejemplo:
// precioVenta 100, IVA 19% → base 84,03, IVA 15,97): la base gravable se
// calcula y se redondea PRIMERO a 2 decimales, y el valor del IVA sale
// SIEMPRE por diferencia (precioConIva − baseGravable), nunca redondeando
// los dos de forma independiente — así los dos números siempre vuelven a
// sumar exactamente el precio original, sin ningún peso de diferencia.
export function calcularIvaDesglose(precioConIva, porcentajeIva) {
  const precio = Number(precioConIva) || 0;
  const pct = Number(porcentajeIva) || 0;
  const factor = 1 + pct / 100;
  const baseGravable = Math.round((precio / factor) * 100) / 100;
  const valorIva = Math.round((precio - baseGravable) * 100) / 100;
  return { baseGravable, valorIva };
}

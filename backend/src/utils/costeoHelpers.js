// ── NUEVO (ronda 42) — cálculo de costo de producción de un Producto,
// extraído de producto.resolvers.js (calcCosteoAsync) para poder
// reutilizarlo también al CONGELAR el costo de cada línea de Venta en el
// momento en que se crea (venta directa, desde muestrario, o conversión
// de cotización).
//
// "Deber ser" acordado con el usuario: la utilidad que se reparte entre
// las socias debe ser sobre el MARGEN real de cada venta — precio de
// venta (sin IVA) menos el costo de producir la pieza — no sobre el
// valor bruto de la venta como estaba antes (eso trataba como "ganancia"
// el costo del oro, las piedras, la mano de obra y los empaques). Y ese
// costo se congela al momento de la venta por la misma razón que ya se
// congeló el IVA: el costo de un producto cambia con el tiempo (sobre
// todo el oro), así que si se usara el costo de HOY para calcular la
// utilidad de una venta ya cerrada, esa utilidad repartida se movería
// sola cada vez que suba o baje el oro — lo cual no tiene sentido para
// una venta que ya se cerró y ya se repartió.
//
// Requiere que `producto.piedras` venga incluido con
// `piedra: { include: { tipo: true } }` (para detectar el oro) — ver
// `incCosteoProducto` más abajo, mismo criterio que `incBom` en
// producto.resolvers.js.
export async function calcularCostoProducto(producto, prisma) {
  const piedras = producto.piedras || [];
  let costoPiedras = 0;
  let costoOro = 0;

  for (const pp of piedras) {
    const esOro = pp.piedra?.tipo?.codigo === "ORO";
    let costoUnitario = Number(pp.costoEstandardUnitario);

    if (esOro) {
      // Mismo criterio que producto.resolvers.js: el oro siempre se
      // costea contra el último lote de CompraInsumo comprado, no contra
      // el costoEstandardUnitario guardado en el BOM.
      const ultimoLote = await prisma.compraInsumo.findFirst({
        where: {
          piedraId: pp.piedraId,
          deletedAt: null,
          compra: { empresaId: producto.empresaId, deletedAt: null },
        },
        orderBy: { compra: { fecha: "desc" } },
      });
      if (ultimoLote) costoUnitario = Number(ultimoLote.costoUnitario);
    }

    const totalLinea = Number(pp.cantidad) * costoUnitario;
    costoPiedras += totalLinea;
    if (esOro) costoOro += totalLinea;
  }

  const costoTotal =
    costoPiedras + Number(producto.costoManoObra) + Number(producto.costoOtros);

  return { costoPiedras, costoOro, costoTotal };
}

// Include de Prisma mínimo que necesita calcularCostoProducto — mismo
// criterio que `incBom` en producto.resolvers.js, reducido a lo
// estrictamente necesario (no hace falta unidad/tipoPiedra/categoria
// para calcular costo).
export const incCosteoProducto = {
  piedras: {
    where: { deletedAt: null },
    include: { piedra: { include: { tipo: true } } },
  },
};

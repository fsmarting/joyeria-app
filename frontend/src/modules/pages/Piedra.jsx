import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposPiedra } from "../../data/camposPiedra.jsx";
import {
  GET_PIEDRAS_CURSOR,
  CREAR_PIEDRA,
  ACTUALIZAR_PIEDRA,
  ELIMINAR_PIEDRA,
  GET_MOVIMIENTOS_INVENTARIO_PIEDRA,
} from "../../graphql/piedraQueries.js";

const fmtQ = (n, u = "", maxDigits = 4) =>
  n != null
    ? `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: maxDigits })} ${u}`.trim()
    : "-";
const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";

// ── NUEVO — visibilidad de inventario de insumos (Kardex) ────────────
// Mismo modelo que calcularKardex en Producto.jsx: el "saldo inicial" no
// está guardado en ninguna parte (Piedra no tiene una columna de stock
// propia — su verdad hoy es piedra.stockDisponible, la suma de
// cantidadDisponible de todas sus compras vigentes), así que se deduce
// hacia atrás desde ese único dato que sí es la verdad hoy.
const MESES_NOMBRE = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// ── NUEVO — Compras y Devoluciones separadas dentro de "Entradas" ────
// Antes "Entradas" era un solo número que sumaba compras nuevas y
// devoluciones de órdenes juntas — no se podía saber, sin abrir el
// detalle, cuánto de ese número era material nuevo comprado y cuánto era
// material propio que un joyero regresó. Ahora se separan usando el
// campo `tipo` que ya trae cada movimiento del backend (no hace falta
// tocar el resolver) — el total de "Entradas" para el cálculo del saldo
// sigue siendo compras + devoluciones, solo que ahora también se ve
// desglosado en la tabla.
// ── NUEVO — valorización (ronda 33) — mismo cálculo que las unidades,
// en paralelo y con su propio "saldo inicial en $" deducido hacia atrás
// desde piedra.valorStockDisponible (la suma de cantidadDisponible ×
// costo REAL de cada lote vigente, no un costo estándar). Cada
// movimiento ya trae su propio entradaValor/salidaValor/
// variacionCustodiaValor calculados en el backend con el costo real del
// lote que se movió, así que aquí solo se suman — sin inventar ningún
// costo nuevo del lado del frontend.
function calcularKardexInsumo(movimientos, saldoActualHoy, valorActualHoy) {
  const totalEntradas = movimientos.reduce((s, m) => s + m.entradaStock, 0);
  const totalSalidas = movimientos.reduce((s, m) => s + m.salidaStock, 0);
  const saldoInicial = saldoActualHoy - totalEntradas + totalSalidas;

  const totalEntradasValor = movimientos.reduce(
    (s, m) => s + m.entradaValor,
    0,
  );
  const totalSalidasValor = movimientos.reduce((s, m) => s + m.salidaValor, 0);
  const saldoInicialValor =
    valorActualHoy - totalEntradasValor + totalSalidasValor;

  const porMes = new Map();
  for (const m of movimientos) {
    const d = new Date(m.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!porMes.has(key)) {
      porMes.set(key, {
        compras: 0,
        devoluciones: 0,
        salidas: 0,
        comprasValor: 0,
        devolucionesValor: 0,
        salidasValor: 0,
        anio: d.getFullYear(),
        mes: d.getMonth() + 1,
      });
    }
    const acc = porMes.get(key);
    if (m.tipo === "Compra") {
      acc.compras += m.entradaStock;
      acc.comprasValor += m.entradaValor;
    } else if (m.tipo === "Devolución de orden") {
      acc.devoluciones += m.entradaStock;
      acc.devolucionesValor += m.entradaValor;
    }
    acc.salidas += m.salidaStock;
    acc.salidasValor += m.salidaValor;
  }

  const meses = Array.from(porMes.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  let saldoAnterior = saldoInicial;
  let saldoAnteriorValor = saldoInicialValor;
  const filas = [];
  for (const [
    key,
    {
      compras,
      devoluciones,
      salidas,
      comprasValor,
      devolucionesValor,
      salidasValor,
      anio,
      mes,
    },
  ] of meses) {
    const entradas = compras + devoluciones;
    const saldoActual = saldoAnterior + entradas - salidas;
    const entradasValor = comprasValor + devolucionesValor;
    const saldoActualValor = saldoAnteriorValor + entradasValor - salidasValor;
    const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
    const movimientosDelPeriodo = movimientos.filter(
      (m) => new Date(m.fecha) <= finDeMes,
    );
    const enPoderJoyeros = movimientosDelPeriodo.reduce(
      (s, m) => s + m.variacionCustodia,
      0,
    );
    const enPoderJoyerosValor = movimientosDelPeriodo.reduce(
      (s, m) => s + m.variacionCustodiaValor,
      0,
    );
    filas.push({
      key,
      anio,
      mes,
      saldoAnterior,
      compras,
      devoluciones,
      salidas,
      saldoActual,
      enPoderJoyeros,
      saldoActualValor,
      enPoderJoyerosValor,
    });
    saldoAnterior = saldoActual;
    saldoAnteriorValor = saldoActualValor;
  }
  return filas;
}

function MovimientosInventarioInsumoPanel({ piedra }) {
  const [verDetalle, setVerDetalle] = useState(false);
  const unidad = piedra.unidad?.nombre || "";

  const { data } = useQuery(GET_MOVIMIENTOS_INVENTARIO_PIEDRA, {
    variables: { piedraId: piedra.id },
    fetchPolicy: "network-only",
  });
  const movimientos = data?.movimientosInventarioPiedra || [];

  const kardex = useMemo(
    () =>
      calcularKardexInsumo(
        movimientos,
        Number(piedra.stockDisponible ?? 0),
        Number(piedra.valorStockDisponible ?? 0),
      ),
    [movimientos, piedra.stockDisponible, piedra.valorStockDisponible],
  );

  // ── NUEVO — dónde está hoy lo que "En poder de joyeros" del Kardex.
  // Se agrupa por orden (referencia) sumando variacionCustodia — igual
  // que pendientePorMuestrario en Producto.jsx, pero aquí cada fila es
  // una orden de producción y no un muestrario. Las órdenes que ya
  // devolvieron/consumieron todo (pendiente <= 0) no se muestran.
  const pendientePorJoyero = useMemo(() => {
    const porReferencia = new Map();
    for (const m of movimientos) {
      if (!m.variacionCustodia) continue;
      if (!porReferencia.has(m.referencia)) {
        porReferencia.set(m.referencia, {
          referencia: m.referencia,
          joyero: null,
          pendiente: 0,
          fechaEnvio: null,
        });
      }
      const acc = porReferencia.get(m.referencia);
      acc.pendiente += m.variacionCustodia;
      if (
        m.tipo === "Envío inicial a orden" ||
        m.tipo === "Envío adicional a orden"
      ) {
        acc.fechaEnvio = m.fecha;
        acc.joyero = m.joyero || acc.joyero;
      }
    }
    return Array.from(porReferencia.values()).filter((x) => x.pendiente > 0);
  }, [movimientos]);

  return (
    <div className="border rounded p-3 bg-white mt-3" style={{ fontSize: 12 }}>
      <div className="fw-bold mb-2" style={{ fontSize: 13 }}>
        📊 Movimientos de inventario
      </div>

      {kardex.length === 0 ? (
        <div className="text-muted">Sin movimientos registrados todavía.</div>
      ) : (
        <>
          <table className="table table-sm mb-2" style={{ fontSize: 12 }}>
            <thead>
              <tr className="table-dark">
                <th>Mes</th>
                <th>Saldo Anterior</th>
                <th>Compras</th>
                <th>Devoluciones</th>
                <th>Salidas</th>
                <th>Saldo Actual</th>
                <th>Valor Saldo Actual</th>
                <th>En poder de joyeros</th>
                <th>Valor en poder de joyeros</th>
              </tr>
            </thead>
            <tbody>
              {kardex.map((k) => (
                <tr key={k.key}>
                  <td>
                    {MESES_NOMBRE[k.mes - 1]} {k.anio}
                  </td>
                  <td>{fmtQ(k.saldoAnterior, unidad)}</td>
                  <td className="text-success">+{fmtQ(k.compras, unidad)}</td>
                  <td className="text-success">
                    +{fmtQ(k.devoluciones, unidad)}
                  </td>
                  <td className="text-danger">-{fmtQ(k.salidas, unidad)}</td>
                  <td className="fw-bold">{fmtQ(k.saldoActual, unidad)}</td>
                  <td className="fw-bold">{fmt(k.saldoActualValor)}</td>
                  <td>{fmtQ(k.enPoderJoyeros, unidad)}</td>
                  <td>{fmt(k.enPoderJoyerosValor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pendientePorJoyero.length > 0 && (
            <div className="mb-3">
              <div className="text-muted mb-1" style={{ fontSize: 11 }}>
                📍 Pendiente por joyero (hoy)
              </div>
              <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                <thead>
                  <tr className="table-dark">
                    <th>Orden</th>
                    <th>Joyero</th>
                    <th>Cantidad pendiente</th>
                    <th>Fecha envío</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientePorJoyero.map((p) => (
                    <tr key={p.referencia}>
                      <td>{p.referencia}</td>
                      <td>{p.joyero || "-"}</td>
                      <td className="fw-bold">{fmtQ(p.pendiente, unidad)}</td>
                      <td>
                        {p.fechaEnvio
                          ? new Date(p.fechaEnvio).toLocaleDateString("es-CO")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            className="btn btn-link btn-sm p-0"
            style={{ fontSize: 11 }}
            onClick={() => setVerDetalle(!verDetalle)}
          >
            {verDetalle
              ? "▲ Ocultar detalle de movimientos"
              : "▼ Ver detalle de movimientos"}
          </button>

          {verDetalle && (
            <table className="table table-sm mt-2" style={{ fontSize: 11 }}>
              <thead>
                <tr className="table-dark">
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Referencia</th>
                  <th>Cantidad</th>
                  <th>Joyero</th>
                </tr>
              </thead>
              <tbody>
                {/* ── NUEVO — mismo signo/color que ya usa la tabla mensual:
                    salidas en rojo con "-", entradas (compra o devolución)
                    en verde con "+" — antes esta tabla mostraba siempre el
                    valor absoluto de `cantidad`, sin importar si era una
                    entrada o una salida de insumo. */}
                {[...movimientos].reverse().map((m, i) => {
                  const esSalida = m.salidaStock > 0;
                  const esEntrada = m.entradaStock > 0;
                  return (
                    <tr key={i}>
                      <td>{new Date(m.fecha).toLocaleDateString("es-CO")}</td>
                      <td>{m.tipo}</td>
                      <td>{m.referencia}</td>
                      <td
                        className={
                          esSalida
                            ? "text-danger"
                            : esEntrada
                              ? "text-success"
                              : ""
                        }
                      >
                        {esSalida ? "-" : esEntrada ? "+" : ""}
                        {fmtQ(m.cantidad, unidad)}
                      </td>
                      <td>{m.joyero || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default function Piedra() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);

  const valoresFijos = useMemo(
    () => ({
      empresaId: empresaActual.id,
    }),
    [empresaActual],
  );

  return (
    <EntidadGenerica
      tipoEntidad="piedra"
      campos={camposPiedra}
      titulo="Insumos"
      descripcion="Catálogo de insumos: oro, diamantes, piedras y otros materiales — expanda ▸ para ver su Kardex de inventario"
      textoBoton="Insumo"
      queries={{
        GET: GET_PIEDRAS_CURSOR,
        CREAR: CREAR_PIEDRA,
        ACTUALIZAR: ACTUALIZAR_PIEDRA,
        ELIMINAR: ELIMINAR_PIEDRA,
      }}
      fixedValues={valoresFijos}
      getDetalle={(piedra) => (
        <MovimientosInventarioInsumoPanel piedra={piedra} />
      )}
    />
  );
}

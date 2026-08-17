import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposProducto } from "../../data/camposProducto.jsx";
import { GET_PIEDRAS_CURSOR } from "../../graphql/piedraQueries.js";
import { GET_GRUPOS_POR_CODIGOS } from "../../graphql/grupoQueries.js";
import {
  GET_PRODUCTOS_CURSOR,
  CREAR_PRODUCTO,
  ACTUALIZAR_PRODUCTO,
  ELIMINAR_PRODUCTO,
  AGREGAR_INSUMO_PRODUCTO,
  ACTUALIZAR_INSUMO_PRODUCTO,
  ELIMINAR_INSUMO_PRODUCTO,
  GET_MOVIMIENTOS_INVENTARIO_PRODUCTO,
  CREAR_AJUSTE_INVENTARIO,
} from "../../graphql/productoQueries.js";
import { GET_HISTORICO_COSTO_ORDENES } from "../../graphql/ordenProduccionQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";
// ── Cantidades/pesos: SIEMPRE con toLocaleString('es-CO'), nunca toFixed() ──
// toFixed() usa el punto como separador decimal (convención en-US). En
// es-CO el punto es separador de MILES y la coma es el decimal — así que
// "10.0000" (toFixed) se puede leer por error como "diez mil" en vez de
// "10". toLocaleString('es-CO') formatea correcto: 10 → "10", 10.5 → "10,5",
// 1234.5 → "1.234,5". Mismo patrón que fmtQ en OrdenProduccion.jsx.
const fmtQ = (n, u = "", maxDigits = 4) =>
  n != null
    ? `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: maxDigits })} ${u}`.trim()
    : "-";

// ── Fila de piedra editable ───────────────────────────────────
function PiedraRow({ item, onActualizar, onEliminar }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    cantidad: item.cantidad,
    costoEstandardUnitario: item.costoEstandardUnitario,
    descripcion: item.descripcion || "",
  });
  const total = Number(form.cantidad) * Number(form.costoEstandardUnitario);
  const unidad = item.piedra?.unidad?.nombre ?? "CT";
  const esOro = item.piedra?.tipo?.codigo === "ORO";

  return (
    <tr>
      <td>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {item.tipoPiedra?.nombre ?? item.tipoId}
        </span>
        {esOro && (
          <span
            className="badge bg-warning text-dark ms-1"
            style={{ fontSize: 9 }}
          >
            🥇 ORO
          </span>
        )}
      </td>
      <td>
        {edit ? (
          <input
            className="form-control form-control-sm"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            style={{ width: 140 }}
          />
        ) : (
          form.descripcion || <span className="text-muted">—</span>
        )}
      </td>
      <td>
        <strong>{item.piedra?.codigo}</strong> {item.piedra?.nombre}
      </td>
      <td>
        {edit ? (
          <input
            type="number"
            className="form-control form-control-sm"
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            style={{ width: 80 }}
          />
        ) : (
          fmtQ(item.cantidad, unidad)
        )}
      </td>
      <td>
        {edit ? (
          <input
            type="number"
            className="form-control form-control-sm"
            value={form.costoEstandardUnitario}
            onChange={(e) =>
              setForm({ ...form, costoEstandardUnitario: e.target.value })
            }
            style={{ width: 110 }}
          />
        ) : esOro ? (
          <span title="El costo real del oro se toma automáticamente del último lote comprado — este valor es solo de referencia.">
            {fmt(item.costoEstandardUnitario)} *
          </span>
        ) : (
          fmt(item.costoEstandardUnitario)
        )}
      </td>
      <td className="fw-bold">
        {edit ? fmt(total) : fmt(item.costoEstandardTotal)}
      </td>
      <td>
        {edit ? (
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-success py-0"
              onClick={() =>
                onActualizar({ ...item, ...form, version: item.version }).then(
                  () => setEdit(false),
                )
              }
            >
              ✓
            </button>
            <button
              className="btn btn-sm btn-secondary py-0"
              onClick={() => {
                setForm({
                  cantidad: item.cantidad,
                  costoEstandardUnitario: item.costoEstandardUnitario,
                  descripcion: item.descripcion || "",
                });
                setEdit(false);
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-outline-primary py-0 px-1"
              style={{ fontSize: 11 }}
              onClick={() => setEdit(true)}
            >
              ✏️
            </button>
            <button
              className="btn btn-sm btn-outline-danger py-0 px-1"
              style={{ fontSize: 11 }}
              onClick={() => onEliminar(item.id)}
            >
              ✕
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── NUEVO — visibilidad de inventario (Kardex) ──────────────────
// Arma el Kardex mensual a partir de la lista plana de movimientos que
// entrega el backend (movimientosInventarioProducto). El "saldo inicial"
// no está guardado en ninguna parte (no hay cierre de mes formal) — se
// deduce hacia atrás desde el único dato que sí es la verdad hoy:
// producto.enStock. Mismo modelo que se validó en la simulación de Excel
// antes de programar esto (hoja "Kardex Mensual" + "Cruce y Verificación").
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

function calcularKardex(movimientos, saldoActualHoy) {
  const totalEntradas = movimientos.reduce((s, m) => s + m.entradaStock, 0);
  const totalSalidas = movimientos.reduce((s, m) => s + m.salidaStock, 0);
  const saldoInicial = saldoActualHoy - totalEntradas + totalSalidas;

  const porMes = new Map();
  for (const m of movimientos) {
    const d = new Date(m.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!porMes.has(key)) {
      porMes.set(key, {
        entradas: 0,
        salidas: 0,
        anio: d.getFullYear(),
        mes: d.getMonth() + 1,
      });
    }
    const acc = porMes.get(key);
    acc.entradas += m.entradaStock;
    acc.salidas += m.salidaStock;
  }

  const meses = Array.from(porMes.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  let saldoAnterior = saldoInicial;
  const filas = [];
  for (const [key, { entradas, salidas, anio, mes }] of meses) {
    const saldoActual = saldoAnterior + entradas - salidas;
    const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
    const enMuestrarios = movimientos
      .filter((m) => new Date(m.fecha) <= finDeMes)
      .reduce((s, m) => s + m.variacionMuestrario, 0);
    filas.push({
      key,
      anio,
      mes,
      saldoAnterior,
      entradas,
      salidas,
      saldoActual,
      enMuestrarios,
    });
    saldoAnterior = saldoActual;
  }
  return filas;
}

function MovimientosInventarioPanel({ producto, refetch }) {
  const [verDetalle, setVerDetalle] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState("PERDIDA");
  const [cantidadAjuste, setCantidadAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");

  const { data, refetch: refetchMov } = useQuery(
    GET_MOVIMIENTOS_INVENTARIO_PRODUCTO,
    {
      variables: { productoId: producto.id },
      fetchPolicy: "network-only",
    },
  );
  const movimientos = data?.movimientosInventarioProducto || [];
  const [crearAjuste] = useMutation(CREAR_AJUSTE_INVENTARIO);

  // ── NUEVO — valorización SOLO del mes actual (ronda 33). A diferencia
  // de Insumos, Producto no maneja lotes con costo propio por fecha —
  // tiene un único costo vigente (producto.costoTotal, el mismo costeo
  // dinámico que ya se ve arriba en el panel de Costeo). Valorizar meses
  // PASADOS con el costo de HOY daría una cifra histórica falsa si el
  // costo cambió desde entonces (ej. subió el oro) — por eso solo se
  // muestra el valor del mes en curso, no de meses anteriores. Esto no
  // es un sistema contable con costeo histórico; es una foto de "cuánto
  // vale el inventario de este producto ahora mismo".
  const costoActual = Number(producto.costoTotal ?? 0);
  const hoy = new Date();
  const esMesActual = (k) =>
    k.anio === hoy.getFullYear() && k.mes === hoy.getMonth() + 1;

  const kardex = useMemo(
    () => calcularKardex(movimientos, Number(producto.enStock ?? 0)),
    [movimientos, producto.enStock],
  );

  // ── NUEVO — dónde está hoy el "En Muestrarios" del Kardex. Se agrupa
  // por muestrario (referencia) sumando variacionMuestrario — solo los
  // movimientos de muestrario mueven esa columna, así que agrupar TODO
  // el histórico ya da, sin filtrar por tipo, el pendiente real de cada
  // muestrario. Los que ya cuadraron (pendiente <= 0) no se muestran.
  const pendientePorMuestrario = useMemo(() => {
    const porReferencia = new Map();
    for (const m of movimientos) {
      if (!m.variacionMuestrario) continue;
      if (!porReferencia.has(m.referencia)) {
        porReferencia.set(m.referencia, {
          referencia: m.referencia,
          vendedora: null,
          pendiente: 0,
          fechaSalida: null,
        });
      }
      const acc = porReferencia.get(m.referencia);
      acc.pendiente += m.variacionMuestrario;
      if (m.tipo === "Salida a muestrario") {
        acc.fechaSalida = m.fecha;
        acc.vendedora = m.vendedora || acc.vendedora;
      }
    }
    return Array.from(porReferencia.values()).filter((x) => x.pendiente > 0);
  }, [movimientos]);

  const handleAjuste = async () => {
    if (!cantidadAjuste || Number(cantidadAjuste) <= 0)
      return toast.warning("Ingrese una cantidad válida");
    if (!motivoAjuste.trim()) return toast.warning("El motivo es obligatorio");
    try {
      await crearAjuste({
        variables: {
          input: {
            empresaId: producto.empresaId,
            productoId: producto.id,
            tipoMovimiento: tipoAjuste,
            cantidad: Number(cantidadAjuste),
            motivo: motivoAjuste.trim(),
          },
        },
      });
      toast.success("Ajuste registrado");
      setAjustando(false);
      setCantidadAjuste("");
      setMotivoAjuste("");
      await refetchMov();
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="border rounded p-3 bg-white mt-3" style={{ fontSize: 12 }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="fw-bold" style={{ fontSize: 13 }}>
          📊 Movimientos de inventario
        </div>
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => setAjustando(!ajustando)}
        >
          {ajustando ? "Cancelar" : "+ Registrar ajuste"}
        </button>
      </div>

      {ajustando && (
        <div className="border border-danger rounded p-2 mb-3 bg-light">
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0">Tipo</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 140 }}
                value={tipoAjuste}
                onChange={(e) => setTipoAjuste(e.target.value)}
              >
                <option value="PERDIDA">Pérdida</option>
                <option value="HALLAZGO">Hallazgo</option>
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Cantidad</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 90 }}
                min="1"
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="form-label mb-0">Motivo (obligatorio)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Ej: pieza extraviada en exhibición"
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value)}
              />
            </div>
            <button className="btn btn-danger btn-sm" onClick={handleAjuste}>
              Guardar ajuste
            </button>
          </div>
        </div>
      )}

      {kardex.length === 0 ? (
        <div className="text-muted">Sin movimientos registrados todavía.</div>
      ) : (
        <>
          <table className="table table-sm mb-2" style={{ fontSize: 12 }}>
            <thead>
              <tr className="table-dark">
                <th>Mes</th>
                <th>Saldo Anterior</th>
                <th>Entradas</th>
                <th>Salidas</th>
                <th>Saldo Actual</th>
                <th>Valor Saldo Actual</th>
                <th>En Muestrarios</th>
                <th>Valor En Muestrarios</th>
              </tr>
            </thead>
            <tbody>
              {/* ── NUEVO (ronda 33) — el valor solo se muestra en la fila
                  del mes actual; meses pasados quedan en "-" a propósito
                  (ver nota arriba: no hay costo histórico guardado por
                  mes, solo el costo vigente de hoy). */}
              {kardex.map((k) => (
                <tr key={k.key}>
                  <td>
                    {MESES_NOMBRE[k.mes - 1]} {k.anio}
                  </td>
                  <td>{k.saldoAnterior}</td>
                  <td className="text-success">+{k.entradas}</td>
                  <td className="text-danger">-{k.salidas}</td>
                  <td className="fw-bold">{k.saldoActual}</td>
                  <td className="fw-bold">
                    {esMesActual(k) ? fmt(k.saldoActual * costoActual) : "-"}
                  </td>
                  <td>{k.enMuestrarios}</td>
                  <td>
                    {esMesActual(k) ? fmt(k.enMuestrarios * costoActual) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pendientePorMuestrario.length > 0 && (
            <div className="mb-3">
              <div className="text-muted mb-1" style={{ fontSize: 11 }}>
                📍 Pendiente por muestrario (hoy)
              </div>
              <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                <thead>
                  <tr className="table-dark">
                    <th>Muestrario</th>
                    <th>Vendedora</th>
                    <th>Cantidad pendiente</th>
                    <th>Fecha salida</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientePorMuestrario.map((p) => (
                    <tr key={p.referencia}>
                      <td>{p.referencia}</td>
                      <td>{p.vendedora || "-"}</td>
                      <td className="fw-bold">{p.pendiente}</td>
                      <td>
                        {p.fechaSalida
                          ? new Date(p.fechaSalida).toLocaleDateString("es-CO")
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
                </tr>
              </thead>
              <tbody>
                {/* ── NUEVO — mismo signo/color que ya usa la tabla mensual:
                    salidas en rojo con "-", entradas en verde con "+" — antes
                    esta tabla mostraba siempre el valor absoluto de
                    `cantidad`, sin importar si era una entrada o una salida
                    de stock. Mismo criterio aplicado en Piedra.jsx. */}
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
                        {m.cantidad}
                      </td>
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

// ── Panel BOM + Costeo ────────────────────────────────────────
function BomPanel({ producto, refetch }) {
  const [selectedTipoId, setSelectedTipoId] = useState("");
  const [selectedPiedraId, setSelectedPiedraId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnit, setCostoUnit] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Tipos de piedra desde catálogo PRODU/TBOM
  const { data: dataTipos } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: "PRODU", subcatalogoCodigo: "TBOM" },
    fetchPolicy: "network-only",
  });
  const TIPOS = dataTipos?.gruposPorCodigos || [];

  // Catálogo de insumos (Piedras) — incluye el/los SKU de oro
  const { data: dataPiedras } = useQuery(GET_PIEDRAS_CURSOR, {
    variables: { first: 100 },
    fetchPolicy: "network-only",
  });
  const piedras = (dataPiedras?.piedrasFiltradosCursor?.edges || []).map(
    (e) => e.node,
  );
  // ── NUEVO — unidad real del insumo seleccionado en el formulario de
  // agregar (Gramos/Quilates/Unidades/etc.), para no rotular el campo
  // de cantidad como "Peso / gramos" cuando el insumo no se pesa.
  const unidadSeleccionada = piedras.find(
    (p) => String(p.id) === selectedPiedraId,
  )?.unidad?.nombre;

  // ── NUEVO — histórico de costo por orden de producción ──────────
  // Solo informativo: NO es costeo contable de inventario, es el
  // costoUnitarioEstandard que cada orden ya trae congelado desde que
  // se creó, listado en el tiempo para que el usuario vea la tendencia
  // (el oro puede subir o bajar) y decida su precio de venta con ese
  // contexto — ver conversación con el usuario sobre "deber ser" de
  // costeo de inventario (no aplica aquí porque este software no es
  // un sistema contable).
  const { data: dataHistorico } = useQuery(GET_HISTORICO_COSTO_ORDENES, {
    variables: { productoId: producto.id, limit: 10 },
    fetchPolicy: "network-only",
  });
  const historico = dataHistorico?.historicoCostoOrdenes || [];

  const [agregar] = useMutation(AGREGAR_INSUMO_PRODUCTO);
  const [actualizar] = useMutation(ACTUALIZAR_INSUMO_PRODUCTO);
  const [eliminar] = useMutation(ELIMINAR_INSUMO_PRODUCTO);
  const [actualizarProducto] = useMutation(ACTUALIZAR_PRODUCTO);

  const bomItems = producto.piedras || [];
  const tiposUsados = new Set(bomItems.map((b) => b.tipoId));
  const tiposDisponibles = TIPOS.filter((t) => !tiposUsados.has(t.id));
  const bomOro = bomItems.find((b) => b.piedra?.tipo?.codigo === "ORO");

  // El costeo (costoPiedras, costoOro, costoTotal, precioSugerido, etc.)
  // ya viene calculado desde el backend — costoPiedras incluye el oro
  // (es una línea más del BOM), así que NO se debe volver a sumar aquí.
  const costoPiedras = Number(producto.costoPiedras ?? 0);
  const costoOro = Number(producto.costoOro ?? 0);
  const costoMO = Number(producto.costoManoObra);
  const costoOtros = Number(producto.costoOtros);
  const costoTotal = Number(producto.costoTotal ?? 0);
  const mult = Number(producto.multiplicador ?? 2.25);
  const precioSugerido = Number(producto.precioSugerido ?? 0);
  const pctIva = Number(producto.porcentajeIva ?? 19);
  const pvpConIva = Number(producto.pvpConIva ?? 0);
  const precioVenta = Number(producto.precioVenta);
  const ivaValor = Number(producto.ivaValor ?? 0);
  const conTarjeta = Number(producto.conTarjeta ?? 0);
  const comisionMax = Number(producto.comisionMax ?? 0);

  const handleAgregar = async () => {
    if (!selectedTipoId || !selectedPiedraId || !cantidad || !costoUnit)
      return toast.warning("Complete tipo, piedra, peso y precio");
    try {
      await agregar({
        variables: {
          input: {
            productoId: producto.id,
            piedraId: Number(selectedPiedraId),
            tipoId: Number(selectedTipoId),
            descripcion: descripcion || null,
            cantidad: Number(cantidad),
            costoEstandardUnitario: Number(costoUnit),
            desperdicio: 0,
          },
        },
      });
      toast.success("Insumo agregado al costeo");
      setSelectedTipoId("");
      setSelectedPiedraId("");
      setCantidad("");
      setCostoUnit("");
      setDescripcion("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleActualizar = async (item) => {
    try {
      await actualizar({
        variables: {
          input: {
            id: item.id,
            tipoId: item.tipoId,
            descripcion: item.descripcion || null,
            cantidad: Number(item.cantidad),
            costoEstandardUnitario: Number(item.costoEstandardUnitario),
            desperdicio: 0,
            version: item.version,
          },
        },
      });
      toast.success("Actualizado");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Quitar este insumo del costeo?")) return;
    try {
      await eliminar({ variables: { id } });
      toast.success("Removido");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUsarSugerido = async () => {
    try {
      // 🩹 FIX (ronda 39) — antes mandaba precioVenta: precioSugerido (el
      // precio SIN IVA), pero precioVenta se formalizó como "precio con
      // IVA incluido" (ver "deber ser" acordado con el usuario) — el
      // botón "usar sugerido" debe llevar al precio CON IVA (pvpConIva),
      // no al precio antes de impuestos. También se manda porcentajeIva
      // explícito para que el update sea autocontenido.
      await actualizarProducto({
        variables: {
          input: {
            id: producto.id,
            empresaId: producto.empresaId,
            referencia: producto.referencia,
            nombre: producto.nombre,
            categoriaId: producto.categoria?.id ?? null,
            descripcion: producto.descripcion ?? null,
            foto: producto.foto ?? null,
            costoManoObra: Number(producto.costoManoObra),
            costoOtros: Number(producto.costoOtros),
            multiplicador: mult,
            porcentajeIva: pctIva,
            precioVenta: pvpConIva,
            version: producto.version,
          },
        },
      });
      toast.success(
        "Precio de venta actualizado al sugerido (con IVA incluido)",
      );
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="fw-bold mb-3" style={{ fontSize: 13 }}>
        🧱 Costeo — {producto.referencia} · {producto.nombre}
      </div>

      {/* ── Aviso si no hay catálogo TBOM ── */}
      {TIPOS.length === 0 && (
        <div className="alert alert-warning py-2 mb-3" style={{ fontSize: 12 }}>
          ⚠ Cree primero el subcatálogo <strong>TBOM</strong> en Admin →
          SubCatálogos (catálogo PRODU) y luego los grupos{" "}
          <strong>PRPAL, DEC1, DEC2, DEC3</strong> en Admin → Grupos.
        </div>
      )}

      {/* ── Aviso si aún no tiene línea de oro ── */}
      {!bomOro && (
        <div className="alert alert-info py-2 mb-3" style={{ fontSize: 12 }}>
          💡 Este producto todavía no tiene una línea de <strong>oro</strong> en
          el BOM. Agréguela abajo seleccionando el SKU de oro (ej. ORO-18K) en
          "Piedra / insumo" — su costo se toma automáticamente del último lote
          comprado.
        </div>
      )}

      {/* ── Tabla de piedras actuales ── */}
      {bomItems.length > 0 && (
        <table
          className="table table-sm align-middle mb-3"
          style={{ fontSize: 12 }}
        >
          <thead>
            <tr className="table-dark">
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Piedra/Insumo</th>
              {/* 🩹 antes decía "Peso" — correcto para el oro (que se
                  pesa en gramos) pero engañoso para insumos que se
                  manejan por unidad (ej. diamantes) o por quilate. Cada
                  fila ya muestra su propia unidad real al lado del
                  número (fmtQ), así que el encabezado solo necesita
                  ser genérico. */}
              <th>Cantidad</th>
              <th>$/Unidad</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bomItems.map((b) => (
              <PiedraRow
                key={b.id}
                item={b}
                onActualizar={handleActualizar}
                onEliminar={handleEliminar}
              />
            ))}
          </tbody>
        </table>
      )}
      {bomOro && (
        <div className="text-muted mb-3" style={{ fontSize: 11 }}>
          * El $/Unidad del oro mostrado en la tabla es de referencia — el
          costeo de abajo usa el precio del último lote de{" "}
          {bomOro.piedra?.codigo} registrado en Compras.
        </div>
      )}

      {/* ── Formulario agregar insumo (piedra u oro) ── */}
      {tiposDisponibles.length > 0 && (
        <div
          className="border rounded p-2 bg-white mb-3"
          style={{ fontSize: 12 }}
        >
          <div className="fw-bold mb-2">
            + Agregar insumo al costeo (piedra u oro)
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0">Tipo (rol en el BOM)</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 180 }}
                value={selectedTipoId}
                onChange={(e) => setSelectedTipoId(e.target.value)}
              >
                <option value="">Seleccione tipo...</option>
                {tiposDisponibles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Descripción (opcional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ width: 160 }}
                placeholder="Ej: oval, gota, princess"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label mb-0">Piedra / insumo</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 220 }}
                value={selectedPiedraId}
                onChange={(e) => {
                  setSelectedPiedraId(e.target.value);
                  const p = piedras.find(
                    (x) => String(x.id) === e.target.value,
                  );
                  if (p) setCostoUnit(String(p.costoEstandardPorUnidad));
                }}
              >
                <option value="">Seleccione...</option>
                {piedras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tipo?.codigo === "ORO" ? "🥇 " : ""}
                    {p.codigo} — {p.nombre} ({p.unidad?.nombre})
                  </option>
                ))}
              </select>
            </div>
            <div>
              {/* 🩹 antes decía "Peso / gramos (CT / GR)" fijo — correcto
                  solo para insumos que se pesan (oro, piedras en quilates).
                  Para insumos que se manejan por unidad (ej. diamantes
                  tallados, broches) esa etiqueta confundía: "peso" no
                  aplica y "gramos" es la unidad equivocada. Ahora muestra
                  la unidad real del insumo seleccionado (Piedra.unidad,
                  ej. "Gramos", "Quilates", "Unidades") y cae a un texto
                  genérico "Cantidad" mientras no haya nada seleccionado. */}
              <label className="form-label mb-0">
                Cantidad{unidadSeleccionada ? ` (${unidadSeleccionada})` : ""}
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 90 }}
                placeholder="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label mb-0">$ / Unidad (referencia)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 120 }}
                placeholder="0"
                value={costoUnit}
                onChange={(e) => setCostoUnit(e.target.value)}
              />
            </div>
            {cantidad && costoUnit && (
              <div className="text-muted" style={{ fontSize: 11 }}>
                = {fmt(Number(cantidad) * Number(costoUnit))}
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleAgregar}>
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* ── Aviso: precio de venta desactualizado vs. costo actual ── */}
      {/* Se dispara cuando el BOM cambió (se agregó/quitó un insumo, o el
          oro se recosteó contra un lote nuevo) y el precioVenta guardado
          quedó por debajo del precioSugerido recalculado — el margen real
          ya es menor al que el usuario cree que tiene. No se actualiza
          solo (precioVenta sigue siendo decisión manual, ver BomPanel más
          arriba) — solo se avisa, con acceso directo a "usar sugerido".
          🩹 FIX (ronda 39) — antes comparaba precioVenta (que YA incluye
          IVA) contra precioSugerido (que NO incluye IVA) — comparación de
          peras con manzanas que disparaba el aviso de forma incorrecta.
          Ahora compara contra pvpConIva (precio sugerido CON IVA), que es
          la misma base que precioVenta. */}
      {pvpConIva > 0 && precioVenta < pvpConIva && (
        <div
          className="alert alert-warning py-2 mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
          style={{ fontSize: 12 }}
        >
          <span>
            {precioVenta <= 0 ? (
              <>
                ⚠ Este producto todavía no tiene{" "}
                <strong>precio de venta</strong> definido — el precio sugerido
                (con IVA incluido) según el costeo actual es{" "}
                <strong>{fmt(pvpConIva)}</strong>.
              </>
            ) : (
              <>
                ⚠ El precio de venta actual (<strong>{fmt(precioVenta)}</strong>
                ) quedó por debajo del precio sugerido con IVA (
                <strong>{fmt(pvpConIva)}</strong>) — probablemente por un cambio
                reciente en el BOM. El margen real hoy es menor al esperado.
              </>
            )}
          </span>
          <button
            className="btn btn-warning btn-sm"
            onClick={handleUsarSugerido}
          >
            Actualizar a {fmt(pvpConIva)}
          </button>
        </div>
      )}

      {/* ── Resumen costeo ── */}
      <div className="border rounded p-3 bg-white" style={{ fontSize: 12 }}>
        <div className="fw-bold mb-2" style={{ fontSize: 13 }}>
          💰 Costeo & Precios
        </div>
        <div className="row g-2">
          <div className="col-md-6">
            <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
              <tbody>
                <tr>
                  <td className="text-muted">💎 Costo piedras (incluye oro)</td>
                  <td className="text-end">{fmt(costoPiedras)}</td>
                </tr>
                <tr>
                  <td className="text-muted ps-3">
                    ↳ 🥇 de las cuales, oro
                    {bomOro ? ` (${fmtQ(bomOro.cantidad, "g", 2)})` : ""}
                  </td>
                  <td className="text-end">{fmt(costoOro)}</td>
                </tr>
                <tr>
                  <td className="text-muted">🔧 Mano de obra</td>
                  <td className="text-end">{fmt(costoMO)}</td>
                </tr>
                <tr>
                  <td className="text-muted">📦 Empaques y otros</td>
                  <td className="text-end">{fmt(costoOtros)}</td>
                </tr>
                <tr className="table-dark fw-bold">
                  <td>COSTO TOTAL</td>
                  <td className="text-end">{fmt(costoTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="col-md-6">
            <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
              <tbody>
                <tr>
                  <td className="text-muted">
                    Precio sugerido (×{mult.toFixed(2)})
                  </td>
                  <td className="text-end fw-bold text-primary">
                    {fmt(precioSugerido)}
                  </td>
                </tr>
                {/* 🩹 FIX (ronda 39) — antes decía "PVP + IVA (×1.19)" fijo;
                    ahora refleja el % de IVA real de este producto (no
                    todos son 19% — ver campo "% IVA" arriba). */}
                <tr>
                  <td className="text-muted">
                    PVP c/IVA (×{(1 + pctIva / 100).toFixed(2)})
                  </td>
                  <td className="text-end fw-bold">{fmt(pvpConIva)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Precio venta actual</td>
                  <td className="text-end fw-bold text-success">
                    {fmt(precioVenta)}
                    {/* 🩹 FIX (ronda 39) — antes comparaba contra
                        precioSugerido (sin IVA); ahora contra pvpConIva
                        (con IVA), consistente con handleUsarSugerido. */}
                    {precioVenta !== pvpConIva && (
                      <button
                        className="btn btn-link btn-sm p-0 ms-2"
                        style={{ fontSize: 11 }}
                        onClick={handleUsarSugerido}
                      >
                        usar sugerido
                      </button>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">IVA ({pctIva.toFixed(0)}%)</td>
                  <td className="text-end">{fmt(ivaValor)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Con tarjeta (+7%)</td>
                  <td className="text-end">{fmt(conTarjeta)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Comisión máx (20%)</td>
                  <td className="text-end">{fmt(comisionMax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── NUEVO — histórico de costo por orden de producción ── */}
      {/* Referencia informativa para apoyar la decisión de precio de venta:
          el costo por unidad de cada orden ya fabricada (congelado al
          crearse, no cambia si luego se edita el BOM), en orden del tiempo,
          para ver la tendencia — el oro puede subir o bajar. NO es un
          costeo contable de inventario (promedio ponderado, PEPS, etc.):
          este software no es un sistema contable, esa valoración formal
          vive en su sistema contable. El costeo de arriba (BOM) sigue
          siendo el que manda para saber cuánto cuesta producir HOY. */}
      {historico.length > 0 && (
        <div
          className="border rounded p-3 bg-white mt-3"
          style={{ fontSize: 12 }}
        >
          <div className="fw-bold mb-2" style={{ fontSize: 13 }}>
            📈 Histórico de costo — últimas órdenes de producción
          </div>
          <div className="text-muted mb-2" style={{ fontSize: 11 }}>
            Costo por unidad de cada orden ya fabricada (congelado al momento de
            crearse) — útil para ver cómo se ha movido el costo (p. ej. por
            variación del precio del oro) y darle contexto a su precio de venta.
            No reemplaza el costeo de arriba, que refleja el costo de producir
            HOY.
          </div>
          <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr className="table-dark">
                <th>Fecha envío</th>
                <th>Orden</th>
                <th>Cant. prog.</th>
                <th>Cant. entregada</th>
                <th>Costo unitario</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((o, i) => {
                const anterior = historico[i + 1]; // fila más antigua (la lista viene más nueva → más vieja)
                let variacion = null;
                if (anterior) {
                  const diff =
                    Number(o.costoUnitarioEstandard) -
                    Number(anterior.costoUnitarioEstandard);
                  const base = Number(anterior.costoUnitarioEstandard);
                  variacion = { diff, pct: base > 0 ? (diff / base) * 100 : 0 };
                }
                return (
                  <tr key={o.id}>
                    <td>
                      {o.fechaEnvio
                        ? new Date(o.fechaEnvio).toLocaleDateString("es-CO")
                        : "-"}
                    </td>
                    <td>{o.numero}</td>
                    <td>{o.cantidadProgramada}</td>
                    <td>{o.cantidadEntregada}</td>
                    <td className="fw-bold">{fmt(o.costoUnitarioEstandard)}</td>
                    <td>
                      {variacion == null ? (
                        <span className="text-muted">—</span>
                      ) : variacion.diff > 0 ? (
                        <span className="text-danger">
                          ▲ {fmt(Math.abs(variacion.diff))} (
                          {Math.abs(variacion.pct).toFixed(1)}%)
                        </span>
                      ) : variacion.diff < 0 ? (
                        <span className="text-success">
                          ▼ {fmt(Math.abs(variacion.diff))} (
                          {Math.abs(variacion.pct).toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-muted">= sin cambio</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MovimientosInventarioPanel producto={producto} refetch={refetch} />
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Producto() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="producto"
      campos={camposProducto}
      titulo="Inventario & Costeo"
      descripcion="Expanda ▸ para costear — piedras, oro y precio sugerido calculado automáticamente"
      textoBoton="Producto"
      queries={{
        GET: GET_PRODUCTOS_CURSOR,
        CREAR: CREAR_PRODUCTO,
        ACTUALIZAR: ACTUALIZAR_PRODUCTO,
        ELIMINAR: ELIMINAR_PRODUCTO,
      }}
      fixedValues={{ empresaId: empresaActual.id }}
      getDetalle={(producto, refetch) => (
        <BomPanel producto={producto} refetch={refetch} />
      )}
    />
  );
}

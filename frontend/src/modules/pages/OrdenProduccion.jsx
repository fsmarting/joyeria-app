import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposOrdenProduccion } from "../../data/camposOrdenProduccion.jsx";
import {
  GET_ORDENES_CURSOR,
  CREAR_ORDEN,
  ACTUALIZAR_ORDEN,
  ELIMINAR_ORDEN,
  REGISTRAR_ENTREGA,
  CONCILIAR_ENTREGA,
  CANCELAR_ORDEN,
  AGREGAR_DETALLE,
  REGISTRAR_MOVIMIENTO_INSUMO,
  ELIMINAR_DETALLE,
} from "../../graphql/ordenProduccionQueries.js";
import { GET_COMPRAS_POR_PIEDRA } from "../../graphql/compraInsumoQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";
const fmtQ = (n, u = "") =>
  n != null
    ? `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${u}`.trim()
    : "-";
const fmtF = (s) => (s ? new Date(s).toLocaleDateString("es-CO") : "-");

const BADGE_CONCILIACION = {
  PENDIENTE: "bg-secondary",
  CONCILIADO: "bg-success",
  DISPUTA: "bg-danger",
};

// ── NUEVO — ciclo de vida de la orden (ver ordenProduccion.resolvers.js) ──
const BADGE_ESTADO_ORDEN = {
  PEND: "bg-secondary",
  PROC: "bg-warning text-dark",
  ENTR: "bg-success",
  CANC: "bg-danger",
};

const BADGE_MOVIMIENTO = {
  INICIAL: "bg-secondary",
  ADICIONAL: "bg-warning text-dark",
  DEVOLUCION: "bg-success",
};
const LABEL_MOVIMIENTO = {
  INICIAL: "Envío inicial",
  ADICIONAL: "Envío adicional",
  DEVOLUCION: "Devolución",
};

// ── Conciliación teórica — ver Manual v5 §6.6 ─────────────────────
// Compara lo enviado (neto de devoluciones) contra lo que "debería"
// consumirse según BOM × piezas entregadas + % desperdicio de esa
// línea. Es solo informativo — no bloquea nada.
function badgeConciliacion(diferencia, consumoTeorico) {
  if (diferencia == null) return null;
  const tolerancia = Math.max(0.01, Math.abs(consumoTeorico || 0) * 0.02);
  if (diferencia > tolerancia)
    return { cls: "bg-warning text-dark", label: "Pendiente por devolver" };
  if (diferencia < -tolerancia)
    return { cls: "bg-danger", label: "Desperdicio > esperado" };
  return { cls: "bg-success", label: "OK" };
}

// ── Historial de movimientos de una línea de detalle ──────────────
function MovimientosHistorial({ movimientos }) {
  if (!movimientos?.length)
    return (
      <div className="text-muted" style={{ fontSize: 11 }}>
        Sin movimientos aún.
      </div>
    );
  return (
    <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Lote</th>
          <th>Cantidad</th>
          <th>Valor</th>
          <th>Fecha</th>
          <th>Nota</th>
        </tr>
      </thead>
      <tbody>
        {movimientos.map((m) => (
          <tr key={m.id}>
            <td>
              <span
                className={`badge ${BADGE_MOVIMIENTO[m.tipoMovimiento] || "bg-secondary"}`}
              >
                {LABEL_MOVIMIENTO[m.tipoMovimiento] || m.tipoMovimiento}
              </span>
            </td>
            <td>{m.compraInsumo?.numero || "—"}</td>
            <td>{fmtQ(m.cantidad)}</td>
            <td>{fmt(m.valor)}</td>
            <td>{fmtF(m.fecha)}</td>
            <td className="text-muted">{m.nota || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Formulario inline para registrar un movimiento (adicional o devolución) ──
function MovimientoForm({ detalle, onRegistrar, onCancelar }) {
  const [tipo, setTipo] = useState("ADICIONAL");
  const [compraSelId, setCompra] = useState(String(detalle.compraInsumoId));
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");

  const { data } = useQuery(GET_COMPRAS_POR_PIEDRA, {
    variables: { piedraId: detalle.piedraId },
    fetchPolicy: "network-only",
  });
  const lotes = data?.comprasPorPiedra || [];
  const unidad = detalle.piedra?.unidad?.nombre || "";

  const maxDevolucion =
    Number(detalle.cantidadEnviada) - Number(detalle.cantidadDevuelta);

  const confirmar = async () => {
    if (!compraSelId || !cantidad || Number(cantidad) <= 0)
      return toast.warning("Complete lote y cantidad");
    if (!nota.trim())
      return toast.warning("La nota es obligatoria — explique el motivo");
    if (tipo === "DEVOLUCION" && Number(cantidad) > maxDevolucion)
      return toast.error(`Máximo a devolver: ${fmtQ(maxDevolucion, unidad)}`);
    await onRegistrar({
      detalleOrdenProduccionId: detalle.id,
      compraInsumoId: Number(compraSelId),
      tipoMovimiento: tipo,
      cantidad: Number(cantidad),
      nota: nota.trim(),
    });
    setCantidad("");
    setNota("");
  };

  return (
    <div className="border rounded p-2 bg-white mt-1" style={{ fontSize: 11 }}>
      <div className="d-flex flex-wrap gap-2 align-items-end">
        <div>
          <label className="form-label mb-0">Tipo</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 140 }}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="ADICIONAL">Envío adicional</option>
            <option value="DEVOLUCION">Devolución</option>
          </select>
        </div>
        <div>
          <label className="form-label mb-0">Lote</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 200 }}
            value={compraSelId}
            onChange={(e) => setCompra(e.target.value)}
          >
            <option value={String(detalle.compraInsumoId)}>
              {detalle.compraInsumo?.numero} (lote inicial)
            </option>
            {lotes
              .filter((l) => String(l.id) !== String(detalle.compraInsumoId))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.numero} · Disp: {fmtQ(l.cantidadDisponible, unidad)}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="form-label mb-0">
            Cantidad{" "}
            {tipo === "DEVOLUCION" && `(máx ${fmtQ(maxDevolucion, unidad)})`}
          </label>
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 100 }}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label className="form-label mb-0">Nota (obligatoria)</label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Ej: piedra rota al engastar"
            maxLength={300}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={confirmar}>
          Registrar
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={onCancelar}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Fila de un insumo ya enviado (detalle) ─────────────────────────
function DetalleRow({ d, ordenCompleta, onRegistrarMovimiento, onEliminar }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarHist, setMostrarHist] = useState(false);
  const u = d.piedra?.unidad?.nombre || "";
  const esOro = d.piedra?.tipo?.codigo === "ORO";
  const badge = badgeConciliacion(d.diferenciaVsTeorico, d.consumoTeorico);

  return (
    <>
      <tr>
        <td>
          <strong>{d.piedra?.codigo}</strong> {d.piedra?.nombre}
          {esOro && (
            <span
              className="badge bg-warning text-dark ms-1"
              style={{ fontSize: 9 }}
            >
              🥇
            </span>
          )}
        </td>
        <td style={{ fontSize: 11 }}>
          {d.compraInsumo?.numero} · {fmtF(d.compraInsumo?.fecha)}
        </td>
        <td>{fmtQ(d.cantidad, u)}</td>
        <td>{fmt(d.costoUnitario)}</td>
        <td>{fmt(d.costoTotal)}</td>
        <td>{fmtQ(d.cantidadEnviada, u)}</td>
        <td>
          {Number(d.cantidadDevuelta) > 0 ? (
            <span className="badge bg-success">
              {fmtQ(d.cantidadDevuelta, u)}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td>
          {Number(d.merma) > 0 ? (
            <span className="badge bg-warning text-dark">
              {fmtQ(d.merma, u)}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td>
          {badge ? (
            <span
              className={`badge ${badge.cls}`}
              title={`Teórico: ${fmtQ(d.consumoTeorico, u)} · Enviado neto: ${fmtQ(d.enviadoNeto, u)} · Diferencia: ${fmtQ(d.diferenciaVsTeorico, u)}${ordenCompleta ? "" : " (preliminar — orden aún no entregada al 100%)"}`}
            >
              {badge.label}
              {!ordenCompleta && " *"}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td>
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-outline-primary py-0 px-1"
              style={{ fontSize: 11 }}
              onClick={() => setMostrarForm((v) => !v)}
            >
              + Mov.
            </button>
            <button
              className="btn btn-sm btn-outline-secondary py-0 px-1"
              style={{ fontSize: 11 }}
              onClick={() => setMostrarHist((v) => !v)}
            >
              {mostrarHist ? "▲" : "▼"} ({d.movimientos?.length || 0})
            </button>
            <button
              className="btn btn-sm btn-outline-danger py-0 px-1"
              style={{ fontSize: 11 }}
              onClick={() => onEliminar(d.id)}
            >
              ✕
            </button>
          </div>
        </td>
      </tr>
      {mostrarForm && (
        <tr>
          <td colSpan={10}>
            <MovimientoForm
              detalle={d}
              onRegistrar={async (input) => {
                await onRegistrarMovimiento(input);
                setMostrarForm(false);
              }}
              onCancelar={() => setMostrarForm(false)}
            />
          </td>
        </tr>
      )}
      {mostrarHist && (
        <tr className="bg-light">
          <td colSpan={10} className="py-2 px-3">
            <MovimientosHistorial movimientos={d.movimientos} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Fila de historial de entregas con conciliación ────────────────
function EntregaRow({ e, onConciliar }) {
  const [expandido, setExpandido] = useState(false);
  const [estado, setEstado] = useState(e.estadoConciliacion);
  const [nota, setNota] = useState(e.notaConciliacion || "");
  const badge = BADGE_CONCILIACION[e.estadoConciliacion] || "bg-secondary";
  const hayDiferencia =
    e.cantidadJoyero !== null &&
    e.cantidadJoyero !== undefined &&
    e.cantidadJoyero !== e.cantidad;

  return (
    <>
      <tr>
        <td>
          <strong style={{ fontFamily: "monospace" }}>
            {e.numeroRemision}
          </strong>
        </td>
        <td className="text-muted" style={{ fontSize: 11 }}>
          {e.numeroJoyero || "—"}
        </td>
        <td>{fmtF(e.fecha)}</td>
        <td>
          <span className="badge bg-success">{e.cantidad} piezas</span>
        </td>
        <td>
          {hayDiferencia ? (
            <span className="badge bg-warning text-dark">
              {e.cantidadJoyero} piezas ⚠
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td>{fmt(e.valorEntregado)}</td>
        <td>
          <span className={`badge ${badge}`}>{e.estadoConciliacion}</span>
        </td>
        <td>
          {e.estadoConciliacion !== "CONCILIADO" && (
            <button
              className="btn btn-sm btn-outline-secondary py-0 px-1"
              style={{ fontSize: 11 }}
              onClick={() => setExpandido(!expandido)}
            >
              {expandido ? "▲" : "▼"} Conciliar
            </button>
          )}
        </td>
      </tr>
      {expandido && (
        <tr className="bg-light">
          <td colSpan={8} className="py-2 px-3">
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div>
                <label className="form-label mb-0" style={{ fontSize: 12 }}>
                  Estado
                </label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 140 }}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                >
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="CONCILIADO">Conciliado ✓</option>
                  <option value="DISPUTA">Disputa ⚠</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label mb-0" style={{ fontSize: 12 }}>
                  Nota de conciliación
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  maxLength={500}
                  placeholder="Ej: Joyero acepta 4 piezas, la 5ta quedó sin terminar"
                  value={nota}
                  onChange={(ev) => setNota(ev.target.value)}
                />
              </div>
              <button
                className="btn btn-success btn-sm"
                onClick={() =>
                  onConciliar(e.id, estado, nota, e.version).then(() =>
                    setExpandido(false),
                  )
                }
              >
                Guardar conciliación
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Fila de sugerencia — insumo del BOM que aún no se ha enviado ──
function SugerenciaRow({ bom, cantidadProgramada, onConfirmar }) {
  const [compraSelId, setCompra] = useState("");
  const [incluirDesp, setIncluirDesp] = useState(false);
  const [cantOverride, setCantOverride] = useState(null); // null = usar el cálculo automático

  const { data } = useQuery(GET_COMPRAS_POR_PIEDRA, {
    variables: { piedraId: bom.piedraId },
    fetchPolicy: "network-only",
  });
  const lotes = data?.comprasPorPiedra || [];
  const compraActual = lotes.find((c) => String(c.id) === String(compraSelId));
  const unidad = bom.piedra?.unidad?.nombre || "";
  const esOro = bom.piedra?.tipo?.codigo === "ORO";

  const cantidadNecesaria = Number(bom.cantidad) * Number(cantidadProgramada);
  const desperdicioSugerido =
    cantidadNecesaria * (Number(bom.desperdicio || 0) / 100);
  const cantidadCalculada = incluirDesp
    ? cantidadNecesaria + desperdicioSugerido
    : cantidadNecesaria;
  const cantidadAEnviar =
    cantOverride !== null ? Number(cantOverride) : cantidadCalculada;

  const costoUnitario = compraActual ? Number(compraActual.costoUnitario) : 0;
  const costoTotal =
    Number(bom.cantidad) * costoUnitario * Number(cantidadProgramada);
  const valorEnviado = cantidadAEnviar * costoUnitario;

  const confirmar = () => {
    if (!compraSelId) return toast.warning("Seleccione el lote de compra");
    if (
      compraActual &&
      cantidadAEnviar > Number(compraActual.cantidadDisponible)
    )
      return toast.error(
        `Stock insuficiente en ese lote. Disponible: ${compraActual.cantidadDisponible}`,
      );
    onConfirmar({
      piedraId: bom.piedraId,
      compraInsumoId: Number(compraSelId),
      cantidad: Number(bom.cantidad),
      costoUnitario,
      costoTotal,
      desperdicio: Number(bom.desperdicio || 0),
      cantidadEnviada: cantidadAEnviar,
      valorEnviado,
    });
  };

  return (
    <tr>
      <td>
        <strong>{bom.piedra?.codigo}</strong> {bom.piedra?.nombre}
        {esOro && (
          <span
            className="badge bg-warning text-dark ms-1"
            style={{ fontSize: 9 }}
          >
            🥇
          </span>
        )}
        <div className="text-muted" style={{ fontSize: 10 }}>
          {bom.tipoPiedra?.nombre}
        </div>
      </td>
      <td>
        {/* 🩹 antes solo mostraba el total (ej. "15 Gramos") sin decir
            cómo se calculó — el usuario veía el resultado pero no la
            cuenta. Ahora se ve la receta por unidad y la cantidad de la
            orden debajo, en chiquito, para que quede claro de dónde
            sale el número grande. */}
        <div>{fmtQ(cantidadNecesaria, unidad)}</div>
        <div className="text-muted" style={{ fontSize: 10 }}>
          {fmtQ(bom.cantidad, unidad)} × {cantidadProgramada}{" "}
          {cantidadProgramada === 1 ? "unidad" : "unidades"}
        </div>
      </td>
      <td>
        {Number(bom.desperdicio || 0) > 0 ? (
          <label
            className="d-flex align-items-center gap-1"
            style={{ fontSize: 11 }}
          >
            <input
              type="checkbox"
              checked={incluirDesp}
              onChange={(e) => {
                setIncluirDesp(e.target.checked);
                setCantOverride(null);
              }}
            />
            +{fmtQ(desperdicioSugerido, unidad)} ({bom.desperdicio}%)
          </label>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td>
        <select
          className="form-select form-select-sm"
          style={{ width: 190 }}
          value={compraSelId}
          onChange={(e) => setCompra(e.target.value)}
        >
          <option value="">Seleccione lote...</option>
          {lotes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} · {fmt(c.costoUnitario)}/{unidad} · Disp:{" "}
              {fmtQ(c.cantidadDisponible, unidad)}
            </option>
          ))}
          {lotes.length === 0 && <option disabled>Sin stock</option>}
        </select>
      </td>
      <td>
        <input
          type="number"
          className="form-control form-control-sm"
          style={{ width: 90 }}
          value={
            cantOverride !== null ? cantOverride : cantidadAEnviar.toFixed(4)
          }
          onChange={(e) => setCantOverride(e.target.value)}
        />
      </td>
      <td className="text-muted" style={{ fontSize: 11 }}>
        {fmt(valorEnviado)}
      </td>
      <td>
        <button className="btn btn-primary btn-sm" onClick={confirmar}>
          Confirmar envío
        </button>
      </td>
    </tr>
  );
}

// ── Panel principal ───────────────────────────────────────────────
function DetallesPanel({ orden, refetch }) {
  const [cantEntrega, setCantEntrega] = useState("");
  const [cantJoyero, setCantJoyero] = useState("");
  const [numJoyero, setNumJoyero] = useState("");
  const [notaEntrega, setNotaEntrega] = useState("");

  const [registrarEntrega] = useMutation(REGISTRAR_ENTREGA);
  const [conciliar] = useMutation(CONCILIAR_ENTREGA);
  const [agregar] = useMutation(AGREGAR_DETALLE);
  const [registrarMovimiento] = useMutation(REGISTRAR_MOVIMIENTO_INSUMO);
  const [eliminar] = useMutation(ELIMINAR_DETALLE);
  const [cancelarOrden] = useMutation(CANCELAR_ORDEN);

  // ── NUEVO — cancelar orden ──────────────────────────────────────
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const estadoCodigo = orden.estado?.codigo;
  const puedeCancelar =
    Number(orden.cantidadEntregada) === 0 &&
    estadoCodigo !== "CANC" &&
    estadoCodigo !== "ENTR";
  const tieneInsumosPendientesDevolver = (orden.detalles || []).some(
    (d) => Number(d.cantidadEnviada) - Number(d.cantidadDevuelta) > 0,
  );

  const handleCancelarOrden = async () => {
    if (!motivoCancelacion.trim())
      return toast.warning("Indique el motivo de la cancelación");
    if (
      !window.confirm(
        "¿Cancelar esta orden? Los insumos ya entregados al joyero (si los hay) se devolverán al inventario. Esta acción no se puede deshacer.",
      )
    )
      return;
    try {
      await cancelarOrden({
        variables: {
          id: orden.id,
          version: orden.version,
          motivo: motivoCancelacion.trim(),
        },
      });
      toast.success(
        "Orden cancelada" +
          (tieneInsumosPendientesDevolver
            ? " — insumos devueltos al inventario"
            : ""),
      );
      setCancelando(false);
      setMotivoCancelacion("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const pendientes =
    Number(orden.cantidadProgramada) - Number(orden.cantidadEntregada);
  const entregas = orden.entregas || [];
  const enDisputa = entregas.filter(
    (e) => e.estadoConciliacion === "DISPUTA",
  ).length;

  // Insumos del BOM del producto que todavía no tienen fila en el detalle de esta orden
  const bomDelProducto = orden.producto?.piedras || [];
  const piedraIdsEnDetalle = new Set(
    (orden.detalles || []).map((d) => d.piedraId),
  );
  const sugerencias = bomDelProducto.filter(
    (b) => !piedraIdsEnDetalle.has(b.piedraId),
  );

  const handleEntrega = async () => {
    if (!cantEntrega || Number(cantEntrega) <= 0)
      return toast.warning("Ingrese la cantidad recibida");
    if (Number(cantEntrega) > pendientes)
      return toast.error(`Máximo ${pendientes} piezas pendientes`);
    try {
      await registrarEntrega({
        variables: {
          input: {
            ordenProduccionId: orden.id,
            cantidad: Number(cantEntrega),
            cantidadJoyero: cantJoyero ? Number(cantJoyero) : null,
            numeroJoyero: numJoyero || null,
            nota: notaEntrega || null,
          },
        },
      });
      const hayDif = cantJoyero && Number(cantJoyero) !== Number(cantEntrega);
      toast[hayDif ? "warning" : "success"](
        hayDif
          ? `⚠ Entrega en DISPUTA — Río Rayo: ${cantEntrega}, Joyero: ${cantJoyero}`
          : `Entrega registrada — Remisión generada`,
      );
      setCantEntrega("");
      setCantJoyero("");
      setNumJoyero("");
      setNotaEntrega("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleConciliar = async (id, estado, nota, version) => {
    try {
      await conciliar({
        variables: {
          input: {
            id,
            estadoConciliacion: estado,
            notaConciliacion: nota || null,
            version,
          },
        },
      });
      toast.success("Conciliación guardada");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleConfirmarSugerencia = async (input) => {
    try {
      await agregar({
        variables: { input: { ordenProduccionId: orden.id, ...input } },
      });
      toast.success("Insumo enviado — movimiento inicial registrado");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRegistrarMovimiento = async (input) => {
    try {
      await registrarMovimiento({ variables: { input } });
      toast.success(
        input.tipoMovimiento === "DEVOLUCION"
          ? "Devolución registrada"
          : "Envío adicional registrado",
      );
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleEliminar = async (id) => {
    if (
      !window.confirm(
        "¿Quitar este insumo? Se revertirán todos sus movimientos y se restaurará el stock.",
      )
    )
      return;
    try {
      await eliminar({ variables: { id } });
      toast.success("Insumo removido");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      {/* Resumen */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <strong style={{ fontSize: 13 }}>
          {orden.numero} · {orden.producto?.nombre}
        </strong>
        {orden.estado && (
          <span
            className={`badge ${BADGE_ESTADO_ORDEN[estadoCodigo] || "bg-secondary"}`}
          >
            {orden.estado.nombre}
          </span>
        )}
        <span className="text-muted small">
          Programadas: <strong>{orden.cantidadProgramada}</strong> · Recibidas:{" "}
          <strong
            className={pendientes === 0 ? "text-success" : "text-warning"}
          >
            {orden.cantidadEntregada}
          </strong>{" "}
          · Pendientes:{" "}
          <strong className={pendientes > 0 ? "text-danger" : "text-success"}>
            {pendientes}
          </strong>
          {enDisputa > 0 && (
            <span className="badge bg-danger ms-2">
              ⚠ {enDisputa} en disputa
            </span>
          )}
        </span>
        {/* ── NUEVO — Cancelar orden ── */}
        {puedeCancelar && !cancelando && (
          <button
            className="btn btn-outline-danger btn-sm ms-auto"
            onClick={() => setCancelando(true)}
          >
            🚫 Cancelar orden
          </button>
        )}
      </div>

      {/* ── NUEVO — formulario de cancelación ── */}
      {cancelando && (
        <div
          className="border border-danger rounded p-2 bg-white mb-3"
          style={{ fontSize: 12 }}
        >
          <div className="fw-bold text-danger mb-2">
            Cancelar orden {orden.numero}
          </div>
          {tieneInsumosPendientesDevolver && (
            <div
              className="alert alert-warning py-1 px-2 mb-2"
              style={{ fontSize: 11 }}
            >
              ⚠ Esta orden tiene insumos entregados al joyero sin producir — se
              devolverán automáticamente a sus lotes de compra.
            </div>
          )}
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="form-label mb-0">Motivo (obligatorio)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                maxLength={200}
                placeholder="Ej: el joyero no puede hacerla, el cliente canceló el pedido..."
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
              />
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleCancelarOrden}
            >
              Confirmar cancelación
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setCancelando(false);
                setMotivoCancelacion("");
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── Registrar entrega ── */}
      {/* 🩹 antes solo miraba pendientes>0 — una orden cancelada con
          cantidadEntregada=0 seguía teniendo pendientes>0 y este
          formulario se quedaba visible aunque el backend ya rechaza
          la mutation para órdenes en estado CANC. */}
      {pendientes > 0 && estadoCodigo !== "CANC" && (
        <div className="border rounded p-2 bg-white mb-3">
          <div className="fw-bold mb-2" style={{ fontSize: 13 }}>
            📦 Registrar entrega del joyero
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0" style={{ fontSize: 12 }}>
                Piezas recibidas por Río Rayo
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 150 }}
                min="1"
                max={pendientes}
                placeholder={`Máx: ${pendientes}`}
                value={cantEntrega}
                onChange={(e) => setCantEntrega(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label mb-0" style={{ fontSize: 12 }}>
                Piezas según joyero (si difiere)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 150 }}
                placeholder="Dejar vacío si coincide"
                value={cantJoyero}
                onChange={(e) => setCantJoyero(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label mb-0" style={{ fontSize: 12 }}>
                N° remisión del joyero (opcional)
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ width: 160 }}
                placeholder="Ej: REM-047"
                maxLength={50}
                value={numJoyero}
                onChange={(e) => setNumJoyero(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label mb-0" style={{ fontSize: 12 }}>
                Nota
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ width: 200 }}
                placeholder="Opcional"
                maxLength={200}
                value={notaEntrega}
                onChange={(e) => setNotaEntrega(e.target.value)}
              />
            </div>
            <button className="btn btn-success btn-sm" onClick={handleEntrega}>
              Registrar entrega
            </button>
          </div>
          {cantJoyero && cantJoyero !== cantEntrega && (
            <div
              className="alert alert-warning py-1 px-2 mt-2 mb-0"
              style={{ fontSize: 12 }}
            >
              ⚠ Diferencia detectada — esta entrega quedará en estado{" "}
              <strong>DISPUTA</strong> para conciliación.
            </div>
          )}
        </div>
      )}

      {/* ── Historial de entregas (con conciliación) ── */}
      {entregas.length > 0 && (
        <div className="mb-3">
          <div className="fw-bold mb-1" style={{ fontSize: 12 }}>
            Historial de entregas y remisiones
          </div>
          <table
            className="table table-sm align-middle mb-0"
            style={{ fontSize: 11 }}
          >
            <thead>
              <tr>
                <th>Remisión (sistema)</th>
                <th>N° Joyero</th>
                <th>Fecha</th>
                <th>Piezas Río Rayo</th>
                <th>Piezas Joyero</th>
                <th>Valor</th>
                <th>Conciliación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entregas.map((e) => (
                <EntregaRow key={e.id} e={e} onConciliar={handleConciliar} />
              ))}
            </tbody>
            <tfoot>
              <tr
                className="fw-bold"
                style={{ borderTop: "2px solid var(--border)" }}
              >
                <td colSpan={3}>Total acumulado</td>
                <td>{orden.cantidadEntregada} piezas</td>
                <td></td>
                <td>{fmt(orden.valorEntregado)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Insumos enviados ── */}
      <div className="fw-bold mb-1" style={{ fontSize: 12 }}>
        Insumos enviados al joyero
      </div>
      {(orden.detalles || []).length === 0 && (
        <p className="text-muted small mb-2">
          Sin insumos registrados todavía.
        </p>
      )}
      {(orden.detalles || []).length > 0 && (
        <table
          className="table table-sm table-striped align-middle mb-3"
          style={{ fontSize: 11 }}
        >
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Lote inicial</th>
              <th>Cant/pieza</th>
              <th>$ Unit.</th>
              <th>$ Total</th>
              <th>Enviado (total)</th>
              <th>Devuelto</th>
              <th>Merma</th>
              <th>Conciliación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(orden.detalles || []).map((d) => (
              <DetalleRow
                key={d.id}
                d={d}
                ordenCompleta={pendientes <= 0}
                onRegistrarMovimiento={handleRegistrarMovimiento}
                onEliminar={handleEliminar}
              />
            ))}
          </tbody>
        </table>
      )}
      {(orden.detalles || []).length > 0 && (
        <div className="text-muted mb-2" style={{ fontSize: 10 }}>
          Conciliación teórica: compara lo enviado contra lo que debería
          consumirse según el BOM × piezas entregadas (ver Manual §6.6).
          {pendientes > 0 &&
            " * = preliminar, la orden aún no se entregó al 100%."}
        </div>
      )}

      {/* ── Sugerencias del BOM — lo que falta por enviar ── */}
      {/* Mismo criterio: si la orden está cancelada, el backend ya
          rechaza nuevos envíos — no tiene sentido seguir sugiriéndolos. */}
      {sugerencias.length > 0 && estadoCodigo !== "CANC" && (
        <div className="border rounded p-2 bg-white" style={{ fontSize: 12 }}>
          <div className="fw-bold mb-2" style={{ fontSize: 12 }}>
            📋 Insumos del BOM pendientes de enviar (calculado:{" "}
            {orden.cantidadProgramada} × receta)
          </div>
          <table
            className="table table-sm align-middle mb-0"
            style={{ fontSize: 11 }}
          >
            <thead>
              <tr className="table-dark">
                <th>Insumo</th>
                <th>Necesario</th>
                <th>Desperdicio sugerido</th>
                <th>Lote</th>
                <th>A enviar</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sugerencias.map((bom) => (
                <SugerenciaRow
                  key={bom.id}
                  bom={bom}
                  cantidadProgramada={orden.cantidadProgramada}
                  onConfirmar={handleConfirmarSugerencia}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sugerencias.length === 0 &&
        bomDelProducto.length > 0 &&
        (orden.detalles || []).length > 0 && (
          <div className="text-success" style={{ fontSize: 11 }}>
            ✓ Todos los insumos del BOM de este producto ya tienen envío
            registrado.
          </div>
        )}
      {bomDelProducto.length === 0 && (
        <div className="alert alert-warning py-2" style={{ fontSize: 12 }}>
          ⚠ Este producto no tiene BOM configurado — vaya a Inventario →
          Productos y agregue sus insumos antes de enviar esta orden.
        </div>
      )}
    </div>
  );
}

export default function OrdenProduccion() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);
  return (
    <EntidadGenerica
      tipoEntidad="ordenproduccion"
      campos={camposOrdenProduccion}
      titulo="Órdenes de Producción"
      descripcion="Expanda ▸ para registrar entregas con remisión automática, insumos sugeridos del BOM y movimientos"
      textoBoton="Orden"
      queries={{
        GET: GET_ORDENES_CURSOR,
        CREAR: CREAR_ORDEN,
        ACTUALIZAR: ACTUALIZAR_ORDEN,
        ELIMINAR: ELIMINAR_ORDEN,
      }}
      fixedValues={{ empresaId: empresaActual.id }}
      getDetalle={(orden, refetch) => (
        <DetallesPanel orden={orden} refetch={refetch} />
      )}
    />
  );
}

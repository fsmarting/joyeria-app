import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposVenta } from "../../data/camposVenta.jsx";
import { GET_PRODUCTOS_CURSOR } from "../../graphql/productoQueries.js";
import {
  GET_VENTAS_CURSOR,
  CREAR_VENTA,
  ACTUALIZAR_VENTA,
  ELIMINAR_VENTA,
  AGREGAR_ITEM_VENTA,
  ACTUALIZAR_ITEM_VENTA,
  ELIMINAR_ITEM_VENTA,
  ANULAR_VENTA,
  GUARDAR_REPARTO,
  OBTENER_SOCIOS,
  CONFIRMAR_VENTA_EFECTIVO,
  ENTREGAR_VENTA,
} from "../../graphql/ventaQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";

// ── Fila de un producto ya agregado a la venta ─────────────────────
// ── NUEVO (ronda 34) — líneas que vienen de un muestrario o de una
// cotización convertida no se pueden editar/quitar desde aquí (mismo
// bloqueo que ya aplica el backend en eliminarItemVenta) — se anula la
// venta completa si hace falta revertirlas.
// ── CAMBIO (ronda 40) — se agrega `puedeEditar` (true solo mientras la
// venta sigue "En proceso" — ver "deber ser": en cuanto se confirma el
// pago, la venta se cierra para cambios de línea, mismo bloqueo que ya
// aplica el backend en agregar/actualizar/eliminarItemVenta).
function ItemRow({ item, puedeEditar, onActualizar, onEliminar }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    cantidad: item.cantidad,
    precioVenta: item.precioVenta,
  });
  const total = Number(form.cantidad) * Number(form.precioVenta);
  const esFijo = !!(item.muestrarioItemId || item.cotizacionItemId);

  return (
    <tr>
      <td>
        <strong>{item.producto?.referencia}</strong> {item.producto?.nombre}
      </td>
      <td>
        {edit ? (
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 80 }}
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
          />
        ) : (
          item.cantidad
        )}
      </td>
      <td>
        {edit ? (
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 110 }}
            value={form.precioVenta}
            onChange={(e) => setForm({ ...form, precioVenta: e.target.value })}
          />
        ) : (
          <>
            {fmt(item.precioVenta)}
            {/* ── NUEVO (ronda 39) — desglose de IVA congelado al momento
                de crear esta línea (ver "deber ser": el IVA "es de papá
                gobierno" — se muestra cuánto de este precio es base
                gravable y cuánto es IVA, con la tarifa vigente cuando SE
                VENDIÓ, no la de hoy). */}
            {item.porcentajeIva != null && (
              <div className="text-muted" style={{ fontSize: 10 }}>
                base {fmt(item.baseGravable)} + IVA {item.porcentajeIva}%{" "}
                {fmt(item.valorIva)}
              </div>
            )}
          </>
        )}
      </td>
      <td className="fw-bold">{edit ? fmt(total) : fmt(item.subtotal)}</td>
      <td>
        <span className="badge bg-light text-dark" style={{ fontSize: 11 }}>
          {item.origenLabel ?? "🛍️ Directa"}
        </span>
      </td>
      <td>
        {esFijo ? (
          <span
            className="text-muted"
            style={{ fontSize: 11 }}
            title="Viene de un muestrario o cotización — anule la venta completa para revertirla"
          >
            🔒
          </span>
        ) : !puedeEditar ? (
          <span
            className="text-muted"
            style={{ fontSize: 11 }}
            title="Esta venta ya no está en proceso — cree una venta nueva para agregar/cambiar productos"
          >
            🔒
          </span>
        ) : edit ? (
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-success py-0"
              onClick={() =>
                onActualizar({
                  id: item.id,
                  ...form,
                  version: item.version,
                }).then(() => setEdit(false))
              }
            >
              ✓
            </button>
            <button
              className="btn btn-sm btn-secondary py-0"
              onClick={() => {
                setForm({
                  cantidad: item.cantidad,
                  precioVenta: item.precioVenta,
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

// ── Panel de detalle — productos de esta venta ─────────────────────
function VentaPanel({ venta, refetch }) {
  const [selectedProductoId, setSelectedProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [precioVenta, setPrecioVenta] = useState("");

  const { data: dataProductos } = useQuery(GET_PRODUCTOS_CURSOR, {
    variables: { first: 100 },
    fetchPolicy: "network-only",
  });
  const productos = (dataProductos?.productosFiltradosCursor?.edges || []).map(
    (e) => e.node,
  );

  const [agregar] = useMutation(AGREGAR_ITEM_VENTA);
  const [actualizar] = useMutation(ACTUALIZAR_ITEM_VENTA);
  const [eliminar] = useMutation(ELIMINAR_ITEM_VENTA);

  const items = venta.items || [];
  // ── CAMBIO (ronda 40) — antes solo distinguía "anulada" de todo lo
  // demás. Ahora se agregar/editar/quitar productos solo mientras la
  // venta sigue "En proceso" (ver "deber ser" — una vez confirmado el
  // pago, la venta se cierra para nuevas líneas).
  const enProceso = venta.estado?.codigo === "ENPR";

  const handleAgregar = async () => {
    if (!selectedProductoId || !cantidad || !precioVenta)
      return toast.warning("Complete producto, cantidad y precio de venta");
    try {
      await agregar({
        variables: {
          input: {
            ventaId: venta.id,
            productoId: Number(selectedProductoId),
            cantidad: Number(cantidad),
            precioVenta: Number(precioVenta),
          },
        },
      });
      toast.success("Producto agregado a la venta");
      setSelectedProductoId("");
      setCantidad("1");
      setPrecioVenta("");
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
            cantidad: Number(item.cantidad),
            precioVenta: Number(item.precioVenta),
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
    if (!window.confirm("¿Quitar este producto de la venta?")) return;
    try {
      await eliminar({ variables: { id } });
      toast.success("Removido");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="fw-bold mb-3" style={{ fontSize: 13 }}>
        🛍️ Productos de la venta {venta.numero}
      </div>

      {items.length > 0 && (
        <table
          className="table table-sm align-middle mb-3"
          style={{ fontSize: 12 }}
        >
          <thead>
            <tr className="table-dark">
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio venta</th>
              <th>Subtotal</th>
              <th>Origen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                puedeEditar={enProceso}
                onActualizar={handleActualizar}
                onEliminar={handleEliminar}
              />
            ))}
          </tbody>
        </table>
      )}
      {items.length === 0 && (
        <div className="text-muted mb-3">
          Esta venta todavía no tiene productos agregados.
        </div>
      )}

      {!enProceso && (
        <div
          className="alert alert-secondary py-2 mb-0"
          style={{ fontSize: 12 }}
        >
          🔒 Esta venta ya no está en proceso — no se le pueden agregar más
          productos.
          {venta.estado?.codigo !== "ANUL" &&
            " Si el cliente quiere algo más, créele una venta nueva."}
        </div>
      )}
      {enProceso && (
        <div className="border rounded p-2 bg-white" style={{ fontSize: 12 }}>
          <div className="fw-bold mb-2">+ Agregar producto a esta venta</div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0">Producto</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 220 }}
                value={selectedProductoId}
                onChange={(e) => {
                  setSelectedProductoId(e.target.value);
                  const p = productos.find(
                    (x) => String(x.id) === e.target.value,
                  );
                  if (p) setPrecioVenta(String(p.precioVenta));
                }}
              >
                <option value="">Seleccione...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.referencia} — {p.nombre} (stock: {p.enStock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Cantidad</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 90 }}
                placeholder="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label mb-0">Precio venta (unitario)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 130 }}
                placeholder="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
              />
            </div>
            {cantidad && precioVenta && (
              <div className="text-muted" style={{ fontSize: 11 }}>
                = {fmt(Number(cantidad) * Number(precioVenta))}
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleAgregar}>
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel de reparto de utilidad ─────────────────────────────────────
function RepartoPanel({ venta, refetch }) {
  const { data: dataSocios } = useQuery(OBTENER_SOCIOS, {
    fetchPolicy: "network-only",
  });
  const socios = dataSocios?.obtenerSocios || [];

  // Inicializar con repartos existentes o % por defecto de cada socio
  const initRepartos = () => {
    if (venta.repartos?.length > 0) {
      return venta.repartos.map((r) => ({
        socioId: r.socioId,
        porcentaje: r.porcentaje,
      }));
    }
    return socios.map((s) => ({
      socioId: s.id,
      porcentaje: Number(s.porcentajeDefecto ?? 0),
    }));
  };

  const [repartos, setRepartos] = useState(initRepartos);
  const [guardar] = useMutation(GUARDAR_REPARTO);

  // 🩹 FIX — cuando esta venta todavía NO tenía reparto guardado
  // (venta.repartos vacío), initRepartos() se ejecuta UNA sola vez al
  // montar el componente (así funciona useState con función), y en ese
  // primer render `dataSocios` todavía no había llegado de la consulta
  // (fetchPolicy: network-only siempre pide al servidor) — así que
  // `socios` estaba vacío y `repartos` quedaba pegado en un array vacío
  // para siempre, aunque las socias ya aparecieran en pantalla (esas se
  // ven por el `|| { porcentaje: 0 }` de más abajo, que es solo un
  // valor de repuesto para pintar, no hace parte del estado real). Por
  // eso al escribir un % no se guardaba nada — updatePct mapeaba sobre
  // ese array vacío y no tenía nada que actualizar, y "Guardar reparto"
  // quedaba bloqueado porque el total siempre daba 0%. Este efecto
  // reinicializa `repartos` en cuanto las socias por fin llegan, pero
  // solo si todavía no hay nada real en el estado (no pisa lo que el
  // usuario ya haya escrito).
  useEffect(() => {
    if (repartos.length === 0 && socios.length > 0) {
      setRepartos(initRepartos());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socios.length]);

  const totalPct = repartos.reduce((s, r) => s + Number(r.porcentaje), 0);
  // ── CAMBIO (ronda 34) — el total de la venta ahora es la suma de
  // TODAS las líneas (venta.valorTotal, calculado en el servidor).
  const totalVenta = Number(venta.valorTotal);
  // ── CAMBIO (ronda 42) — la utilidad a repartir entre socias ya NO es
  // "valor bruto de venta − comisión" (eso ignoraba el costo de producir
  // la pieza). Ahora se usa venta.utilidadReparto, calculado en el
  // servidor sobre el MARGEN real: suma de (baseGravable − costoUnitario)
  // por línea, menos la comisión de la vendedora.
  const utilidad = Number(venta.utilidadReparto);

  const updatePct = (socioId, pct) => {
    setRepartos((prev) =>
      prev.map((r) =>
        r.socioId === socioId ? { ...r, porcentaje: Number(pct) } : r,
      ),
    );
  };

  const handleGuardar = async () => {
    if (Math.round(totalPct) !== 100)
      return toast.error(`Los % deben sumar 100 (actual: ${totalPct})`);
    try {
      await guardar({ variables: { ventaId: venta.id, repartos } });
      toast.success("Reparto guardado");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <strong style={{ fontSize: 13 }}>
          Reparto de utilidad — {venta.cliente?.nombre}
        </strong>
        <span className="text-muted small">
          Total: {fmt(totalVenta)} ({venta.totalItems} producto
          {venta.totalItems === 1 ? "" : "s"}) · Comisión{" "}
          {venta.vendedora?.nombre}: {fmt(venta.valorComision)} (
          {Number(venta.porcentajeComision).toFixed(1)}%) ·
          <strong> Utilidad a repartir: {fmt(utilidad)}</strong>
        </span>
      </div>

      <div className="d-flex flex-wrap gap-3 align-items-end">
        {socios.map((s) => {
          const r = repartos.find((x) => x.socioId === s.id) || {
            porcentaje: 0,
          };
          const valor = (utilidad * Number(r.porcentaje)) / 100;
          return (
            <div
              key={s.id}
              className="border rounded p-2 bg-white"
              style={{ minWidth: 160 }}
            >
              <div className="fw-bold mb-1" style={{ fontSize: 13 }}>
                {s.nombre}
              </div>
              <div className="d-flex align-items-center gap-1 mb-1">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: 70 }}
                  min="0"
                  max="100"
                  value={r.porcentaje}
                  onChange={(e) => updatePct(s.id, e.target.value)}
                />
                <span className="text-muted small">%</span>
              </div>
              <div className="text-success small fw-bold">{fmt(valor)}</div>
            </div>
          );
        })}

        <div>
          <div
            className={`badge mb-2 ${Math.round(totalPct) === 100 ? "bg-success" : "bg-danger"}`}
          >
            Total: {totalPct}%
          </div>
          <br />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGuardar}
            disabled={Math.round(totalPct) !== 100}
          >
            Guardar reparto
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NUEVO (ronda 40) — cierre del ciclo de vida de la venta: "En
// proceso" → "Confirmada" (ya verificó que le pagaron) → "Entregada" (el
// cliente ya tiene la pieza — venta cerrada). Es secuencial a propósito:
// no se puede entregar sin haber confirmado el pago primero (control
// interno básico en mercancía de alto valor — ver "deber ser" acordado).
// Tarjeta ya nace en Confirmada (se liquida al instante), así que este
// panel solo le muestra el botón que le toca según en qué paso va.
function EstadoVentaPanel({ venta, refetch }) {
  const [confirmar, { loading: confirmando }] = useMutation(
    CONFIRMAR_VENTA_EFECTIVO,
  );
  const [entregar, { loading: entregando }] = useMutation(ENTREGAR_VENTA);

  const handleConfirmar = async () => {
    try {
      await confirmar({ variables: { ventaId: venta.id } });
      toast.success("Pago confirmado");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleEntregar = async () => {
    if (
      !window.confirm("¿Confirma que el cliente ya se está llevando la pieza?")
    )
      return;
    try {
      await entregar({ variables: { id: venta.id, version: venta.version } });
      toast.success("Venta entregada — queda cerrada");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (venta.estado?.codigo === "ENPR") {
    return (
      <div
        className="alert alert-warning py-2 mb-0 d-flex justify-content-between align-items-center flex-wrap gap-2"
        style={{ fontSize: 12 }}
      >
        {/* ── CAMBIO (este fix) — antes decía "efectivo/transferencia sin
            verificar todavía", pero desde este fix TODA venta (incluida
            Tarjeta) nace en este estado, así que el mensaje ya no puede
            asumir el medio de pago. */}
        <span>💰 Pago pendiente de confirmar.</span>
        <button
          className="btn btn-success btn-sm"
          onClick={handleConfirmar}
          disabled={confirmando}
        >
          {confirmando ? "⏳ Confirmando..." : "✓ Confirmar pago"}
        </button>
      </div>
    );
  }

  if (venta.estado?.codigo === "CONF") {
    return (
      <div
        className="alert alert-primary py-2 mb-0 d-flex justify-content-between align-items-center flex-wrap gap-2"
        style={{ fontSize: 12 }}
      >
        <span>✓ Pago confirmado — falta entregarle la pieza al cliente.</span>
        <button
          className="btn btn-success btn-sm"
          onClick={handleEntregar}
          disabled={entregando}
        >
          {entregando ? "⏳ Entregando..." : "📦 Marcar como entregada"}
        </button>
      </div>
    );
  }

  if (venta.estado?.codigo === "ENTR") {
    return (
      <div className="alert alert-success py-2 mb-0" style={{ fontSize: 12 }}>
        📦 Entregada
        {venta.fechaEntrega
          ? ` el ${new Date(Number(venta.fechaEntrega)).toLocaleDateString("es-CO")}`
          : ""}{" "}
        — venta cerrada.
      </div>
    );
  }

  return null; // ANUL — no aplica, AnularVentaPanel ya muestra su propio aviso.
}

// ── NUEVO — panel de anulación, mismo patrón que "Cerrar orden (entrega
// parcial)" en Órdenes de Producción: acción dedicada + motivo obligatorio.
function AnularVentaPanel({ venta, refetch }) {
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [anular, { loading }] = useMutation(ANULAR_VENTA);

  const handleAnular = async () => {
    if (!motivo.trim())
      return toast.warning("Indique el motivo de la anulación");
    try {
      await anular({
        variables: {
          id: venta.id,
          version: venta.version,
          motivo: motivo.trim(),
        },
      });
      toast.success(
        "Venta anulada — el stock de todas sus líneas fue restaurado",
      );
      setAnulando(false);
      setMotivo("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (venta.estado?.codigo === "ANUL") {
    return (
      <div className="alert alert-secondary py-2 mb-0" style={{ fontSize: 12 }}>
        🚫 Esta venta está anulada.
      </div>
    );
  }

  // ── NUEVO (ronda 40) — una vez entregada, ya no se puede anular (el
  // stock ya no está físicamente aquí para restaurarlo) — ver "deber
  // ser" acordado. Una devolución real es un proceso aparte.
  if (venta.estado?.codigo === "ENTR") {
    return (
      <div className="alert alert-secondary py-2 mb-0" style={{ fontSize: 12 }}>
        📦 Esta venta ya fue entregada — no se puede anular. Si el cliente hizo
        una devolución, gestiónela por otro proceso.
      </div>
    );
  }

  if (!anulando) {
    return (
      <button
        className="btn btn-outline-danger btn-sm"
        onClick={() => setAnulando(true)}
      >
        🚫 Anular venta
      </button>
    );
  }

  return (
    <div
      className="border border-danger rounded p-3 bg-white"
      style={{ fontSize: 12 }}
    >
      <div className="fw-bold mb-2 text-danger">Anular venta</div>
      <p className="text-muted mb-2" style={{ fontSize: 11 }}>
        Se restaura automáticamente el stock de todos los productos de esta
        venta y se elimina el reparto de utilidad guardado.
      </p>
      <textarea
        className="form-control form-control-sm mb-2"
        placeholder="Motivo de la anulación (obligatorio)"
        rows={2}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="d-flex gap-2">
        <button
          className="btn btn-danger btn-sm"
          onClick={handleAnular}
          disabled={loading}
        >
          {loading ? "⏳ Anulando..." : "Confirmar anulación"}
        </button>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setAnulando(false)}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function VentaDetalle({ venta, refetch }) {
  return (
    <>
      <div className="p-3 bg-light border-top">
        <EstadoVentaPanel venta={venta} refetch={refetch} />
      </div>
      <VentaPanel venta={venta} refetch={refetch} />
      {venta.estado?.codigo !== "ANUL" && (
        <RepartoPanel venta={venta} refetch={refetch} />
      )}
      <div className="p-3 bg-light border-top">
        <AnularVentaPanel venta={venta} refetch={refetch} />
      </div>
    </>
  );
}

export default function Venta() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="venta"
      campos={camposVenta}
      titulo="Ventas"
      descripcion="Registro de ventas — permite varios productos por venta. La comisión se calcula automáticamente según medio de pago y vendedora. Expanda para agregar productos, repartir utilidad entre socias o anular."
      textoBoton="Venta"
      queries={{
        GET: GET_VENTAS_CURSOR,
        CREAR: CREAR_VENTA,
        ACTUALIZAR: ACTUALIZAR_VENTA,
        ELIMINAR: ELIMINAR_VENTA,
      }}
      fixedValues={{
        empresaId: empresaActual.id,
        fecha: new Date().toISOString().split("T")[0],
      }}
      getDetalle={(venta, refetch) => (
        <VentaDetalle venta={venta} refetch={refetch} />
      )}
    />
  );
}

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposMuestrario } from "../../data/camposMuestrario.jsx";
import { GET_GRUPOS_POR_CODIGOS } from "../../graphql/grupoQueries.js";
import { GET_PRODUCTOS_CURSOR } from "../../graphql/productoQueries.js";
import { OBTENER_TERCEROS_POR_TIPO } from "../../graphql/terceroQueries.js";
import {
  GET_MUESTRARIOS_CURSOR,
  CREAR_MUESTRARIO,
  ELIMINAR_MUESTRARIO,
  ACTUALIZAR_MUESTRARIO,
  AGREGAR_ITEM_MUESTRARIO,
  ELIMINAR_ITEM_MUESTRARIO,
  REGISTRAR_VENTA_MUESTRARIO,
  CONFIRMAR_VENTA_EFECTIVO,
  LIQUIDAR_MUESTRARIO,
} from "../../graphql/muestrarioQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";
const fmtF = (s) => (s ? new Date(s).toLocaleDateString("es-CO") : "-");

// ── Panel de ventas rápidas por item ─────────────────────────────
function VentaRapidaForm({ item, muestrario, onDone }) {
  const [clienteId, setClienteId] = useState("");
  const [precioVenta, setPrecioVenta] = useState(
    item.producto?.precioVenta ?? "",
  );
  const [medioPagoId, setMedioPagoId] = useState("");
  // ── NUEVO — antes cada venta desde muestrario era siempre 1 unidad.
  const [cantidad, setCantidad] = useState(1);

  const { data: dataClientes } = useQuery(OBTENER_TERCEROS_POR_TIPO, {
    variables: { tipoCodigo: "CLIENTE" },
    fetchPolicy: "network-only",
  });
  const { data: dataMedios } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: "VENT", subcatalogoCodigo: "MPAG" },
    fetchPolicy: "network-only",
  });

  const clientes = dataClientes?.obtenerTercerosPorTipo || [];

  const medios = dataMedios?.gruposPorCodigos || [];

  const [registrar] = useMutation(REGISTRAR_VENTA_MUESTRARIO);

  const handleVenta = async () => {
    if (!clienteId || !precioVenta || !medioPagoId)
      return toast.warning("Complete clienta, precio y medio de pago");
    if (Number(cantidad) > item.cantidadDisponible)
      return toast.warning(`Solo hay ${item.cantidadDisponible} disponible(s)`);
    try {
      const { data } = await registrar({
        variables: {
          input: {
            muestrarioItemId: item.id,
            clienteId: Number(clienteId),
            precioVenta: Number(precioVenta),
            cantidad: Number(cantidad),
            medioPagoId: Number(medioPagoId),
            vendedoraId: muestrario.vendedoraId,
            empresaId: muestrario.empresaId,
          },
        },
      });
      const estado = data?.registrarVentaMuestrario?.estado?.codigo;
      toast[estado === "CONF" ? "success" : "warning"](
        estado === "CONF"
          ? "✅ Venta CONFIRMADA"
          : "⏳ Venta EN PROCESO — pendiente consignación",
      );
      onDone();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="border rounded p-2 bg-white mt-2" style={{ fontSize: 12 }}>
      <div className="fw-bold mb-2">
        Registrar venta — {item.producto?.referencia} {item.producto?.nombre}
      </div>
      <div className="d-flex flex-wrap gap-2 align-items-end">
        <div>
          <label className="form-label mb-0">Clienta</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 180 }}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label mb-0">Cantidad</label>
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 80 }}
            min="1"
            max={item.cantidadDisponible}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label mb-0">Precio venta (unitario)</label>
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 120 }}
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label mb-0">Medio de pago</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 160 }}
            value={medioPagoId}
            onChange={(e) => setMedioPagoId(e.target.value)}
          >
            <option value="">Seleccione...</option>
            {medios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-success btn-sm" onClick={handleVenta}>
          Registrar
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Panel principal del muestrario ───────────────────────────────
function MuestrarioPanel({ muestrario, refetch }) {
  const [vendiendo, setVendiendo] = useState(null); // itemId
  const [liquidando, setLiquidando] = useState(false);
  const [devoluciones, setDevoluciones] = useState({});
  const [motivoFaltante, setMotivoFaltante] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);

  // ── CAMBIO — antes cargaba los primeros 100 productos de una sola vez
  // (si la joyería tiene más de 100 referencias, las de más allá nunca
  // aparecían aquí, y recorrer 100 opciones a mano es incómodo). Ahora
  // busca por referencia/nombre igual que ya hace el resolver para los
  // listados principales (parámetro "busqueda"), con debounce de 400ms
  // para no disparar una consulta por cada tecla.
  const [buscarProducto, setBuscarProducto] = useState("");
  const [buscarProductoDebounced, setBuscarProductoDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscarProductoDebounced(buscarProducto), 400);
    return () => clearTimeout(t);
  }, [buscarProducto]);

  const { data: dataProds } = useQuery(GET_PRODUCTOS_CURSOR, {
    variables: { first: 30, busqueda: buscarProductoDebounced },
    fetchPolicy: "network-only",
    skip: buscarProductoDebounced.trim().length < 1,
  });
  const productos = (dataProds?.productosFiltradosCursor?.edges || []).map(
    (e) => e.node,
  );
  const [agregarItem] = useMutation(AGREGAR_ITEM_MUESTRARIO);
  const [eliminarItem] = useMutation(ELIMINAR_ITEM_MUESTRARIO);
  const [confirmar] = useMutation(CONFIRMAR_VENTA_EFECTIVO);
  const [liquidar] = useMutation(LIQUIDAR_MUESTRARIO);

  const activo = muestrario.estado === "ACTIVO";
  const items = muestrario.items || [];

  // ── NUEVO — visibilidad después de liquidado: a diferencia de
  // "faltantesPorItem" (que se usa mientras se está liquidando y depende
  // de lo que se esté escribiendo en el formulario), esto mira los valores
  // ya guardados en cada item. Así, cualquiera que abra un muestrario ya
  // cerrado ve de una si algo quedó sin cuadrar, sin tener que restar a
  // mano "entregadas - vendidas - devueltas" por producto.
  const faltantesLiquidados = items.map((item) => ({
    item,
    faltante:
      item.cantidadEntregada - item.cantidadVendida - item.cantidadDevuelta,
  }));
  const hayFaltanteLiquidado =
    !activo && faltantesLiquidados.some((f) => f.faltante !== 0);

  const handleAgregarItem = async () => {
    if (!productoId) return toast.warning("Seleccione un producto");
    try {
      await agregarItem({
        variables: {
          input: {
            muestrarioId: muestrario.id,
            productoId: Number(productoId),
            cantidadEntregada: Number(cantidad),
          },
        },
      });
      toast.success("Producto agregado al muestrario");
      setProductoId("");
      setCantidad(1);
      setBuscarProducto("");
      setBuscarProductoDebounced("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleConfirmar = async (ventaId) => {
    try {
      await confirmar({ variables: { ventaId } });
      toast.success("Pago confirmado");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── NUEVO — piezas que quedarían sin contabilizar por item, según lo
  // que ya lleva ingresado en el formulario de devoluciones. El invariante
  // es: cantidadEntregada = cantidadDevuelta + vendidas. Si algo no cuadra,
  // el sistema exige un motivo — no bloquea, pero tampoco lo deja pasar en
  // silencio (mismo principio que "Cerrar orden con entrega parcial").
  const faltantesPorItem = items.map((item) => {
    const devuelveAhora = Number(devoluciones[item.id] ?? 0) || 0;
    const faltante =
      item.cantidadEntregada -
      item.cantidadVendida -
      (item.cantidadDevuelta + devuelveAhora);
    return { item, faltante };
  });
  const hayFaltante = faltantesPorItem.some((f) => f.faltante !== 0);

  const handleLiquidar = async () => {
    if (hayFaltante && !motivoFaltante.trim()) {
      return toast.warning(
        "Hay piezas sin cuadrar (ni vendidas ni devueltas) — indique el motivo para poder liquidar",
      );
    }
    const devs = Object.entries(devoluciones).map(
      ([itemId, cantidadDevuelta]) => ({
        itemId: Number(itemId),
        cantidadDevuelta: Number(cantidadDevuelta) || 0,
      }),
    );
    try {
      await liquidar({
        variables: {
          input: {
            muestrarioId: muestrario.id,
            devoluciones: devs,
            version: muestrario.version,
            motivo: motivoFaltante.trim() || null,
          },
        },
      });
      toast.success("Muestrario liquidado correctamente");
      setLiquidando(false);
      setMotivoFaltante("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      {/* Resumen */}
      <div className="d-flex gap-3 align-items-center mb-3 flex-wrap">
        <strong style={{ fontSize: 13 }}>
          {muestrario.numero} — {muestrario.vendedora?.nombre}
        </strong>
        <span className="badge bg-success">
          {muestrario.totalPiezas} piezas entregadas
        </span>
        <span className="badge bg-primary">
          {muestrario.totalVendidas} vendidas
        </span>
        {Number(muestrario.totalEfectivoPendiente) > 0 && (
          <span className="badge bg-warning text-dark">
            Efectivo/Transf. pendiente: {fmt(muestrario.totalEfectivoPendiente)}
          </span>
        )}
        {/* ── NUEVO — visible para cualquiera que abra el muestrario, sin
            tener que restar cantidades a mano ni abrir "Editar". */}
        {hayFaltanteLiquidado && (
          <span className="badge bg-danger">⚠️ Liquidado con faltante</span>
        )}
      </div>

      {/* ── NUEVO — la nota (incluye el motivo del faltante, si lo hubo)
          ahora se ve directo en el detalle, no solo abriendo "Editar". */}
      {muestrario.nota && (
        <div
          className="alert alert-secondary py-2 px-3 mb-3"
          style={{ fontSize: 12, whiteSpace: "pre-wrap" }}
        >
          <strong>Nota:</strong> {muestrario.nota}
        </div>
      )}

      {/* Tabla de items */}
      {items.map((item) => {
        const disponible = item.cantidadDisponible;
        const itemFaltanteLiquidado =
          faltantesLiquidados.find((f) => f.item.id === item.id)?.faltante ?? 0;
        return (
          <div key={item.id} className="border rounded p-2 bg-white mb-2">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="fw-bold" style={{ fontSize: 13 }}>
                  {item.producto?.foto && (
                    <img
                      src={item.producto.foto}
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: "cover",
                        borderRadius: 4,
                        marginRight: 8,
                      }}
                    />
                  )}
                  {item.producto?.referencia} — {item.producto?.nombre}
                  {!activo && itemFaltanteLiquidado !== 0 && (
                    <span
                      className="badge bg-warning text-dark ms-2"
                      style={{ fontSize: 10 }}
                    >
                      {itemFaltanteLiquidado > 0
                        ? `${itemFaltanteLiquidado} sin contabilizar`
                        : `${-itemFaltanteLiquidado} de más`}
                    </span>
                  )}
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  Entregadas: {item.cantidadEntregada} · Vendidas:{" "}
                  {item.cantidadVendida} · Disponibles:{" "}
                  <strong
                    className={disponible > 0 ? "text-success" : "text-danger"}
                  >
                    {disponible}
                  </strong>
                  {item.cantidadDevuelta > 0 &&
                    ` · Devueltas: ${item.cantidadDevuelta}`}
                  · PVP sugerido: {fmt(item.producto?.precioVenta)}
                </div>
              </div>
              <div className="d-flex gap-1">
                {activo && disponible > 0 && vendiendo !== item.id && (
                  <button
                    className="btn btn-sm btn-success py-0"
                    style={{ fontSize: 11 }}
                    onClick={() => setVendiendo(item.id)}
                  >
                    + Venta
                  </button>
                )}
                {activo && item.cantidadVendida === 0 && (
                  <button
                    className="btn btn-sm btn-outline-danger py-0"
                    style={{ fontSize: 11 }}
                    onClick={async () => {
                      if (window.confirm("¿Quitar producto?")) {
                        await eliminarItem({ variables: { id: item.id } });
                        await refetch();
                      }
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Ventas de este item */}
            {(item.ventas || []).length > 0 && (
              <table
                className="table table-sm mt-2 mb-0"
                style={{ fontSize: 11 }}
              >
                <thead>
                  <tr>
                    <th>Clienta</th>
                    <th>Cant.</th>
                    <th>Precio unit.</th>
                    <th>Pago</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {item.ventas.map((v) => (
                    <tr key={v.id}>
                      <td>{v.cliente?.nombre}</td>
                      <td>{v.cantidad ?? 1}</td>
                      <td>{fmt(v.precioVenta)}</td>
                      <td>{v.medioPago?.nombre}</td>
                      <td>
                        <span
                          className={`badge ${v.estado?.codigo === "CONF" ? "bg-success" : v.estado?.codigo === "ENPR" ? "bg-warning text-dark" : "bg-secondary"}`}
                        >
                          {v.estado?.nombre}
                        </span>
                      </td>
                      <td>
                        {v.estado?.codigo === "ENPR" && activo && (
                          <button
                            className="btn btn-sm btn-outline-success py-0 px-1"
                            style={{ fontSize: 11 }}
                            onClick={() => handleConfirmar(v.id)}
                          >
                            ✓ Confirmar pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {vendiendo === item.id && (
              <VentaRapidaForm
                item={item}
                muestrario={muestrario}
                onDone={async () => {
                  setVendiendo(null);
                  await refetch();
                }}
              />
            )}
          </div>
        );
      })}

      {/* Agregar producto al muestrario */}
      {activo && (
        <div
          className="border rounded p-2 bg-white mb-3"
          style={{ fontSize: 12 }}
        >
          <div className="fw-bold mb-2">+ Agregar producto al muestrario</div>
          <div className="d-flex gap-2 align-items-end flex-wrap">
            <div>
              <label className="form-label mb-0">Buscar producto</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ width: 180 }}
                placeholder="Referencia o nombre..."
                value={buscarProducto}
                onChange={(e) => {
                  setBuscarProducto(e.target.value);
                  setProductoId("");
                }}
              />
            </div>
            <div>
              <label className="form-label mb-0">Producto</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 240 }}
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                disabled={buscarProductoDebounced.trim().length < 1}
              >
                <option value="">
                  {buscarProductoDebounced.trim().length < 1
                    ? "Escriba para buscar..."
                    : "Seleccione..."}
                </option>
                {productos
                  .filter((p) => !items.find((i) => i.productoId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id} disabled={p.enStock <= 0}>
                      {p.referencia} — {p.nombre}{" "}
                      {p.enStock > 0 ? `(stock: ${p.enStock})` : "(sin stock)"}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Cantidad</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 80 }}
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAgregarItem}
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* Liquidar muestrario */}
      {activo && !liquidando && (
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => setLiquidando(true)}
        >
          Cerrar y liquidar muestrario
        </button>
      )}

      {activo && liquidando && (
        <div
          className="border border-danger rounded p-3 bg-white"
          style={{ fontSize: 12 }}
        >
          <div className="fw-bold mb-2 text-danger">
            Liquidar muestrario — registrar devoluciones
          </div>
          <p className="text-muted mb-2" style={{ fontSize: 11 }}>
            Ingrese cuántas piezas devuelve la vendedora por cada producto. Las
            piezas devueltas vuelven al stock. El sistema exige un motivo si
            algo queda sin cuadrar (ni vendido, ni devuelto).
          </p>
          {faltantesPorItem.map(({ item, faltante }) => {
            const maxDev = item.cantidadEntregada - item.cantidadVendida;
            return (
              <div
                key={item.id}
                className="d-flex align-items-center gap-3 mb-2"
              >
                <span style={{ flex: 1 }}>
                  {item.producto?.referencia} — {item.producto?.nombre}
                </span>
                <span className="text-muted">Disponibles: {maxDev}</span>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: 80 }}
                  min="0"
                  max={maxDev}
                  placeholder="0"
                  value={devoluciones[item.id] ?? ""}
                  onChange={(e) =>
                    setDevoluciones((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                />
                <span className="text-muted">devueltas</span>
                {faltante !== 0 && (
                  <span className="badge bg-warning text-dark">
                    {faltante > 0
                      ? `${faltante} sin contabilizar`
                      : `${-faltante} de más`}
                  </span>
                )}
              </div>
            );
          })}
          {hayFaltante && (
            <textarea
              className="form-control form-control-sm mt-2 mb-2"
              placeholder="Motivo del faltante (obligatorio) — ej: pieza perdida, dañada, se queda con la vendedora, etc."
              rows={2}
              value={motivoFaltante}
              onChange={(e) => setMotivoFaltante(e.target.value)}
            />
          )}
          <div className="d-flex gap-2 mt-2">
            <button className="btn btn-danger btn-sm" onClick={handleLiquidar}>
              Confirmar liquidación
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setLiquidando(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Muestrario() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="muestrario"
      campos={camposMuestrario}
      titulo="Muestrarios"
      descripcion="Control de piezas entregadas a vendedoras — ventas en campo y liquidación"
      textoBoton="Muestrario"
      queries={{
        GET: GET_MUESTRARIOS_CURSOR,
        CREAR: CREAR_MUESTRARIO,
        ACTUALIZAR: ACTUALIZAR_MUESTRARIO,
        ELIMINAR: ELIMINAR_MUESTRARIO,
      }}
      fixedValues={{
        empresaId: empresaActual.id,
        fechaSalida: new Date().toISOString().split("T")[0],
      }}
      getDetalle={(muestrario, refetch) => (
        <MuestrarioPanel muestrario={muestrario} refetch={refetch} />
      )}
    />
  );
}

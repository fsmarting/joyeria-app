import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { generarPdfCotizacion } from "../../utils/generarPdfCotizacion.js";
import { camposCotizacion } from "../../data/camposCotizacion.jsx";
import { GET_GRUPOS_POR_CODIGOS } from "../../graphql/grupoQueries.js";
import { GET_PRODUCTOS_CURSOR } from "../../graphql/productoQueries.js";
import {
  GET_COTIZACIONES_CURSOR,
  SIGUIENTE_NUMERO,
  CREAR_COTIZACION,
  ACTUALIZAR_COTIZACION,
  ELIMINAR_COTIZACION,
  AGREGAR_ITEM_COTIZACION,
  ACTUALIZAR_ITEM_COTIZACION,
  ELIMINAR_ITEM_COTIZACION,
  CONVERTIR_EN_VENTA,
} from "../../graphql/cotizacionQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";

// ── Fila de item editable ────────────────────────────────────
function ItemRow({ item, onActualizar, onEliminar }) {
  const [edit, setEdit] = useState(false);
  const [precio, setPrecio] = useState(item.precioUnitario);
  const [cant, setCant] = useState(item.cantidad);
  const [nota, setNota] = useState(item.nota || "");

  return (
    <tr>
      <td>
        {item.producto?.foto && (
          <img
            src={item.producto.foto}
            style={{
              width: 32,
              height: 32,
              objectFit: "cover",
              borderRadius: 4,
              marginRight: 6,
            }}
            onError={(e) => (e.target.style.display = "none")}
          />
        )}
        <strong>{item.producto?.referencia}</strong> — {item.producto?.nombre}
        <div className="text-muted" style={{ fontSize: 11 }}>
          {item.producto?.categoria?.nombre}
        </div>
      </td>
      <td>
        {edit ? (
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 120 }}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        ) : (
          <>
            {fmt(item.precioUnitario)}
            {/* ── NUEVO (ronda 39) — desglose de IVA congelado al crear
                esta línea (informativo — la cotización no es un hecho
                fiscalmente vinculante, pero se congela igual para que la
                impresión no cambie si el % de IVA cambia después). */}
            {item.porcentajeIva != null && (
              <div className="text-muted" style={{ fontSize: 10 }}>
                base {fmt(item.baseGravable)} + IVA {item.porcentajeIva}%{" "}
                {fmt(item.valorIva)}
              </div>
            )}
          </>
        )}
      </td>
      <td>
        {edit ? (
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 70 }}
            value={cant}
            onChange={(e) => setCant(e.target.value)}
            min="1"
          />
        ) : (
          item.cantidad
        )}
      </td>
      <td className="fw-bold text-success">
        {edit ? fmt(Number(precio) * Number(cant)) : fmt(item.subtotal)}
      </td>
      <td>
        {edit ? (
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ width: 150 }}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        ) : (
          <span className="text-muted" style={{ fontSize: 11 }}>
            {item.nota || "—"}
          </span>
        )}
      </td>
      <td>
        {edit ? (
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-success py-0"
              onClick={() =>
                onActualizar({
                  id: item.id,
                  precioUnitario: Number(precio),
                  cantidad: Number(cant),
                  nota: nota || null,
                  version: item.version,
                }).then(() => setEdit(false))
              }
            >
              ✓
            </button>
            <button
              className="btn btn-sm btn-secondary py-0"
              onClick={() => {
                setPrecio(item.precioUnitario);
                setCant(item.cantidad);
                setNota(item.nota || "");
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

// ── Panel de items ───────────────────────────────────────────
function ItemsPanel({ cotizacion, refetch }) {
  const [productoId, setProductoId] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [medioPagoId, setMedioPagoId] = useState("");
  const [convirtiendo, setConvirtiendo] = useState(false);

  const { data: dataProds } = useQuery(GET_PRODUCTOS_CURSOR, {
    variables: { first: 100 },
    fetchPolicy: "network-only",
  });
  const { data: dataMedios } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: "VENT", subcatalogoCodigo: "MPAG" },
    fetchPolicy: "network-only",
  });

  const productos = (dataProds?.productosFiltradosCursor?.edges || []).map(
    (e) => e.node,
  );
  const medios = dataMedios?.gruposPorCodigos || [];
  const items = cotizacion.items || [];
  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const esConvertible =
    cotizacion.estado?.codigo !== "CONV" &&
    cotizacion.estado?.codigo !== "RECHA";

  const [agregarItem] = useMutation(AGREGAR_ITEM_COTIZACION);
  const [actualizarItem] = useMutation(ACTUALIZAR_ITEM_COTIZACION);
  const [eliminarItem] = useMutation(ELIMINAR_ITEM_COTIZACION);
  const [convertir] = useMutation(CONVERTIR_EN_VENTA);

  const handleAgregar = async () => {
    if (!productoId || !precio)
      return toast.warning("Seleccione producto y precio");
    try {
      await agregarItem({
        variables: {
          input: {
            cotizacionId: cotizacion.id,
            productoId: Number(productoId),
            precioUnitario: Number(precio),
            cantidad: Number(cantidad),
            nota: nota || null,
          },
        },
      });
      toast.success("Producto agregado");
      setProductoId("");
      setPrecio("");
      setCantidad(1);
      setNota("");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleActualizar = async (input) => {
    try {
      await actualizarItem({ variables: { input } });
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Quitar este producto?")) return;
    try {
      await eliminarItem({ variables: { id } });
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── CAMBIO — ya no hay restricción de "1 solo producto por cotización".
  // convertirEnVenta crea una Venta por cada línea y devuelve la lista.
  const handleConvertir = async () => {
    if (!medioPagoId) return toast.warning("Seleccione el medio de pago");
    if (!cotizacion.clienteId)
      return toast.error("La cotización necesita una clienta");
    try {
      setConvirtiendo(true);
      const { data } = await convertir({
        variables: {
          input: {
            cotizacionId: cotizacion.id,
            medioPagoId: Number(medioPagoId),
          },
        },
      });
      const n = data?.convertirEnVenta?.length ?? 0;
      toast.success(
        n > 1
          ? `¡Cotización convertida en ${n} ventas!`
          : "¡Cotización convertida en venta!",
      );
      await refetch();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConvirtiendo(false);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <strong style={{ fontSize: 13 }}>
          {cotizacion.numero} — {cotizacion.cliente?.nombre ?? "Sin clienta"}
        </strong>
        <span className="text-muted small">
          Válida {cotizacion.validezDias} días
          {cotizacion.conversacion &&
            ` · Conv: ${cotizacion.conversacion.telefono ?? cotizacion.conversacion.nombreContacto}`}
        </span>
        {/* Botón PDF */}
        <button
          className="btn btn-sm btn-outline-dark ms-auto"
          style={{ fontSize: 11 }}
          onClick={() => generarPdfCotizacion(cotizacion)}
          title="Descargar PDF para enviar por WhatsApp"
        >
          📄 Descargar PDF
        </button>
      </div>

      {items.length > 0 && (
        <table
          className="table table-sm align-middle mb-3"
          style={{ fontSize: 12 }}
        >
          <thead className="table-dark">
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Cant.</th>
              <th>Subtotal</th>
              <th>Nota</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <ItemRow
                key={i.id}
                item={i}
                onActualizar={handleActualizar}
                onEliminar={handleEliminar}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-bold">
              <td colSpan={3} className="text-end">
                TOTAL
              </td>
              <td className="text-success" style={{ fontSize: 14 }}>
                {fmt(total)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      )}

      {esConvertible && (
        <div
          className="border rounded p-2 bg-white mb-3"
          style={{ fontSize: 12 }}
        >
          <div className="fw-bold mb-2">+ Agregar producto a la cotización</div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0">Producto</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 240 }}
                value={productoId}
                onChange={(e) => {
                  setProductoId(e.target.value);
                  const p = productos.find(
                    (x) => String(x.id) === e.target.value,
                  );
                  if (p) setPrecio(String(p.precioVenta));
                }}
              >
                <option value="">Seleccione...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.enStock <= 0}>
                    {p.referencia} — {p.nombre}{" "}
                    {p.enStock <= 0 ? "(sin stock)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Precio</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 130 }}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="form-label mb-0">Cantidad</label>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 70 }}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                min="1"
              />
            </div>
            <div>
              <label className="form-label mb-0">Nota</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ width: 160 }}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            {productoId && precio && (
              <div className="text-muted" style={{ fontSize: 11 }}>
                = {fmt(Number(precio) * Number(cantidad))}
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleAgregar}>
              Agregar
            </button>
          </div>
        </div>
      )}

      {esConvertible && items.length > 0 && (
        <div className="border rounded p-2 bg-white" style={{ fontSize: 12 }}>
          <div className="fw-bold mb-2">
            💰 Convertir en venta
            {items.length > 1 && ` (${items.length} productos)`}
          </div>
          <div className="d-flex gap-2 align-items-end flex-wrap">
            <div>
              <label className="form-label mb-0">Medio de pago</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 180 }}
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
            <button
              className="btn btn-success btn-sm"
              onClick={handleConvertir}
              disabled={convirtiendo}
            >
              {convirtiendo
                ? "⏳ Procesando..."
                : items.length > 1
                  ? `✓ Convertir ${items.length} productos en venta`
                  : "✓ Convertir en venta"}
            </button>
          </div>
        </div>
      )}

      {cotizacion.estado?.codigo === "CONV" && (
        <div className="alert alert-success py-2 mb-0" style={{ fontSize: 12 }}>
          ✅ Esta cotización ya fue convertida en venta.
        </div>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export default function Cotizacion() {
  const empresaActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("empresa") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Leer origen desde conversación (si viene de botón 📋)
  const [origenConv, setOrigenConv] = useState(null);
  useEffect(() => {
    const stored = sessionStorage.getItem("cotizacion_origen");
    if (stored) {
      try {
        setOrigenConv(JSON.parse(stored));
      } catch {
        /* ignorar */
      }
      sessionStorage.removeItem("cotizacion_origen");
    }
  }, []);

  const { data: dataNumero, refetch: refetchNumero } = useQuery(
    SIGUIENTE_NUMERO,
    {
      variables: { empresaId: empresaActual.id },
      fetchPolicy: "network-only",
      skip: !empresaActual.id,
    },
  );
  const siguienteNumero =
    dataNumero?.siguienteNumeroCotizacion ?? "COT-2026-001";

  // fixedValues base
  const fixedValues = useMemo(() => {
    const base = {
      empresaId: empresaActual.id,
      numero: siguienteNumero,
      fecha: new Date().toISOString().split("T")[0],
    };
    // Si viene de conversación, pre-rellenar clienteId y conversacionId
    if (origenConv) {
      if (origenConv.clienteId) base.clienteId = origenConv.clienteId;
      if (origenConv.conversacionId)
        base.conversacionId = origenConv.conversacionId;
    }
    return base;
  }, [empresaActual.id, siguienteNumero, origenConv]);

  return (
    <>
      {/* Banner cuando viene de conversación */}
      {origenConv && (
        <div
          className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center gap-2"
          style={{ fontSize: 13 }}
        >
          💬 Cotización iniciada desde conversación
          {origenConv.nombre && <strong>{origenConv.nombre}</strong>}
          {origenConv.telefono && (
            <span className="text-muted">· {origenConv.telefono}</span>
          )}
          {origenConv.piezasIds?.length > 0 && (
            <span className="text-muted">
              · {origenConv.piezasIds.length} pieza(s) de interés — agréguela(s)
              al abrir la cotización ▸
            </span>
          )}
          <button
            className="btn-close ms-auto"
            style={{ fontSize: 11 }}
            onClick={() => setOrigenConv(null)}
          />
        </div>
      )}

      <EntidadGenerica
        tipoEntidad="cotizacion"
        campos={camposCotizacion}
        titulo="Cotizaciones"
        descripcion="Expanda ▸ para agregar productos, editar precios y convertir en venta"
        textoBoton="Cotización"
        queries={{
          GET: GET_COTIZACIONES_CURSOR,
          CREAR: CREAR_COTIZACION,
          ACTUALIZAR: ACTUALIZAR_COTIZACION,
          ELIMINAR: ELIMINAR_COTIZACION,
        }}
        fixedValues={fixedValues}
        getDetalle={(cotizacion, refetch) => (
          <ItemsPanel cotizacion={cotizacion} refetch={refetch} />
        )}
      />
    </>
  );
}

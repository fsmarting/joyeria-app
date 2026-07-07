import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposProducto } from "../../data/camposProducto.jsx";
import { GET_PIEDRAS_CURSOR } from "../../graphql/piedraQueries.js";
import {
  GET_PRODUCTOS_CURSOR,
  CREAR_PRODUCTO,
  ACTUALIZAR_PRODUCTO,
  ELIMINAR_PRODUCTO,
  AGREGAR_INSUMO_PRODUCTO,
  ACTUALIZAR_INSUMO_PRODUCTO,
  ELIMINAR_INSUMO_PRODUCTO,
} from "../../graphql/productoQueries.js";

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}`
    : "-";
const fmtQ = (n, u = "") =>
  n != null
    ? `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${u}`.trim()
    : "-";

// ── Panel BOM del producto ────────────────────────────────────────
function BomPanel({ producto, refetch }) {
  const [piedraId, setPiedraId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [desp, setDesp] = useState("0");
  const [editando, setEditando] = useState(null);

  const { data: dataPiedras } = useQuery(GET_PIEDRAS_CURSOR, {
    variables: { first: 100 },
    fetchPolicy: "network-only",
  });
  const piedras = (dataPiedras?.piedrasFiltradosCursor?.edges || []).map(
    (e) => e.node,
  );

  const [agregar] = useMutation(AGREGAR_INSUMO_PRODUCTO);
  const [actualizar] = useMutation(ACTUALIZAR_INSUMO_PRODUCTO);
  const [eliminar] = useMutation(ELIMINAR_INSUMO_PRODUCTO);

  const handleAgregar = async () => {
    if (!piedraId || !cantidad || !costo)
      return toast.warning("Complete insumo, cantidad y costo");
    try {
      await agregar({
        variables: {
          input: {
            productoId: producto.id,
            piedraId: Number(piedraId),
            cantidad: Number(cantidad),
            costoEstandardUnitario: Number(costo),
            desperdicio: Number(desp),
          },
        },
      });
      toast.success("Insumo agregado al BOM");
      setPiedraId("");
      setCantidad("");
      setCosto("");
      setDesp("0");
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
            costoEstandardUnitario: Number(item.costo),
            desperdicio: Number(item.desp),
            version: item.version,
          },
        },
      });
      toast.success("BOM actualizado");
      setEditando(null);
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Quitar este insumo del BOM?")) return;
    try {
      await eliminar({ variables: { id } });
      toast.success("Insumo removido del BOM");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const bomItems = producto.piedras || [];
  const costoInsumos = bomItems.reduce(
    (s, b) => s + Number(b.costoEstandardTotal),
    0,
  );
  const costoTotal =
    costoInsumos + Number(producto.costoManoObra) + Number(producto.costoOtros);

  return (
    <div className="p-3 bg-light border-top">
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <strong style={{ fontSize: 13 }}>
          🧱 BOM — {producto.referencia} {producto.nombre}
        </strong>
        <span className="text-muted small">
          Oro: {fmtQ(producto.gramosOro, "g")} ×{" "}
          {fmt(producto.costoGramoOroUsado)}/g ={" "}
          {fmt(
            Number(producto.gramosOro) * Number(producto.costoGramoOroUsado),
          )}
          &nbsp;·&nbsp; Insumos: {fmt(costoInsumos)}
          &nbsp;·&nbsp; MO: {fmt(producto.costoManoObra)}
          &nbsp;·&nbsp; <strong>Total: {fmt(costoTotal)}</strong>
          &nbsp;·&nbsp; PVP: {fmt(producto.precioVenta)}
          &nbsp;·&nbsp; Margen:{" "}
          <span
            className={`badge ${Number(producto.margen) >= 50 ? "bg-success" : Number(producto.margen) >= 30 ? "bg-warning text-dark" : "bg-danger"}`}
          >
            {Number(producto.margen).toFixed(1)}%
          </span>
        </span>
      </div>

      {/* ── Tabla BOM actual ── */}
      {bomItems.length === 0 && (
        <p className="text-muted small mb-3">
          Sin insumos en el BOM — agregue piedras o materiales abajo.
        </p>
      )}
      {bomItems.length > 0 && (
        <table
          className="table table-sm table-striped align-middle mb-3"
          style={{ fontSize: 12 }}
        >
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Unidad</th>
              <th>Cantidad/pieza</th>
              <th>$ Estándar/unidad</th>
              <th>$ Total std</th>
              <th>Desperdicio %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bomItems.map((b) =>
              editando?.id === b.id ? (
                <tr key={b.id}>
                  <td colSpan={2}>
                    <strong>
                      {b.piedra?.codigo} — {b.piedra?.nombre}
                    </strong>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: 80 }}
                      value={editando.cantidad}
                      onChange={(e) =>
                        setEditando({ ...editando, cantidad: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: 100 }}
                      value={editando.costo}
                      onChange={(e) =>
                        setEditando({ ...editando, costo: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    {fmt(Number(editando.cantidad) * Number(editando.costo))}
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: 70 }}
                      value={editando.desp}
                      onChange={(e) =>
                        setEditando({ ...editando, desp: e.target.value })
                      }
                    />
                  </td>
                  <td className="d-flex gap-1">
                    <button
                      className="btn btn-sm btn-success py-0"
                      onClick={() => handleActualizar(editando)}
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn-sm btn-secondary py-0"
                      onClick={() => setEditando(null)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={b.id}>
                  <td>
                    <strong>{b.piedra?.codigo}</strong> {b.piedra?.nombre}
                  </td>
                  <td>{b.piedra?.unidad?.nombre}</td>
                  <td>{fmtQ(b.cantidad)}</td>
                  <td>{fmt(b.costoEstandardUnitario)}</td>
                  <td>{fmt(b.costoEstandardTotal)}</td>
                  <td>{Number(b.desperdicio).toFixed(1)}%</td>
                  <td className="d-flex gap-1">
                    <button
                      className="btn btn-sm btn-outline-primary py-0 px-1"
                      style={{ fontSize: 11 }}
                      onClick={() =>
                        setEditando({
                          id: b.id,
                          version: b.version,
                          cantidad: b.cantidad,
                          costo: b.costoEstandardUnitario,
                          desp: b.desperdicio,
                        })
                      }
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger py-0 px-1"
                      style={{ fontSize: 11 }}
                      onClick={() => handleEliminar(b.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {/* ── Formulario agregar insumo al BOM ── */}
      <div className="border rounded p-2 bg-white" style={{ fontSize: 12 }}>
        <div className="fw-bold mb-2" style={{ fontSize: 13 }}>
          + Agregar insumo al BOM
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label mb-0">Insumo</label>
            <select
              className="form-select form-select-sm"
              style={{ width: 200 }}
              value={piedraId}
              onChange={(e) => {
                setPiedraId(e.target.value);
                const p = piedras.find((x) => String(x.id) === e.target.value);
                if (p) setCosto(p.costoEstandardPorUnidad);
              }}
            >
              <option value="">Seleccione...</option>
              {piedras
                .filter((p) => !bomItems.find((b) => b.piedraId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nombre} ({p.unidad?.nombre})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="form-label mb-0">Cantidad/pieza</label>
            <input
              type="number"
              className="form-control form-control-sm"
              style={{ width: 100 }}
              placeholder="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label mb-0">$ Costo estándar/unidad</label>
            <input
              type="number"
              className="form-control form-control-sm"
              style={{ width: 130 }}
              placeholder="0"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label mb-0">Desperdicio %</label>
            <input
              type="number"
              className="form-control form-control-sm"
              style={{ width: 80 }}
              value={desp}
              onChange={(e) => setDesp(e.target.value)}
            />
          </div>
          {cantidad && costo && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              Total std: {fmt(Number(cantidad) * Number(costo))}
            </div>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleAgregar}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────
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
      descripcion="Catálogo de piezas — expanda una fila para gestionar el BOM (materiales estándar)"
      textoBoton="Producto"
      queries={{
        GET: GET_PRODUCTOS_CURSOR,
        CREAR: CREAR_PRODUCTO,
        ACTUALIZAR: ACTUALIZAR_PRODUCTO,
        ELIMINAR: ELIMINAR_PRODUCTO,
      }}
      fixedValues={{
        empresaId: empresaActual.id,
        empresa: {
          id: empresaActual.id,
          codigo: empresaActual.codigo,
          nombre: empresaActual.nombre,
        },
      }}
      getDetalle={(producto, refetch) => (
        <BomPanel producto={producto} refetch={refetch} />
      )}
    />
  );
}

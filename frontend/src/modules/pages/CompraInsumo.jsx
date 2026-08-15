import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposCompra } from "../../data/camposCompra.jsx";
import { GET_PIEDRAS_CURSOR } from "../../graphql/piedraQueries.js";
import {
  GET_COMPRAS_CURSOR,
  CREAR_COMPRA,
  ACTUALIZAR_COMPRA,
  ELIMINAR_COMPRA,
  AGREGAR_ITEM_COMPRA,
  ACTUALIZAR_ITEM_COMPRA,
  ELIMINAR_ITEM_COMPRA,
} from "../../graphql/compraInsumoQueries.js";

const fmt = (n) =>
  n != null ? `$${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 0 })}` : "-";
const fmtQ = (n, u = "") =>
  n != null ? `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${u}`.trim() : "-";

function badgeDisponible(disp, tot) {
  const d = Number(disp), t = Number(tot);
  const pct = t > 0 ? (d / t) * 100 : 0;
  return pct > 50 ? "success" : pct > 20 ? "warning" : "danger";
}

// ── Fila de un insumo ya agregado a la compra ─────────────────────
function ItemRow({ item, onActualizar, onEliminar }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    cantidad: item.cantidad,
    costoUnitario: item.costoUnitario,
  });
  const total = Number(form.cantidad) * Number(form.costoUnitario);
  const unidad = item.piedra?.unidad?.nombre ?? "";

  return (
    <tr>
      <td>
        <strong>{item.piedra?.codigo}</strong> {item.piedra?.nombre}
      </td>
      <td>
        {edit ? (
          <input type="number" className="form-control form-control-sm" style={{ width: 90 }}
            value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
        ) : fmtQ(item.cantidad, unidad)}
      </td>
      <td>
        {edit ? (
          <input type="number" className="form-control form-control-sm" style={{ width: 110 }}
            value={form.costoUnitario} onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })} />
        ) : fmt(item.costoUnitario)}
      </td>
      <td className="fw-bold">{edit ? fmt(total) : fmt(item.costoTotal)}</td>
      <td>
        <span className={`badge bg-${badgeDisponible(item.cantidadDisponible, item.cantidad)}`}>
          {fmtQ(item.cantidadDisponible, unidad)}
        </span>
      </td>
      <td>
        {edit ? (
          <div className="d-flex gap-1">
            <button className="btn btn-sm btn-success py-0"
              onClick={() => onActualizar({ id: item.id, ...form, version: item.version }).then(() => setEdit(false))}>✓</button>
            <button className="btn btn-sm btn-secondary py-0"
              onClick={() => { setForm({ cantidad: item.cantidad, costoUnitario: item.costoUnitario }); setEdit(false); }}>✕</button>
          </div>
        ) : (
          <div className="d-flex gap-1">
            <button className="btn btn-sm btn-outline-primary py-0 px-1" style={{ fontSize: 11 }} onClick={() => setEdit(true)}>✏️</button>
            <button className="btn btn-sm btn-outline-danger py-0 px-1" style={{ fontSize: 11 }} onClick={() => onEliminar(item.id)}>✕</button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Panel de detalle — insumos de esta compra ──────────────────────
function CompraPanel({ compra, refetch }) {
  const [selectedPiedraId, setSelectedPiedraId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnit, setCostoUnit] = useState("");

  const { data: dataPiedras } = useQuery(GET_PIEDRAS_CURSOR, {
    variables: { first: 100 }, fetchPolicy: "network-only",
  });
  const piedras = (dataPiedras?.piedrasFiltradosCursor?.edges || []).map((e) => e.node);
  const unidadSeleccionada = piedras.find((p) => String(p.id) === selectedPiedraId)?.unidad?.nombre;

  const [agregar] = useMutation(AGREGAR_ITEM_COMPRA);
  const [actualizar] = useMutation(ACTUALIZAR_ITEM_COMPRA);
  const [eliminar] = useMutation(ELIMINAR_ITEM_COMPRA);

  const items = compra.items || [];

  const handleAgregar = async () => {
    if (!selectedPiedraId || !cantidad || !costoUnit)
      return toast.warning("Complete insumo, cantidad y $/unidad");
    try {
      await agregar({ variables: { input: {
        compraId: compra.id,
        piedraId: Number(selectedPiedraId),
        cantidad: Number(cantidad),
        costoUnitario: Number(costoUnit),
      } } });
      toast.success("Insumo agregado a la compra");
      setSelectedPiedraId(""); setCantidad(""); setCostoUnit("");
      await refetch();
    } catch (e) { toast.error(e.message); }
  };

  const handleActualizar = async (item) => {
    try {
      await actualizar({ variables: { input: {
        id: item.id, cantidad: Number(item.cantidad), costoUnitario: Number(item.costoUnitario), version: item.version,
      } } });
      toast.success("Actualizado");
      await refetch();
    } catch (e) { toast.error(e.message); }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Quitar este insumo de la compra?")) return;
    try { await eliminar({ variables: { id } }); toast.success("Removido"); await refetch(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="fw-bold mb-3" style={{ fontSize: 13 }}>
        🧾 Insumos de la compra {compra.numero}
      </div>

      {items.length > 0 && (
        <table className="table table-sm align-middle mb-3" style={{ fontSize: 12 }}>
          <thead>
            <tr className="table-dark">
              <th>Insumo</th><th>Cantidad</th><th>$/Unidad</th><th>Total</th><th>Disponible</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <ItemRow key={it.id} item={it} onActualizar={handleActualizar} onEliminar={handleEliminar} />
            ))}
          </tbody>
        </table>
      )}
      {items.length === 0 && (
        <div className="text-muted mb-3">Esta compra todavía no tiene insumos agregados.</div>
      )}

      <div className="border rounded p-2 bg-white" style={{ fontSize: 12 }}>
        <div className="fw-bold mb-2">+ Agregar insumo a esta compra</div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label mb-0">Insumo</label>
            <select className="form-select form-select-sm" style={{ width: 220 }}
              value={selectedPiedraId} onChange={(e) => {
                setSelectedPiedraId(e.target.value);
                const p = piedras.find((x) => String(x.id) === e.target.value);
                if (p) setCostoUnit(String(p.costoEstandardPorUnidad));
              }}>
              <option value="">Seleccione...</option>
              {piedras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tipo?.codigo === "ORO" ? "🥇 " : ""}{p.codigo} — {p.nombre} ({p.unidad?.nombre})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label mb-0">
              Cantidad{unidadSeleccionada ? ` (${unidadSeleccionada})` : ""}
            </label>
            <input type="number" className="form-control form-control-sm" style={{ width: 100 }}
              placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div>
            <label className="form-label mb-0">$ / Unidad</label>
            <input type="number" className="form-control form-control-sm" style={{ width: 120 }}
              placeholder="0" value={costoUnit} onChange={(e) => setCostoUnit(e.target.value)} />
          </div>
          {cantidad && costoUnit && (
            <div className="text-muted" style={{ fontSize: 11 }}>= {fmt(Number(cantidad) * Number(costoUnit))}</div>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleAgregar}>Agregar</button>
        </div>
      </div>
    </div>
  );
}

export default function CompraInsumo() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("empresa") || "{}"); }
    catch { return {}; }
  }, []);

  const valoresFijos = useMemo(() => ({
    empresaId: empresaActual.id,
    fecha: new Date().toISOString().split("T")[0],
  }), [empresaActual]);

  return (
    <EntidadGenerica
      tipoEntidad="compra"
      campos={camposCompra}
      titulo="Compras de Insumos"
      descripcion="Registro de cada compra a proveedor — oro, piedras y otros materiales. Expanda ▸ para agregar los insumos de esa compra."
      textoBoton="Compra"
      queries={{
        GET: GET_COMPRAS_CURSOR,
        CREAR: CREAR_COMPRA,
        ACTUALIZAR: ACTUALIZAR_COMPRA,
        ELIMINAR: ELIMINAR_COMPRA,
      }}
      fixedValues={valoresFijos}
      getDetalle={(compra, refetch) => <CompraPanel compra={compra} refetch={refetch} />}
    />
  );
}

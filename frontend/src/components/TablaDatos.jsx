import { useState, useMemo } from "react";
import PropTypes from "prop-types";

const getValue = (obj, path) =>
  path?.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

export default function TablaDatos({
  registros = [], campos = [], onOrdenar, ordenCampo = [], ordenDireccion = [],
  onEditar, onEliminar, estaCargando = false, terminoBusqueda = "",
  getDetalle = null, permisos = {}, accionesExtra = null, errorCarga = null,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const hayDetalle = typeof getDetalle === "function";

  const toggleRow = (rowKey) => {
    setExpanded((prev) => { const next = new Set(prev); next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey); return next; });
  };

  const columnas = useMemo(() =>
    campos.filter((c) => !c.soloFormulario && c.ocultarEnListado !== true)
          .sort((a, b) => (a.ordenListado ?? 9999) - (b.ordenListado ?? 9999)),
    [campos]
  );

  const tieneColumnaAccionesCustom = useMemo(() => columnas.some((c) => c.nombre === "acciones"), [columnas]);
  const mostrarAcciones = (onEditar || onEliminar || accionesExtra) && !tieneColumnaAccionesCustom;

  const renderOrdenIcon = (nombreCol) => {
    const index = Array.isArray(ordenCampo) ? ordenCampo.indexOf(nombreCol) : -1;
    if (index === -1) return "↕";
    const dir = ordenDireccion[index] || "asc";
    const n = ordenCampo.length > 1 ? ` ${index + 1}` : "";
    return dir === "asc" ? `▲${n}` : `▼${n}`;
  };

  const colSpan = columnas.length + (mostrarAcciones ? 1 : 0) + (hayDetalle ? 1 : 0);

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle">
        <thead>
          <tr>
            {hayDetalle && <th style={{ width: 32 }} />}
            {columnas.map((col) => (
              <th key={col.nombre} style={col.ancho ? { width: col.ancho } : undefined}
                className={onOrdenar && col.ordenable !== false ? "cursor-pointer user-select-none" : ""}
                onClick={(e) => onOrdenar && col.ordenable !== false && onOrdenar(col.nombre, e)}>
                <div className="d-flex align-items-center gap-2">
                  <span>{col.etiqueta || col.nombre}</span>
                  {onOrdenar && col.ordenable !== false && <span style={{ fontSize: 10 }}>{renderOrdenIcon(col.nombre)}</span>}
                </div>
              </th>
            ))}
            {mostrarAcciones && <th style={{ width: 130 }}>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {estaCargando && <tr><td colSpan={colSpan}><div className="py-3 text-center">Cargando datos…</div></td></tr>}
          {!estaCargando && errorCarga && (
            <tr><td colSpan={colSpan}><div className="py-5 text-center">
              {errorCarga.message === "Failed to fetch"
                ? <><div style={{ fontSize: "2.5rem" }}>📡</div><h5 className="text-secondary">Sin conexión</h5></>
                : <><div style={{ fontSize: "2.5rem" }}>⚠️</div><h5 className="text-danger">Error del sistema</h5></>}
            </div></td></tr>
          )}
          {!estaCargando && !errorCarga && registros.length === 0 && (
            <tr><td colSpan={colSpan}><div className="py-3 text-center text-muted">
              {terminoBusqueda ? <>No hay resultados para "<b>{terminoBusqueda}</b>".</> : "No hay registros."}
            </div></td></tr>
          )}
          {!estaCargando && registros.map((row) => {
            const rowKey = row.id ?? JSON.stringify(row);
            const abierto = expanded.has(rowKey);
            return (
              <>
                <tr key={rowKey}>
                  {hayDetalle && (
                    <td className="text-center"><button type="button" className="btn btn-sm btn-outline-secondary"
                      onClick={() => toggleRow(rowKey)} style={{ lineHeight: 1, padding: "2px 6px" }}>
                      {abierto ? "▾" : "▸"}</button></td>
                  )}
                  {columnas.map((col) => {
                    if (typeof col.render === "function") {
                      return <td key={col.nombre} className={col.className}>{col.render(row)}</td>;
                    }
                    let val = getValue(row, col.nombre);
                    if (val == null) val = "";
                    if (typeof val === "object") { try { val = JSON.stringify(val); } catch { val = String(val); } }
                    return <td key={col.nombre} className={col.className}>{String(val)}</td>;
                  })}
                  {mostrarAcciones && (
                    <td><div className="d-flex gap-1">
                      {accionesExtra && accionesExtra(row)}
                      {permisos.editar && onEditar && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEditar(row)}>Editar</button>}
                      {permisos.eliminar && onEliminar && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onEliminar(row.id)}>Eliminar</button>}
                    </div></td>
                  )}
                </tr>
                {hayDetalle && abierto && <tr key={`${rowKey}-det`}><td colSpan={colSpan}>{getDetalle(row)}</td></tr>}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

TablaDatos.propTypes = {
  registros: PropTypes.array.isRequired, campos: PropTypes.array.isRequired,
  onOrdenar: PropTypes.func, ordenCampo: PropTypes.array, ordenDireccion: PropTypes.array,
  onEditar: PropTypes.func, onEliminar: PropTypes.func, estaCargando: PropTypes.bool,
  terminoBusqueda: PropTypes.string, getDetalle: PropTypes.func, accionesExtra: PropTypes.func,
};

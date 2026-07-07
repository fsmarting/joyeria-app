import { useState, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";

import ModalGenericoAvanzado from "./ModalGenericoAvanzado.jsx";
import TablaDatos from "./TablaDatos.jsx";
import { buildInput } from "../modules/utils/buildInput.js";

export default function EntidadGenerica({
  titulo = "Gestión",
  descripcion = "",
  textoBoton = "Nuevo",
  tipoEntidad,
  campos = [],
  cols = 2,
  queries = {},
  extraVariables = {},
  fixedValues = {},
  getDetalle,
  accionesExtraAbajo,
  accionesExtraFila,
  readOnly = false,
}) {
  const [show, setShow] = useState(false);
  const [registroEditar, setRegistroEditar] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [cursorStack, setCursorStack] = useState([]);
  const [limit] = useState(10);
  const [ordenCampos, setOrdenCampos] = useState([]);
  const [ordenDirecciones, setOrdenDirecciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  const memoFixedValues = useMemo(
    () => ({ ...fixedValues }),
    [JSON.stringify(fixedValues)],
  );

  const permisos = useMemo(() => {
    if (readOnly)
      return {
        ver: true,
        crear: false,
        editar: false,
        eliminar: false,
        esGerencia: false,
        codigo: "READONLY",
      };
    try {
      const stored = localStorage.getItem("rol");
      if (!stored)
        return {
          ver: true,
          crear: false,
          editar: false,
          eliminar: false,
          codigo: "INV",
        };
      const rolObj = JSON.parse(stored);
      const rol = (rolObj?.codigo || "").trim();
      return {
        ver: true,
        crear: rol === "ADM" || rol === "ACT",
        editar: rol === "ADM" || rol === "ACT" || rol === "DEL",
        eliminar: rol === "ADM" || rol === "DEL",
        esGerencia: rol === "ADM" || rol === "GER",
        codigo: rol,
      };
    } catch {
      return {
        ver: true,
        crear: false,
        editar: false,
        eliminar: false,
        esGerencia: false,
      };
    }
  }, [readOnly]);

  const camposVisibles = useMemo(
    () => campos.filter((c) => !(c.soloAdmin && !permisos.esGerencia)),
    [campos, permisos.esGerencia],
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
      setCursor(null);
      setCursorStack([]);
    }, 500);
    return () => clearTimeout(handler);
  }, [busqueda]);

  const { data, loading, error, refetch } = useQuery(queries.GET, {
    variables: {
      first: limit,
      after: cursor,
      orden: Array.isArray(ordenCampos) ? ordenCampos : [],
      direccion:
        Array.isArray(ordenDirecciones) &&
        ordenDirecciones.length === ordenCampos.length
          ? ordenDirecciones
          : [],
      busqueda: busquedaDebounced,
      ...extraVariables,
    },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const connectionData = useMemo(() => {
    if (!data)
      return { edges: [], pageInfo: { endCursor: null, hasNextPage: false } };
    const mainKey = Object.keys(data)[0];
    return data[mainKey] ?? { edges: [], pageInfo: {} };
  }, [data]);

  const registros = useMemo(() => {
    if (Array.isArray(connectionData)) return connectionData;
    if (Array.isArray(connectionData.edges))
      return connectionData.edges.map((e) => e.node);
    return [];
  }, [connectionData]);

  const pageInfo = connectionData.pageInfo || {};

  const queryEliminarSegura = queries.ELIMINAR || queries.CREAR;
  const [crear] = useMutation(queries.CREAR);
  const [actualizar] = useMutation(queries.ACTUALIZAR);
  const [eliminar] = useMutation(queryEliminarSegura);

  const abrirCrear = () => {
    if (!permisos.crear) return toast.error("No tienes permiso para crear");
    setRegistroEditar(null);
    setShow(true);
  };
  const abrirEditar = (row) => {
    if (!permisos.editar) return toast.error("No tienes permiso para editar");
    setRegistroEditar(row);
    setShow(true);
  };
  const cerrarModal = () => {
    setShow(false);
    setRegistroEditar(null);
  };

  const onOrdenar = (columna, esShift) => {
    setCursor(null);
    setCursorStack([]);
    if (!esShift) {
      if (ordenCampos[0] === columna) {
        setOrdenDirecciones([ordenDirecciones[0] === "asc" ? "desc" : "asc"]);
      } else {
        setOrdenCampos([columna]);
        setOrdenDirecciones(["asc"]);
      }
    } else {
      const index = ordenCampos.indexOf(columna);
      if (index === -1) {
        setOrdenCampos([...ordenCampos, columna]);
        setOrdenDirecciones([...ordenDirecciones, "asc"]);
      } else {
        const n = [...ordenDirecciones];
        n[index] = n[index] === "asc" ? "desc" : "asc";
        setOrdenDirecciones(n);
      }
    }
  };

  const irSiguiente = () => {
    if (pageInfo.hasNextPage) {
      setCursorStack([...cursorStack, cursor]);
      setCursor(pageInfo.endCursor);
    }
  };
  const irAnterior = () => {
    if (cursorStack.length > 0) {
      const s = [...cursorStack];
      const prev = s.pop();
      setCursorStack(s);
      setCursor(prev);
    }
  };

  const guardar = async (form) => {
    try {
      const merged = { ...form, ...fixedValues };
      const isUpdate = Boolean(registroEditar?.id);
      if (isUpdate && !permisos.editar)
        return toast.error("Sin permiso para editar");
      if (!isUpdate && !permisos.crear)
        return toast.error("Sin permiso para crear");
      const payload = buildInput({
        form: merged,
        entity: tipoEntidad,
        isUpdate,
      });
      if (isUpdate) await actualizar({ variables: { input: payload } });
      else await crear({ variables: { input: payload } });
      toast.success("✔ Guardado");
      if (!isUpdate) {
        setCursor(null);
        setCursorStack([]);
      }
      await refetch();
      cerrarModal();
    } catch (e) {
      toast.error("❌ Error al guardar: " + e.message);
    }
  };

  const eliminarRegistro = async (id) => {
    if (!queries.ELIMINAR) return;
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;
    await toast.promise(
      (async () => {
        if (!permisos.eliminar) throw new Error("Sin permiso");
        await eliminar({ variables: { id } });
        await refetch();
      })(),
      {
        pending: "Eliminando...",
        success: "🗑️ Eliminado",
        error: {
          render({ data }) {
            return `❌ ${data.message}`;
          },
        },
      },
    );
  };

  const mostrarBotonEliminar = permisos.eliminar && queries.ELIMINAR;
  const getDetalleConRefetch = getDetalle
    ? (row) => getDetalle(row, refetch)
    : undefined;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1 text-primary fw-bold">{titulo}</h3>
          {descripcion && <small className="text-muted">{descripcion}</small>}
        </div>
        <div className="d-flex gap-2 align-items-center">
          <input
            className="form-control"
            style={{ width: 240 }}
            placeholder="🔍 Buscar..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setCursor(null);
              setCursorStack([]);
            }}
          />
          <button
            className="btn btn-outline-secondary"
            title="Limpiar"
            onClick={() => {
              setOrdenCampos([]);
              setOrdenDirecciones([]);
              setCursor(null);
              setCursorStack([]);
              setBusqueda("");
            }}
          >
            ↺
          </button>
          {permisos.crear && (
            <button className="btn btn-primary" onClick={abrirCrear}>
              + {textoBoton}
            </button>
          )}
        </div>
      </div>

      <TablaDatos
        registros={registros}
        campos={camposVisibles}
        onOrdenar={(c, e) => onOrdenar(c, e.shiftKey)}
        ordenCampo={ordenCampos}
        ordenDireccion={ordenDirecciones}
        onEditar={permisos.editar ? abrirEditar : null}
        onEliminar={mostrarBotonEliminar ? eliminarRegistro : null}
        estaCargando={loading}
        errorCarga={error}
        terminoBusqueda={busqueda}
        getDetalle={getDetalleConRefetch}
        permisos={permisos}
        accionesExtra={accionesExtraFila}
        permisos={permisos}
        accionesExtra={accionesExtraFila}
      />

      <div className="d-flex justify-content-between mt-3 align-items-center">
        <div>{accionesExtraAbajo}</div>
        <div className="btn-group">
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={cursorStack.length === 0 || loading}
            onClick={irAnterior}
          >
            ← Anterior
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={!pageInfo.hasNextPage || loading}
            onClick={irSiguiente}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {show && (
        <ModalGenericoAvanzado
          show={show}
          onClose={cerrarModal}
          onSubmit={guardar}
          campos={camposVisibles}
          tipoEntidad={tipoEntidad}
          cols={cols}
          registroParaEditar={registroEditar}
          fixedValues={memoFixedValues}
          titulo={textoBoton}
        />
      )}
    </>
  );
}

EntidadGenerica.propTypes = {
  titulo: PropTypes.string,
  descripcion: PropTypes.string,
  textoBoton: PropTypes.string,
  tipoEntidad: PropTypes.string.isRequired,
  campos: PropTypes.array.isRequired,
  cols: PropTypes.number,
  queries: PropTypes.object.isRequired,
  extraVariables: PropTypes.object,
  fixedValues: PropTypes.object,
  getDetalle: PropTypes.func,
  accionesExtraAbajo: PropTypes.node,
  accionesExtraFila: PropTypes.func,
  readOnly: PropTypes.bool,
};

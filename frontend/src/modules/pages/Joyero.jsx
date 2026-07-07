import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import EntidadGenerica from "../../components/EntidadGenerica.jsx";
import { camposJoyero } from "../../data/camposJoyero.jsx";
import {
  GET_JOYEROS_CURSOR,
  CREAR_JOYERO,
  ACTUALIZAR_JOYERO,
  ELIMINAR_JOYERO,
  AGREGAR_ESPECIALIDAD,
  REMOVER_ESPECIALIDAD,
  ACTUALIZAR_NIVEL,
} from "../../graphql/joyeroQueries.js";
import { GET_GRUPOS_POR_CODIGOS } from "../../graphql/grupoQueries.js";

const NIVELES = ["Experto", "Intermedio", "Básico"];

// ── Panel de especialidades (se muestra al expandir una fila) ──────
function EspecialidadesPanel({ joyero, refetch }) {
  const [nuevaEspId, setNuevaEspId] = useState("");
  const [nuevoNivel, setNuevoNivel] = useState("Experto");
  const [esPrincipal, setEsPrincipal] = useState(false);

  const { data: dataGrupos } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: "PRODU", subcatalogoCodigo: "ESPE" },
    fetchPolicy: "network-only",
  });

  const [agregar] = useMutation(AGREGAR_ESPECIALIDAD);
  const [remover] = useMutation(REMOVER_ESPECIALIDAD);
  const [actualizar] = useMutation(ACTUALIZAR_NIVEL);

  const grupos = dataGrupos?.gruposPorCodigos || [];
  const idsActuales = (joyero.especialidades || []).map(
    (e) => e.especialidadId,
  );
  const disponibles = grupos.filter((g) => !idsActuales.includes(g.id));

  const handleAgregar = async () => {
    if (!nuevaEspId) return toast.warning("Seleccione una especialidad");
    try {
      await agregar({
        variables: {
          input: {
            joyeroId: joyero.id,
            especialidadId: Number(nuevaEspId),
            nivel: nuevoNivel || null,
            esPrincipal,
          },
        },
      });
      toast.success("Especialidad agregada");
      setNuevaEspId("");
      setNuevoNivel("Experto");
      setEsPrincipal(false);
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRemover = async (especialidadId) => {
    if (!window.confirm("¿Quitar esta especialidad?")) return;
    try {
      await remover({ variables: { joyeroId: joyero.id, especialidadId } });
      toast.success("Especialidad removida");
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleNivel = async (especialidadId, nivel, esPpal) => {
    try {
      await actualizar({
        variables: {
          joyeroId: joyero.id,
          especialidadId,
          nivel,
          esPrincipal: esPpal,
        },
      });
      await refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="d-flex align-items-center gap-2 mb-3">
        <strong style={{ fontSize: 13 }}>
          Especialidades de {joyero.nombre}
        </strong>
      </div>

      {/* Lista de especialidades actuales */}
      {(joyero.especialidades || []).length === 0 && (
        <p className="text-muted small mb-3">Sin especialidades registradas.</p>
      )}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {(joyero.especialidades || []).map((e) => (
          <div
            key={e.id}
            className="d-flex align-items-center gap-1 border rounded px-2 py-1"
            style={{ fontSize: 12 }}
          >
            {/* Principal toggle */}
            <span
              title={
                e.esPrincipal
                  ? "Principal — clic para quitar"
                  : "Clic para marcar como principal"
              }
              style={{ cursor: "pointer", fontSize: 14 }}
              onClick={() =>
                handleNivel(e.especialidadId, e.nivel, !e.esPrincipal)
              }
            >
              {e.esPrincipal ? "⭐" : "☆"}
            </span>
            <strong>{e.especialidad?.nombre}</strong>
            {/* Selector de nivel */}
            <select
              className="form-select form-select-sm py-0"
              style={{ width: 110, fontSize: 11 }}
              value={e.nivel || ""}
              onChange={(ev) =>
                handleNivel(
                  e.especialidadId,
                  ev.target.value || null,
                  e.esPrincipal,
                )
              }
            >
              <option value="">Sin nivel</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {/* Botón quitar */}
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-0 px-1"
              style={{ fontSize: 11, lineHeight: 1.5 }}
              onClick={() => handleRemover(e.especialidadId)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Formulario agregar */}
      {disponibles.length > 0 && (
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <select
            className="form-select form-select-sm"
            style={{ width: 180 }}
            value={nuevaEspId}
            onChange={(e) => setNuevaEspId(e.target.value)}
          >
            <option value="">+ Agregar especialidad</option>
            {disponibles.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: 120 }}
            value={nuevoNivel}
            onChange={(e) => setNuevoNivel(e.target.value)}
          >
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="form-check mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id={`principal-${joyero.id}`}
              checked={esPrincipal}
              onChange={(e) => setEsPrincipal(e.target.checked)}
            />
            <label
              className="form-check-label small"
              htmlFor={`principal-${joyero.id}`}
            >
              Principal
            </label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleAgregar}>
            Agregar
          </button>
        </div>
      )}
      {disponibles.length === 0 && (joyero.especialidades || []).length > 0 && (
        <p className="text-muted small mb-0">
          Este joyero tiene todas las especialidades disponibles.
        </p>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────
export default function Joyero() {
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
      tipoEntidad="joyero"
      campos={camposJoyero}
      titulo="Joyeros / Maquiladores"
      descripcion="Catálogo de joyeros externos que elaboran las piezas — expanda una fila para gestionar especialidades"
      textoBoton="Joyero"
      queries={{
        GET: GET_JOYEROS_CURSOR,
        CREAR: CREAR_JOYERO,
        ACTUALIZAR: ACTUALIZAR_JOYERO,
        ELIMINAR: ELIMINAR_JOYERO,
      }}
      fixedValues={valoresFijos}
      getDetalle={(row, refetch) => (
        <EspecialidadesPanel joyero={row} refetch={refetch} />
      )}
    />
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { GET_GRUPOS_POR_CODIGOS } from '../../graphql/grupoQueries.js';
import {
  GET_TERCEROS_CURSOR, CREAR_TERCERO, ACTUALIZAR_TERCERO, ELIMINAR_TERCERO,
  AGREGAR_ESPECIALIDAD_TERCERO, REMOVER_ESPECIALIDAD_TERCERO, ACTUALIZAR_NIVEL_ESP_TERCERO,
} from '../../graphql/terceroQueries.js';

const NIVELES = ['Experto','Intermedio','Básico'];

// ── Panel de especialidades (solo para Joyeros) ───────────────────
function EspecialidadesPanel({ tercero, refetch }) {
  const [espId, setEspId] = useState('');
  const [nivel, setNivel] = useState('Experto');
  const [esPpal, setEsPpal] = useState(false);

  const { data: dataGrupos } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: 'PRODU', subcatalogoCodigo: 'ESPE' }, fetchPolicy: 'network-only',
  });
  const grupos = dataGrupos?.gruposPorCodigos || [];
  const idsActuales = (tercero.especialidades || []).map((e) => e.especialidadId);
  const disponibles = grupos.filter((g) => !idsActuales.includes(g.id));

  const [agregar]    = useMutation(AGREGAR_ESPECIALIDAD_TERCERO);
  const [remover]    = useMutation(REMOVER_ESPECIALIDAD_TERCERO);
  const [actualizar] = useMutation(ACTUALIZAR_NIVEL_ESP_TERCERO);

  const handleAgregar = async () => {
    if (!espId) return toast.warning('Seleccione una especialidad');
    try {
      await agregar({ variables: { input: { terceroId: tercero.id, especialidadId: Number(espId), nivel, esPrincipal: esPpal } } });
      toast.success('Especialidad agregada');
      setEspId(''); setNivel('Experto'); setEsPpal(false);
      await refetch();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-3 bg-light border-top">
      <strong style={{ fontSize: 13 }}>Especialidades de {tercero.nombre}</strong>
      <div className="d-flex flex-wrap gap-2 my-2">
        {(tercero.especialidades || []).map((e) => (
          <div key={e.id} className="d-flex align-items-center gap-1 border rounded px-2 py-1" style={{ fontSize: 12 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => actualizar({ variables: { terceroId: tercero.id, especialidadId: e.especialidadId, nivel: e.nivel, esPrincipal: !e.esPrincipal } }).then(() => refetch())}>{e.esPrincipal ? '⭐' : '☆'}</span>
            <strong>{e.especialidad?.nombre}</strong>
            <select className="form-select form-select-sm py-0" style={{ width: 110, fontSize: 11 }} value={e.nivel||''} onChange={(ev) => actualizar({ variables: { terceroId: tercero.id, especialidadId: e.especialidadId, nivel: ev.target.value||null, esPrincipal: e.esPrincipal } }).then(() => refetch())}>
              <option value="">Sin nivel</option>
              {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-sm btn-outline-danger py-0 px-1" style={{ fontSize: 11 }} onClick={() => { if(window.confirm('¿Quitar?')) remover({ variables: { terceroId: tercero.id, especialidadId: e.especialidadId } }).then(() => refetch()); }}>✕</button>
          </div>
        ))}
      </div>
      {disponibles.length > 0 && (
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <select className="form-select form-select-sm" style={{ width: 180 }} value={espId} onChange={(e) => setEspId(e.target.value)}>
            <option value="">+ Agregar especialidad</option>
            {disponibles.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 120 }} value={nivel} onChange={(e) => setNivel(e.target.value)}>
            {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="d-flex align-items-center gap-1 small">
            <input type="checkbox" checked={esPpal} onChange={(e) => setEsPpal(e.target.checked)} /> Principal
          </label>
          <button className="btn btn-primary btn-sm" onClick={handleAgregar}>Agregar</button>
        </div>
      )}
    </div>
  );
}

// ── Campos por tipo de tercero ────────────────────────────────────
function useCamposTercero(tipoCodigo, tipoId) {
  return useMemo(() => {
    const base = [
      { nombre: 'nombre',   etiqueta: 'Nombre',   tipoForm: 'text', obligatorio: true, maxLength: 150, ancho: 'auto', ordenListado: 1 },
      { nombre: 'telefono', etiqueta: 'Teléfono', tipoForm: 'text', maxLength: 30, ancho: '130px', ordenListado: 2 },
      { nombre: 'ciudad',   etiqueta: 'Ciudad',   tipoForm: 'text', maxLength: 100, ancho: '120px', ordenListado: 3 },
      { nombre: 'activo',   etiqueta: 'Activo',   tipoForm: 'custom', ancho: '80px', ordenListado: 7, valorDefecto: true,
        renderForm: ({ form, handleChange }) => (
          <select className="form-select" name="activo" value={String(form.activo ?? true)} onChange={handleChange}>
            <option value="true">Sí</option><option value="false">No</option>
          </select>
        ),
        render: (f) => <span className={`badge ${f.activo ? 'bg-success' : 'bg-secondary'}`}>{f.activo ? 'Activo' : 'Inactivo'}</span>,
      },
      { nombre: 'nota',    etiqueta: 'Nota',    tipoForm: 'text', maxLength: 500, soloFormulario: true },
      { nombre: 'version', tipoForm: 'hidden', soloFormulario: true, valorDefecto: 1 },
    ];

    if (tipoCodigo === 'CLIENTE') {
      base.push(
        { nombre: 'tierId',  etiqueta: 'Tier',  tipoForm: 'select', ancho: '100px', ordenListado: 4,
          relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'CRM', subcatalogoCodigo: 'TIER' } },
          render: (f) => { const n=f.tier?.nombre; if(!n) return '-'; const c=n==='VIP'?'warning':n==='Recurrente'?'primary':'secondary'; return <span className={`badge bg-${c}`}>{n}</span>; },
        },
        { nombre: 'canalId', etiqueta: 'Canal', tipoForm: 'select', ancho: '110px', ordenListado: 5,
          relationConfig: { query: GET_GRUPOS_POR_CODIGOS, dataKey: 'gruposPorCodigos', valueField: 'id', displayField: 'nombre', fixedVariables: { catalogoCodigo: 'CRM', subcatalogoCodigo: 'CANA' } },
          render: (f) => f.canal?.nombre ?? '-',
        },
      );
    }

    if (tipoCodigo === 'JOYERO') {
      base.push({
        nombre: 'especialidades', etiqueta: 'Especialidades', soloListado: true, ancho: '220px', ordenListado: 4, ordenable: false,
        render: (f) => {
          const esp = f.especialidades || [];
          if (!esp.length) return <span className="text-muted" style={{ fontSize: 11 }}>Sin especialidades</span>;
          return <div className="d-flex flex-wrap gap-1">{esp.map((e) => <span key={e.id} className={`badge ${e.esPrincipal?'bg-primary':'bg-secondary'}`} style={{ fontSize: 10 }}>{e.esPrincipal?'⭐ ':''}{e.especialidad?.nombre}{e.nivel?` · ${e.nivel}`:''}</span>)}</div>;
        },
      });
    }

    if (tipoCodigo === 'SOCIO') {
      base.push({ nombre: 'porcentajeDefecto', etiqueta: '% Reparto', tipoForm: 'number', ancho: '100px', ordenListado: 4, valorDefecto: 0 });
    }

    return base.sort((a,b) => (a.ordenListado??99) - (b.ordenListado??99));
  }, [tipoCodigo]);
}

// ── Componente genérico para cada tipo ───────────────────────────
function TerceroVista({ tipoCodigo, titulo, descripcion, textoBoton, conEspecialidades=false }) {
  const empresaActual = useMemo(() => { try { return JSON.parse(localStorage.getItem('empresa')||'{}'); } catch { return {}; } }, []);

  // Necesitamos el tipoId real del catálogo
  const { data: dataTipos } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: 'GRAL', subcatalogoCodigo: 'TTRC' }, fetchPolicy: 'network-only',
  });
  const tipoId = useMemo(() => {
    const grupos = dataTipos?.gruposPorCodigos || [];
    return grupos.find((g) => g.codigo === tipoCodigo)?.id;
  }, [dataTipos, tipoCodigo]);

  const campos = useCamposTercero(tipoCodigo);

  if (!tipoId) return <div className="text-muted p-4">Cargando...</div>;

  return (
    <EntidadGenerica
      tipoEntidad="tercero"
      campos={campos}
      titulo={titulo}
      descripcion={descripcion}
      textoBoton={textoBoton}
      queries={{ GET: GET_TERCEROS_CURSOR, CREAR: CREAR_TERCERO, ACTUALIZAR: ACTUALIZAR_TERCERO, ELIMINAR: ELIMINAR_TERCERO }}
      fixedValues={{ empresaId: empresaActual.id, tipoId }}
      extraVariables={{ tipoCodigo }}
      getDetalle={conEspecialidades ? ((row, refetch) => <EspecialidadesPanel tercero={row} refetch={refetch} />) : undefined}
    />
  );
}

export const Clientas    = () => <TerceroVista tipoCodigo="CLIENTE"    titulo="Clientas"    descripcion="Base de clientas con tier y canal de llegada" textoBoton="Clienta" />;
export const Joyeros     = () => <TerceroVista tipoCodigo="JOYERO"     titulo="Joyeros / Maquiladores" descripcion="Expanda una fila para gestionar especialidades" textoBoton="Joyero" conEspecialidades />;
export const Proveedores = () => <TerceroVista tipoCodigo="PROVEEDOR"  titulo="Proveedores" descripcion="Proveedores de oro, piedras e insumos" textoBoton="Proveedor" />;
export const Socios      = () => <TerceroVista tipoCodigo="SOCIO"      titulo="Socias"      descripcion="Socias del negocio con porcentaje de reparto" textoBoton="Socia" />;

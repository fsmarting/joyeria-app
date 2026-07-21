import { useMemo, useState } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GET_GRUPOS_POR_CODIGOS }   from '../../graphql/grupoQueries.js';
import { OBTENER_USUARIOS }          from '../../graphql/ventaQueries.js';
import { GET_PRODUCTOS_CURSOR }      from '../../graphql/productoQueries.js';
import {
  GET_CONVERSACIONES_CURSOR, BUSCAR_CONTACTO,
  CREAR_CONVERSACION, ACTUALIZAR_CONVERSACION, ELIMINAR_CONVERSACION,
} from '../../graphql/conversacionQueries.js';

const fmtF = (s) => s ? new Date(s).toLocaleDateString('es-CO') : '-';

// ── Formulario de Conversación ────────────────────────────────
function FormConversacion({ inicial, empresaId, onGuardar, onCancelar }) {
  const hoy = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    fecha:           inicial?.fecha ? String(inicial.fecha).split('T')[0] : hoy,
    telefono:        inicial?.telefono || '',
    nombreContacto:  inicial?.nombreContacto || inicial?.cliente?.nombre || '',
    clienteId:       inicial?.clienteId || null,
    canalId:         inicial?.canalId || '',
    tierEstimadoId:  inicial?.tierEstimadoId || '',
    usuarioId:       inicial?.usuarioId || '',
    cotizo:          inicial?.cotizo ?? false,
    cerro:           inicial?.cerro  ?? false,
    motivoPerdidaId: inicial?.motivoPerdidaId || '',
    tiempoRespuesta: inicial?.tiempoRespuesta || '',
    usoProtocolo:    inicial?.usoProtocolo ?? false,
    nota:            inicial?.nota || '',
    piezasIds:       (inicial?.piezas || []).map(p => p.productoId),
  });
  const [buscando,  setBuscando]  = useState(false);
  const [esCliente, setEsCliente] = useState(!!inicial?.clienteId);

  const { data: dataCanales }  = useQuery(GET_GRUPOS_POR_CODIGOS, { variables: { catalogoCodigo:'CRM', subcatalogoCodigo:'CANA' } });
  const { data: dataTiers }    = useQuery(GET_GRUPOS_POR_CODIGOS, { variables: { catalogoCodigo:'CRM', subcatalogoCodigo:'TIER' } });
  const { data: dataMotivos }  = useQuery(GET_GRUPOS_POR_CODIGOS, { variables: { catalogoCodigo:'CRM', subcatalogoCodigo:'MOTI' } });
  const { data: dataUsuarios } = useQuery(OBTENER_USUARIOS);
  const { data: dataProds }    = useQuery(GET_PRODUCTOS_CURSOR, { variables: { first: 100 } });

  const canales  = dataCanales?.gruposPorCodigos  || [];
  const tiers    = dataTiers?.gruposPorCodigos    || [];
  const motivos  = dataMotivos?.gruposPorCodigos  || [];
  const usuarios = dataUsuarios?.obtenerUsuarios  || [];
  const productos = (dataProds?.productosFiltradosCursor?.edges || []).map(e => e.node);

  const [buscarContacto] = useLazyQuery(BUSCAR_CONTACTO, {
    onCompleted: (data) => {
      const r = data?.buscarContactoPorCelular;
      if (r?.esCliente) {
        setForm(f => ({ ...f, nombreContacto: r.nombre, clienteId: r.clienteId }));
        setEsCliente(true);
        toast.success(`✓ Clienta encontrada: ${r.nombre}`);
      } else {
        setEsCliente(false);
        toast.info('Contacto nuevo — ingrese el nombre si lo tiene');
      }
      setBuscando(false);
    },
  });

  const handleBuscar = () => {
    if (!form.telefono.trim()) return;
    setBuscando(true);
    buscarContacto({ variables: { telefono: form.telefono.trim(), empresaId: Number(empresaId) } });
  };

  const togglePieza = (productoId) => {
    setForm(f => ({
      ...f,
      piezasIds: f.piezasIds.includes(productoId)
        ? f.piezasIds.filter(id => id !== productoId)
        : [...f.piezasIds, productoId],
    }));
  };

  const handleGuardar = () => {
    if (!form.telefono && !form.clienteId) return toast.warning('Ingrese el celular del contacto');
    const fecha = form.fecha && !String(form.fecha).includes('-')
      ? new Date(Number(form.fecha)).toISOString().split('T')[0]
      : String(form.fecha).split('T')[0];
    const esUpdate = !!inicial?.id;
    onGuardar({
      ...form,
      fecha,
      ...(esUpdate ? {} : { empresaId: Number(empresaId) }),
      ...(form.clienteId ? { clienteId: Number(form.clienteId) } : {}),
      canalId:         form.canalId         ? Number(form.canalId)         : null,
      tierEstimadoId:  form.tierEstimadoId  ? Number(form.tierEstimadoId)  : null,
      usuarioId:       form.usuarioId       ? Number(form.usuarioId)       : null,
      motivoPerdidaId: form.motivoPerdidaId ? Number(form.motivoPerdidaId) : null,
      piezasIds:       form.piezasIds,
      version:         inicial?.version ?? 1,
      ...(esUpdate ? { id: inicial.id } : {}),
    });
  };

  const sel  = (field) => ({ className:'form-select', value: form[field]??'', onChange: e=>setForm(f=>({...f,[field]:e.target.value})) });
  const bool = (field) => ({ className:'form-select', value: String(form[field]??false), onChange: e=>setForm(f=>({...f,[field]:e.target.value==='true'})) });

  return (
    <div className="card border-0 shadow-sm p-3 mb-3" style={{fontSize:13}}>
      <div className="fw-bold mb-3" style={{fontSize:14}}>
        {inicial?.id ? '✏️ Editar conversación' : '+ Nueva conversación'}
      </div>
      <div className="row g-2">
        <div className="col-md-2">
          <label className="form-label mb-1">Fecha *</label>
          <input type="date" className="form-control" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
        </div>
        <div className="col-md-3">
          <label className="form-label mb-1">Celular (ID) *</label>
          <div className="input-group">
            <input type="text" className="form-control" placeholder="3001234567"
              value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&handleBuscar()}/>
            <button className="btn btn-outline-secondary btn-sm" onClick={handleBuscar} disabled={buscando}>
              {buscando?'⏳':'🔍'}
            </button>
          </div>
          {esCliente && <small className="text-success">✓ Clienta registrada</small>}
        </div>
        <div className="col-md-3">
          <label className="form-label mb-1">Nombre <span className="text-muted">(opcional)</span></label>
          <input type="text" className="form-control" placeholder="Si no lo tiene déjelo vacío"
            value={form.nombreContacto} onChange={e=>setForm(f=>({...f,nombreContacto:e.target.value}))}/>
        </div>
        <div className="col-md-2">
          <label className="form-label mb-1">Canal</label>
          <select {...sel('canalId')}>
            <option value="">—</option>
            {canales.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label mb-1">Tier estimado</label>
          <select {...sel('tierEstimadoId')}>
            <option value="">—</option>
            {tiers.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>

        {/* Piezas de interés */}
        <div className="col-12">
          <label className="form-label mb-1">Piezas de interés</label>
          <div className="d-flex flex-wrap gap-2">
            {productos.map(p => {
              const selec = form.piezasIds.includes(p.id);
              return (
                <button key={p.id} type="button"
                  onClick={() => togglePieza(p.id)}
                  className={`btn btn-sm ${selec?'btn-primary':'btn-outline-secondary'}`}
                  style={{fontSize:11}}>
                  {p.referencia} — {p.nombre}{selec?' ✓':''}
                </button>
              );
            })}
            {productos.length===0 && <span className="text-muted" style={{fontSize:12}}>Sin productos en catálogo</span>}
          </div>
        </div>

        <div className="col-md-2">
          <label className="form-label mb-1">¿Cotizó?</label>
          <select {...bool('cotizo')}><option value="false">No</option><option value="true">Sí</option></select>
        </div>
        <div className="col-md-2">
          <label className="form-label mb-1">¿Cerró?</label>
          <select {...bool('cerro')}><option value="false">No</option><option value="true">Sí</option></select>
        </div>
        {!form.cerro && (
          <div className="col-md-3">
            <label className="form-label mb-1">Motivo no cierre</label>
            <select {...sel('motivoPerdidaId')}>
              <option value="">—</option>
              {motivos.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="col-md-3">
          <label className="form-label mb-1">Tiempo de respuesta</label>
          <input type="text" className="form-control" placeholder="Ej: 2 horas, mismo día"
            value={form.tiempoRespuesta} onChange={e=>setForm(f=>({...f,tiempoRespuesta:e.target.value}))}/>
        </div>
        <div className="col-md-2">
          <label className="form-label mb-1">¿Usó protocolo?</label>
          <select {...bool('usoProtocolo')}><option value="false">No</option><option value="true">Sí</option></select>
        </div>
        <div className="col-md-2">
          <label className="form-label mb-1">Atendió</label>
          <select {...sel('usuarioId')}>
            <option value="">—</option>
            {usuarios.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div className="col-12">
          <label className="form-label mb-1">Notas</label>
          <textarea className="form-control" rows={2} placeholder="Observaciones adicionales"
            value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))}/>
        </div>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary btn-sm" onClick={handleGuardar}>Guardar</button>
        <button className="btn btn-outline-secondary btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Fila de conversación ──────────────────────────────────────
function FilaConversacion({ conv, empresaId, onEditar, onEliminar, onCotizar }) {
  const nombre = conv.nombreContacto || conv.cliente?.nombre || conv.telefono || '—';
  return (
    <tr>
      <td style={{fontSize:12}}>{fmtF(conv.fecha)}</td>
      <td style={{fontSize:12}}>
        <div className="fw-bold">{nombre}</div>
        {conv.telefono && <div className="text-muted" style={{fontSize:11}}>📱 {conv.telefono}</div>}
      </td>
      <td style={{fontSize:11}}>{conv.canal?.nombre ?? '—'}</td>
      <td style={{fontSize:11}}>{conv.tierEstimado?.nombre ?? '—'}</td>
      <td>
        {(conv.piezas||[]).length > 0
          ? <div className="d-flex flex-wrap gap-1">
              {conv.piezas.map(p=>(
                <span key={p.id} className="badge bg-light text-dark border" style={{fontSize:10}}>
                  {p.producto?.referencia}
                </span>
              ))}
            </div>
          : <span className="text-muted" style={{fontSize:11}}>—</span>}
      </td>
      <td><span className={`badge ${conv.cotizo?'bg-primary':'bg-secondary'}`} style={{fontSize:11}}>{conv.cotizo?'Sí':'No'}</span></td>
      <td><span className={`badge ${conv.cerro?'bg-success':'bg-secondary'}`} style={{fontSize:11}}>{conv.cerro?'Sí':'No'}</span></td>
      <td style={{fontSize:11}}>{conv.motivoPerdida?.nombre ?? '—'}</td>
      <td style={{fontSize:11}}>{conv.tiempoRespuesta ?? '—'}</td>
      <td>
        <div className="d-flex gap-1">
          {/* Botón cotizar — solo si cotizó y tiene clienta o teléfono */}
          {conv.cotizo && (
            <button
              className="btn btn-sm btn-outline-warning py-0 px-1"
              style={{fontSize:11}}
              title="Crear cotización desde esta conversación"
              onClick={()=>onCotizar(conv)}>
              📋
            </button>
          )}
          <button className="btn btn-sm btn-outline-primary py-0 px-1" style={{fontSize:11}} onClick={()=>onEditar(conv)}>✏️</button>
          <button className="btn btn-sm btn-outline-danger py-0 px-1"  style={{fontSize:11}} onClick={()=>onEliminar(conv.id)}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Conversacion() {
  const navigate = useNavigate();
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); } catch { return {}; }
  }, []);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando,    setEditando]    = useState(null);
  const [busqueda,    setBusqueda]    = useState('');

  const { data, loading, refetch } = useQuery(GET_CONVERSACIONES_CURSOR, {
    variables: { first: 20, busqueda },
    fetchPolicy: 'network-only',
  });

  const [crear]      = useMutation(CREAR_CONVERSACION);
  const [actualizar] = useMutation(ACTUALIZAR_CONVERSACION);
  const [eliminar]   = useMutation(ELIMINAR_CONVERSACION);

  const conversaciones = (data?.conversacionesFiltradosCursor?.edges || []).map(e => e.node);

  const handleGuardar = async (input) => {
    try {
      if (input.id) {
        await actualizar({ variables: { input } });
        toast.success('Conversación actualizada');
      } else {
        await crear({ variables: { input } });
        toast.success('Conversación registrada');
      }
      setMostrarForm(false); setEditando(null);
      await refetch();
    } catch(e) { toast.error(e.message); }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta conversación?')) return;
    try { await eliminar({ variables: { id } }); toast.success('Eliminada'); await refetch(); }
    catch(e) { toast.error(e.message); }
  };

  // ── Botón 📋 — navegar a cotizaciones con datos pre-rellenos
  const handleCotizar = (conv) => {
    // Guardamos en sessionStorage los datos de la conversación
    // para que Cotizacion.jsx los lea y pre-rellene el formulario
    sessionStorage.setItem('cotizacion_origen', JSON.stringify({
      conversacionId: conv.id,
      clienteId:      conv.clienteId ?? null,
      telefono:       conv.telefono  ?? null,
      nombre:         conv.nombreContacto || conv.cliente?.nombre || null,
      piezasIds:      (conv.piezas || []).map(p => p.productoId),
    }));
    navigate('/cotizaciones');
    toast.info('📋 Complete los precios y guarde la cotización');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 className="mb-0 fw-bold">💬 Conversaciones</h5>
          <small className="text-muted">Registro de contactos e interacciones — 📋 crea cotización desde conversaciones con cotizó=Sí</small>
        </div>
        <div className="d-flex gap-2">
          <input className="form-control form-control-sm" style={{width:220}}
            placeholder="Buscar por celular o nombre..."
            value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
          <button className="btn btn-primary btn-sm"
            onClick={()=>{ setMostrarForm(true); setEditando(null); }}>
            + Conversación
          </button>
        </div>
      </div>

      {(mostrarForm || editando) && (
        <FormConversacion
          inicial={editando}
          empresaId={empresaActual.id}
          onGuardar={handleGuardar}
          onCancelar={()=>{ setMostrarForm(false); setEditando(null); }}/>
      )}

      {loading ? <p className="text-muted">Cargando...</p> : (
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle" style={{fontSize:12}}>
            <thead className="table-dark">
              <tr>
                <th>Fecha</th><th>Contacto</th><th>Canal</th><th>Tier</th>
                <th>Piezas interés</th><th>Cotizó</th><th>Cerró</th>
                <th>Motivo</th><th>T. Respuesta</th><th></th>
              </tr>
            </thead>
            <tbody>
              {conversaciones.length === 0
                ? <tr><td colSpan={10} className="text-center text-muted py-4">Sin conversaciones registradas</td></tr>
                : conversaciones.map(c=>(
                    <FilaConversacion key={c.id} conv={c}
                      empresaId={empresaActual.id}
                      onEditar={c=>{ setEditando(c); setMostrarForm(false); }}
                      onEliminar={handleEliminar}
                      onCotizar={handleCotizar}/>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

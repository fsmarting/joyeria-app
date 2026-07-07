import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposOrdenProduccion } from '../../data/camposOrdenProduccion.jsx';
import {
  GET_ORDENES_CURSOR, CREAR_ORDEN, ACTUALIZAR_ORDEN, ELIMINAR_ORDEN,
  REGISTRAR_ENTREGA, CONCILIAR_ENTREGA,
  AGREGAR_DETALLE, REGISTRAR_DEVOLUCION, ELIMINAR_DETALLE,
} from '../../graphql/ordenProduccionQueries.js';
import { GET_COMPRAS_POR_PIEDRA } from '../../graphql/compraInsumoQueries.js';
import { GET_PIEDRAS_CURSOR }     from '../../graphql/piedraQueries.js';

const fmt  = (n) => n != null ? `$${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0})}` : '-';
const fmtQ = (n, u='') => n != null ? `${Number(n).toLocaleString('es-CO',{maximumFractionDigits:4})} ${u}`.trim() : '-';
const fmtF = (s) => s ? new Date(s).toLocaleDateString('es-CO') : '-';

const BADGE_CONCILIACION = {
  PENDIENTE:   'bg-secondary',
  CONCILIADO:  'bg-success',
  DISPUTA:     'bg-danger',
};

// ── Fila de detalle ───────────────────────────────────────────────
function DetalleRow({ d, onDevolver, onEliminar }) {
  const [cantDev, setCantDev] = useState('');
  const u = d.piedra?.unidad?.nombre || '';
  return (
    <tr>
      <td><strong>{d.piedra?.codigo}</strong> {d.piedra?.nombre}</td>
      <td style={{fontSize:11}}>{d.compraInsumo?.numero} · {fmtF(d.compraInsumo?.fecha)}</td>
      <td>{fmtQ(d.cantidad,u)}</td>
      <td>{fmt(d.costoUnitario)}</td>
      <td>{fmt(d.costoTotal)}</td>
      <td>{fmtQ(d.cantidadEnviada,u)}</td>
      <td>{Number(d.cantidadDevuelta)>0?<span className="badge bg-success">{fmtQ(d.cantidadDevuelta,u)}</span>:<span className="text-muted">—</span>}</td>
      <td>{Number(d.merma)>0?<span className="badge bg-warning text-dark">{fmtQ(d.merma,u)}</span>:<span className="text-muted">—</span>}</td>
      <td>
        <div className="d-flex gap-1">
          {Number(d.cantidadDevuelta)===0 && <>
            <input type="number" className="form-control form-control-sm py-0" style={{width:65,fontSize:11}} placeholder="Dev." value={cantDev} onChange={e=>setCantDev(e.target.value)}/>
            <button className="btn btn-sm btn-outline-success py-0 px-1" style={{fontSize:11}} onClick={()=>onDevolver(d,cantDev)}>✓</button>
          </>}
          <button className="btn btn-sm btn-outline-danger py-0 px-1" style={{fontSize:11}} onClick={()=>onEliminar(d.id)}>✕</button>
        </div>
      </td>
    </tr>
  );
}

// ── Fila de historial de entregas con conciliación ────────────────
function EntregaRow({ e, onConciliar }) {
  const [expandido, setExpandido] = useState(false);
  const [estado, setEstado]       = useState(e.estadoConciliacion);
  const [nota,   setNota]         = useState(e.notaConciliacion || '');
  const badge = BADGE_CONCILIACION[e.estadoConciliacion] || 'bg-secondary';
  const hayDiferencia = e.cantidadJoyero !== null && e.cantidadJoyero !== undefined && e.cantidadJoyero !== e.cantidad;

  return (
    <>
      <tr>
        <td><strong style={{fontFamily:'monospace'}}>{e.numeroRemision}</strong></td>
        <td className="text-muted" style={{fontSize:11}}>{e.numeroJoyero || '—'}</td>
        <td>{fmtF(e.fecha)}</td>
        <td><span className="badge bg-success">{e.cantidad} piezas</span></td>
        <td>
          {hayDiferencia
            ? <span className="badge bg-warning text-dark">{e.cantidadJoyero} piezas ⚠</span>
            : <span className="text-muted">—</span>}
        </td>
        <td>{fmt(e.valorEntregado)}</td>
        <td><span className={`badge ${badge}`}>{e.estadoConciliacion}</span></td>
        <td>
          {e.estadoConciliacion !== 'CONCILIADO' && (
            <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{fontSize:11}} onClick={()=>setExpandido(!expandido)}>
              {expandido ? '▲' : '▼'} Conciliar
            </button>
          )}
        </td>
      </tr>
      {expandido && (
        <tr className="bg-light">
          <td colSpan={8} className="py-2 px-3">
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div>
                <label className="form-label mb-0" style={{fontSize:12}}>Estado</label>
                <select className="form-select form-select-sm" style={{width:140}} value={estado} onChange={e=>setEstado(e.target.value)}>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="CONCILIADO">Conciliado ✓</option>
                  <option value="DISPUTA">Disputa ⚠</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <label className="form-label mb-0" style={{fontSize:12}}>Nota de conciliación</label>
                <input type="text" className="form-control form-control-sm" maxLength={500}
                  placeholder="Ej: Joyero acepta 4 piezas, la 5ta quedó sin terminar"
                  value={nota} onChange={ev=>setNota(ev.target.value)}/>
              </div>
              <button className="btn btn-success btn-sm"
                onClick={()=>onConciliar(e.id, estado, nota, e.version).then(()=>setExpandido(false))}>
                Guardar conciliación
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Panel principal ───────────────────────────────────────────────
function DetallesPanel({ orden, refetch }) {
  const [cantEntrega,  setCantEntrega]  = useState('');
  const [cantJoyero,   setCantJoyero]   = useState('');
  const [numJoyero,    setNumJoyero]    = useState('');
  const [notaEntrega,  setNotaEntrega]  = useState('');
  const [piedraSelId,  setPiedraSelId]  = useState('');
  const [compraSelId,  setCompraSelId]  = useState('');
  const [cantidad,     setCantidad]     = useState('');
  const [desperdicio,  setDesperdicio]  = useState('0');

  const { data: dataPiedras } = useQuery(GET_PIEDRAS_CURSOR, { variables: { first:100 }, fetchPolicy:'network-only' });
  const piedras = (dataPiedras?.piedrasFiltradosCursor?.edges||[]).map(e=>e.node);

  const { data: dataCompras } = useQuery(GET_COMPRAS_POR_PIEDRA, { variables:{ piedraId:Number(piedraSelId) }, skip:!piedraSelId, fetchPolicy:'network-only' });
  const comprasDisponibles = dataCompras?.comprasPorPiedra || [];
  const compraActual = comprasDisponibles.find(c=>String(c.id)===String(compraSelId));
  const piedraActual = piedras.find(p=>String(p.id)===String(piedraSelId));

  const cantidadEnviada = cantidad && orden.cantidadProgramada ? Number(cantidad)*Number(orden.cantidadProgramada) : 0;
  const costoUnitario   = compraActual ? Number(compraActual.costoUnitario) : 0;
  const costoTotal      = Number(cantidad)*costoUnitario*Number(orden.cantidadProgramada);
  const valorEnviado    = cantidadEnviada*costoUnitario;

  const [registrarEntrega] = useMutation(REGISTRAR_ENTREGA);
  const [conciliar]        = useMutation(CONCILIAR_ENTREGA);
  const [agregar]          = useMutation(AGREGAR_DETALLE);
  const [devolver]         = useMutation(REGISTRAR_DEVOLUCION);
  const [eliminar]         = useMutation(ELIMINAR_DETALLE);

  const pendientes = Number(orden.cantidadProgramada) - Number(orden.cantidadEntregada);
  const entregas   = orden.entregas || [];
  const enDisputa  = entregas.filter(e=>e.estadoConciliacion==='DISPUTA').length;

  const handleEntrega = async () => {
    if (!cantEntrega || Number(cantEntrega)<=0) return toast.warning('Ingrese la cantidad recibida');
    if (Number(cantEntrega)>pendientes) return toast.error(`Máximo ${pendientes} piezas pendientes`);
    try {
      await registrarEntrega({ variables: { input: {
        ordenProduccionId: orden.id,
        cantidad:          Number(cantEntrega),
        cantidadJoyero:    cantJoyero ? Number(cantJoyero) : null,
        numeroJoyero:      numJoyero  || null,
        nota:              notaEntrega || null,
      }}});
      const hayDif = cantJoyero && Number(cantJoyero) !== Number(cantEntrega);
      toast[hayDif?'warning':'success'](hayDif ? `⚠ Entrega en DISPUTA — Río Rayo: ${cantEntrega}, Joyero: ${cantJoyero}` : `Entrega registrada — Remisión generada`);
      setCantEntrega(''); setCantJoyero(''); setNumJoyero(''); setNotaEntrega('');
      await refetch();
    } catch(e) { toast.error(e.message); }
  };

  const handleConciliar = async (id, estado, nota, version) => {
    try {
      await conciliar({ variables: { input: { id, estadoConciliacion: estado, notaConciliacion: nota||null, version } } });
      toast.success('Conciliación guardada');
      await refetch();
    } catch(e) { toast.error(e.message); }
  };

  const handleAgregar = async () => {
    if (!piedraSelId||!compraSelId||!cantidad) return toast.warning('Complete insumo, compra y cantidad');
    if (cantidadEnviada>Number(compraActual?.cantidadDisponible)) return toast.error(`Stock insuficiente`);
    try {
      await agregar({ variables:{ input:{ ordenProduccionId:orden.id, compraInsumoId:Number(compraSelId), piedraId:Number(piedraSelId), cantidad:Number(cantidad), costoUnitario, costoTotal, desperdicio:Number(desperdicio), cantidadEnviada, valorEnviado }}});
      toast.success('Insumo agregado'); setPiedraSelId(''); setCompraSelId(''); setCantidad(''); setDesperdicio('0');
      await refetch();
    } catch(e) { toast.error(e.message); }
  };

  const handleDevolucion = async (d, cantDev) => {
    if (!cantDev||Number(cantDev)<=0) return;
    try { await devolver({ variables:{ input:{ id:d.id, cantidadDevuelta:Number(cantDev), valorDevuelto:Number(cantDev)*d.costoUnitario, version:d.version }}}); toast.success('Devolución registrada'); await refetch(); }
    catch(e) { toast.error(e.message); }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Quitar este insumo? Se restaurará el stock.')) return;
    try { await eliminar({ variables:{ id }}); toast.success('Insumo removido'); await refetch(); }
    catch(e) { toast.error(e.message); }
  };

  return (
    <div className="p-3 bg-light border-top">
      {/* Resumen */}
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <strong style={{fontSize:13}}>{orden.numero} · {orden.producto?.nombre}</strong>
        <span className="text-muted small">
          Programadas: <strong>{orden.cantidadProgramada}</strong> ·
          Recibidas: <strong className={pendientes===0?'text-success':'text-warning'}>{orden.cantidadEntregada}</strong> ·
          Pendientes: <strong className={pendientes>0?'text-danger':'text-success'}>{pendientes}</strong>
          {enDisputa>0 && <span className="badge bg-danger ms-2">⚠ {enDisputa} en disputa</span>}
        </span>
      </div>

      {/* ── Registrar entrega ── */}
      {pendientes>0 && (
        <div className="border rounded p-2 bg-white mb-3">
          <div className="fw-bold mb-2" style={{fontSize:13}}>📦 Registrar entrega del joyero</div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0" style={{fontSize:12}}>Piezas recibidas por Río Rayo</label>
              <input type="number" className="form-control form-control-sm" style={{width:150}}
                min="1" max={pendientes} placeholder={`Máx: ${pendientes}`}
                value={cantEntrega} onChange={e=>setCantEntrega(e.target.value)}/>
            </div>
            <div>
              <label className="form-label mb-0" style={{fontSize:12}}>Piezas según joyero (si difiere)</label>
              <input type="number" className="form-control form-control-sm" style={{width:150}}
                placeholder="Dejar vacío si coincide"
                value={cantJoyero} onChange={e=>setCantJoyero(e.target.value)}/>
            </div>
            <div>
              <label className="form-label mb-0" style={{fontSize:12}}>N° remisión del joyero (opcional)</label>
              <input type="text" className="form-control form-control-sm" style={{width:160}}
                placeholder="Ej: REM-047" maxLength={50}
                value={numJoyero} onChange={e=>setNumJoyero(e.target.value)}/>
            </div>
            <div>
              <label className="form-label mb-0" style={{fontSize:12}}>Nota</label>
              <input type="text" className="form-control form-control-sm" style={{width:200}}
                placeholder="Opcional" maxLength={200}
                value={notaEntrega} onChange={e=>setNotaEntrega(e.target.value)}/>
            </div>
            <button className="btn btn-success btn-sm" onClick={handleEntrega}>
              Registrar entrega
            </button>
          </div>
          {cantJoyero && cantJoyero!==cantEntrega && (
            <div className="alert alert-warning py-1 px-2 mt-2 mb-0" style={{fontSize:12}}>
              ⚠ Diferencia detectada — esta entrega quedará en estado <strong>DISPUTA</strong> para conciliación.
            </div>
          )}
        </div>
      )}

      {/* ── Historial de entregas (con conciliación) ── */}
      {entregas.length>0 && (
        <div className="mb-3">
          <div className="fw-bold mb-1" style={{fontSize:12}}>Historial de entregas y remisiones</div>
          <table className="table table-sm align-middle mb-0" style={{fontSize:11}}>
            <thead>
              <tr>
                <th>Remisión (sistema)</th>
                <th>N° Joyero</th>
                <th>Fecha</th>
                <th>Piezas Río Rayo</th>
                <th>Piezas Joyero</th>
                <th>Valor</th>
                <th>Conciliación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entregas.map(e=><EntregaRow key={e.id} e={e} onConciliar={handleConciliar}/>)}
            </tbody>
            <tfoot>
              <tr className="fw-bold" style={{borderTop:'2px solid var(--border)'}}>
                <td colSpan={3}>Total acumulado</td>
                <td>{orden.cantidadEntregada} piezas</td>
                <td></td>
                <td>{fmt(orden.valorEntregado)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Insumos enviados ── */}
      <div className="fw-bold mb-1" style={{fontSize:12}}>Insumos enviados al joyero</div>
      {(orden.detalles||[]).length===0 && <p className="text-muted small mb-2">Sin insumos registrados.</p>}
      {(orden.detalles||[]).length>0 && (
        <table className="table table-sm table-striped align-middle mb-3" style={{fontSize:11}}>
          <thead><tr><th>Insumo</th><th>Compra</th><th>Cant/pieza</th><th>$ Unit.</th><th>$ Total</th><th>Enviado</th><th>Devuelto</th><th>Merma</th><th></th></tr></thead>
          <tbody>{(orden.detalles||[]).map(d=><DetalleRow key={d.id} d={d} onDevolver={handleDevolucion} onEliminar={handleEliminar}/>)}</tbody>
        </table>
      )}

      {/* Agregar insumo */}
      <div className="border rounded p-2 bg-white" style={{fontSize:12}}>
        <div className="fw-bold mb-2" style={{fontSize:12}}>+ Agregar insumo a la orden</div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label mb-0">Insumo</label>
            <select className="form-select form-select-sm" style={{width:220}} value={piedraSelId} onChange={e=>{setPiedraSelId(e.target.value);setCompraSelId('');setCantidad('');}}>
              <option value="">Seleccione insumo...</option>
              {piedras.map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.nombre} ({p.unidad?.nombre})</option>)}
            </select>
          </div>
          {piedraSelId && <div>
            <label className="form-label mb-0">Lote de compra</label>
            <select className="form-select form-select-sm" style={{width:260}} value={compraSelId} onChange={e=>setCompraSelId(e.target.value)}>
              <option value="">Seleccione lote...</option>
              {comprasDisponibles.map(c=><option key={c.id} value={c.id}>{c.numero} · {fmtF(c.fecha)} · {fmt(c.costoUnitario)}/{piedraActual?.unidad?.nombre} · Disp: {fmtQ(c.cantidadDisponible,piedraActual?.unidad?.nombre)}</option>)}
              {comprasDisponibles.length===0 && <option disabled>Sin stock</option>}
            </select>
          </div>}
          {compraSelId && <>
            <div>
              <label className="form-label mb-0">Cant./pieza</label>
              <input type="number" className="form-control form-control-sm" style={{width:100}} placeholder="0" value={cantidad} onChange={e=>setCantidad(e.target.value)}/>
            </div>
            <div>
              <label className="form-label mb-0">Desperdicio %</label>
              <input type="number" className="form-control form-control-sm" style={{width:80}} value={desperdicio} onChange={e=>setDesperdicio(e.target.value)}/>
            </div>
            {cantidad && <div className="text-muted" style={{fontSize:11}}>Enviar: {fmtQ(cantidadEnviada,piedraActual?.unidad?.nombre)} · {fmt(costoTotal)}</div>}
          </>}
          <button className="btn btn-primary btn-sm" onClick={handleAgregar}>Agregar</button>
        </div>
      </div>
    </div>
  );
}

export default function OrdenProduccion() {
  const empresaActual = useMemo(()=>{ try{return JSON.parse(localStorage.getItem('empresa')||'{}');}catch{return {};} },[]);
  return (
    <EntidadGenerica
      tipoEntidad="ordenproduccion" campos={camposOrdenProduccion}
      titulo="Órdenes de Producción"
      descripcion="Expanda ▸ para registrar entregas con remisión automática, insumos y conciliación"
      textoBoton="Orden"
      queries={{ GET:GET_ORDENES_CURSOR, CREAR:CREAR_ORDEN, ACTUALIZAR:ACTUALIZAR_ORDEN, ELIMINAR:ELIMINAR_ORDEN }}
      fixedValues={{ empresaId: empresaActual.id }}
      getDetalle={(orden,refetch)=><DetallesPanel orden={orden} refetch={refetch}/>}
    />
  );
}

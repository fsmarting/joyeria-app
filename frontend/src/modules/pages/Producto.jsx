import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import EntidadGenerica from '../../components/EntidadGenerica.jsx';
import { camposProducto } from '../../data/camposProducto.jsx';
import { GET_PIEDRAS_CURSOR }    from '../../graphql/piedraQueries.js';
import { GET_GRUPOS_POR_CODIGOS } from '../../graphql/grupoQueries.js';
import {
  GET_PRODUCTOS_CURSOR, CREAR_PRODUCTO, ACTUALIZAR_PRODUCTO, ELIMINAR_PRODUCTO,
  AGREGAR_INSUMO_PRODUCTO, ACTUALIZAR_INSUMO_PRODUCTO, ELIMINAR_INSUMO_PRODUCTO,
} from '../../graphql/productoQueries.js';

const fmt = (n) => n != null ? `$${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0})}` : '-';

// ── Fila de piedra editable ───────────────────────────────────
function PiedraRow({ item, onActualizar, onEliminar }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    cantidad:               item.cantidad,
    costoEstandardUnitario: item.costoEstandardUnitario,
    descripcion:            item.descripcion || '',
  });
  const total  = Number(form.cantidad) * Number(form.costoEstandardUnitario);
  const unidad = item.piedra?.unidad?.nombre ?? 'CT';

  return (
    <tr>
      <td><span className="text-muted" style={{fontSize:11}}>{item.tipoPiedra?.nombre ?? item.tipoId}</span></td>
      <td>
        {edit
          ? <input className="form-control form-control-sm" value={form.descripcion}
              onChange={e=>setForm({...form,descripcion:e.target.value})} style={{width:140}}/>
          : form.descripcion || <span className="text-muted">—</span>}
      </td>
      <td><strong>{item.piedra?.codigo}</strong> {item.piedra?.nombre}</td>
      <td>
        {edit
          ? <input type="number" className="form-control form-control-sm"
              value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})} style={{width:80}}/>
          : `${Number(item.cantidad).toFixed(4)} ${unidad}`}
      </td>
      <td>
        {edit
          ? <input type="number" className="form-control form-control-sm"
              value={form.costoEstandardUnitario} onChange={e=>setForm({...form,costoEstandardUnitario:e.target.value})} style={{width:110}}/>
          : fmt(item.costoEstandardUnitario)}
      </td>
      <td className="fw-bold">{edit ? fmt(total) : fmt(item.costoEstandardTotal)}</td>
      <td>
        {edit
          ? <div className="d-flex gap-1">
              <button className="btn btn-sm btn-success py-0"
                onClick={()=>onActualizar({...item,...form,version:item.version}).then(()=>setEdit(false))}>✓</button>
              <button className="btn btn-sm btn-secondary py-0"
                onClick={()=>{setForm({cantidad:item.cantidad,costoEstandardUnitario:item.costoEstandardUnitario,descripcion:item.descripcion||''});setEdit(false);}}>✕</button>
            </div>
          : <div className="d-flex gap-1">
              <button className="btn btn-sm btn-outline-primary py-0 px-1" style={{fontSize:11}} onClick={()=>setEdit(true)}>✏️</button>
              <button className="btn btn-sm btn-outline-danger py-0 px-1"  style={{fontSize:11}} onClick={()=>onEliminar(item.id)}>✕</button>
            </div>}
      </td>
    </tr>
  );
}

// ── Panel BOM + Costeo ────────────────────────────────────────
function BomPanel({ producto, refetch }) {
  const [selectedTipoId,   setSelectedTipoId]   = useState('');
  const [selectedPiedraId, setSelectedPiedraId] = useState('');
  const [cantidad,         setCantidad]         = useState('');
  const [costoUnit,        setCostoUnit]        = useState('');
  const [descripcion,      setDescripcion]      = useState('');

  // Tipos de piedra desde catálogo PRODU/TBOM
  const { data: dataTipos } = useQuery(GET_GRUPOS_POR_CODIGOS, {
    variables: { catalogoCodigo: 'PRODU', subcatalogoCodigo: 'TBOM' },
    fetchPolicy: 'network-only',
  });
  const TIPOS = dataTipos?.gruposPorCodigos || [];

  // Catálogo de insumos (Piedras)
  const { data: dataPiedras } = useQuery(GET_PIEDRAS_CURSOR, {
    variables: { first: 100 }, fetchPolicy: 'network-only',
  });
  const piedras = (dataPiedras?.piedrasFiltradosCursor?.edges || []).map(e => e.node);

  const [agregar]    = useMutation(AGREGAR_INSUMO_PRODUCTO);
  const [actualizar] = useMutation(ACTUALIZAR_INSUMO_PRODUCTO);
  const [eliminar]   = useMutation(ELIMINAR_INSUMO_PRODUCTO);

  const bomItems         = producto.piedras || [];
  const tiposUsados      = new Set(bomItems.map(b => b.tipoId));
  const tiposDisponibles = TIPOS.filter(t => !tiposUsados.has(t.id));

  // Cálculos espejo del Excel
  const costoPiedras   = bomItems.reduce((s,b) => s + Number(b.costoEstandardTotal), 0);
  const costoOro       = Number(producto.gramosOro) * Number(producto.costoGramoOroUsado);
  const costoMO        = Number(producto.costoManoObra);
  const costoOtros     = Number(producto.costoOtros);
  const costoTotal     = costoPiedras + costoOro + costoMO + costoOtros;
  const mult           = Number(producto.multiplicador ?? 2.25);
  const precioSugerido = Math.round(costoTotal * mult);
  const pvpConIva      = Math.round(precioSugerido * 1.19);
  const precioVenta    = Number(producto.precioVenta);
  const ivaValor       = Math.round(precioSugerido * 0.19);
  const conTarjeta     = Math.round(precioSugerido * 1.07);
  const comisionMax    = Math.round(precioVenta * 0.20);

  const handleAgregar = async () => {
    if (!selectedTipoId || !selectedPiedraId || !cantidad || !costoUnit)
      return toast.warning('Complete tipo, piedra, peso y precio');
    try {
      await agregar({ variables: { input: {
        productoId:             producto.id,
        piedraId:               Number(selectedPiedraId),
        tipoId:                 Number(selectedTipoId),
        descripcion:            descripcion || null,
        cantidad:               Number(cantidad),
        costoEstandardUnitario: Number(costoUnit),
        desperdicio:            0,
      }}});
      toast.success('Piedra agregada al costeo');
      setSelectedTipoId(''); setSelectedPiedraId('');
      setCantidad(''); setCostoUnit(''); setDescripcion('');
      await refetch();
    } catch(e) { toast.error(e.message); }
  };

  const handleActualizar = async (item) => {
    try {
      await actualizar({ variables: { input: {
        id:                     item.id,
        tipoId:                 item.tipoId,
        descripcion:            item.descripcion || null,
        cantidad:               Number(item.cantidad),
        costoEstandardUnitario: Number(item.costoEstandardUnitario),
        desperdicio:            0,
        version:                item.version,
      }}});
      toast.success('Actualizado'); await refetch();
    } catch(e) { toast.error(e.message); }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Quitar esta piedra del costeo?')) return;
    try { await eliminar({ variables: { id } }); toast.success('Removida'); await refetch(); }
    catch(e) { toast.error(e.message); }
  };

  return (
    <div className="p-3 bg-light border-top">
      <div className="fw-bold mb-3" style={{fontSize:13}}>
        🧱 Costeo — {producto.referencia} · {producto.nombre}
      </div>

      {/* ── Aviso si no hay catálogo TBOM ── */}
      {TIPOS.length === 0 && (
        <div className="alert alert-warning py-2 mb-3" style={{fontSize:12}}>
          ⚠ Cree primero el subcatálogo <strong>TBOM</strong> en Admin → SubCatálogos (catálogo PRODU)
          y luego los grupos <strong>PRPAL, DEC1, DEC2, DEC3</strong> en Admin → Grupos.
        </div>
      )}

      {/* ── Tabla de piedras actuales ── */}
      {bomItems.length > 0 && (
        <table className="table table-sm align-middle mb-3" style={{fontSize:12}}>
          <thead>
            <tr className="table-dark">
              <th>Tipo</th><th>Descripción</th><th>Piedra/Insumo</th>
              <th>Peso</th><th>$/Unidad</th><th>Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {bomItems.map(b => (
              <PiedraRow key={b.id} item={b}
                onActualizar={handleActualizar}
                onEliminar={handleEliminar}/>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Formulario agregar piedra ── */}
      {tiposDisponibles.length > 0 && (
        <div className="border rounded p-2 bg-white mb-3" style={{fontSize:12}}>
          <div className="fw-bold mb-2">+ Agregar piedra al costeo</div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label mb-0">Tipo</label>
              <select className="form-select form-select-sm" style={{width:180}}
                value={selectedTipoId} onChange={e=>setSelectedTipoId(e.target.value)}>
                <option value="">Seleccione tipo...</option>
                {tiposDisponibles.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Descripción (opcional)</label>
              <input type="text" className="form-control form-control-sm" style={{width:160}}
                placeholder="Ej: oval, gota, princess"
                value={descripcion} onChange={e=>setDescripcion(e.target.value)}/>
            </div>
            <div>
              <label className="form-label mb-0">Piedra / insumo</label>
              <select className="form-select form-select-sm" style={{width:220}} value={selectedPiedraId}
                onChange={e=>{
                  setSelectedPiedraId(e.target.value);
                  const p = piedras.find(x=>String(x.id)===e.target.value);
                  if (p) setCostoUnit(String(p.costoEstandardPorUnidad));
                }}>
                <option value="">Seleccione...</option>
                {piedras.map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.nombre} ({p.unidad?.nombre})</option>)}
              </select>
            </div>
            <div>
              <label className="form-label mb-0">Peso (CT / GR)</label>
              <input type="number" className="form-control form-control-sm" style={{width:90}}
                placeholder="0" value={cantidad} onChange={e=>setCantidad(e.target.value)}/>
            </div>
            <div>
              <label className="form-label mb-0">$ / Unidad</label>
              <input type="number" className="form-control form-control-sm" style={{width:120}}
                placeholder="0" value={costoUnit} onChange={e=>setCostoUnit(e.target.value)}/>
            </div>
            {cantidad && costoUnit && (
              <div className="text-muted" style={{fontSize:11}}>
                = {fmt(Number(cantidad)*Number(costoUnit))}
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleAgregar}>Agregar</button>
          </div>
        </div>
      )}

      {/* ── Resumen costeo ── */}
      <div className="border rounded p-3 bg-white" style={{fontSize:12}}>
        <div className="fw-bold mb-2" style={{fontSize:13}}>💰 Costeo & Precios</div>
        <div className="row g-2">
          <div className="col-md-6">
            <table className="table table-sm mb-0" style={{fontSize:12}}>
              <tbody>
                <tr><td className="text-muted">💎 Costo piedras</td><td className="text-end">{fmt(costoPiedras)}</td></tr>
                <tr><td className="text-muted">🥇 Oro ({Number(producto.gramosOro).toFixed(2)}g × {fmt(producto.costoGramoOroUsado)})</td><td className="text-end">{fmt(costoOro)}</td></tr>
                <tr><td className="text-muted">🔧 Mano de obra</td><td className="text-end">{fmt(costoMO)}</td></tr>
                <tr><td className="text-muted">📦 Empaques y otros</td><td className="text-end">{fmt(costoOtros)}</td></tr>
                <tr className="table-dark fw-bold"><td>COSTO TOTAL</td><td className="text-end">{fmt(costoTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="col-md-6">
            <table className="table table-sm mb-0" style={{fontSize:12}}>
              <tbody>
                <tr><td className="text-muted">Precio sugerido (×{mult.toFixed(2)})</td><td className="text-end fw-bold text-primary">{fmt(precioSugerido)}</td></tr>
                <tr><td className="text-muted">PVP + IVA (×1.19)</td><td className="text-end fw-bold">{fmt(pvpConIva)}</td></tr>
                <tr><td className="text-muted">Precio venta actual</td><td className="text-end fw-bold text-success">{fmt(precioVenta)}</td></tr>
                <tr><td className="text-muted">IVA (19%)</td><td className="text-end">{fmt(ivaValor)}</td></tr>
                <tr><td className="text-muted">Con tarjeta (+7%)</td><td className="text-end">{fmt(conTarjeta)}</td></tr>
                <tr><td className="text-muted">Comisión máx (20%)</td><td className="text-end">{fmt(comisionMax)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Producto() {
  const empresaActual = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('empresa') || '{}'); } catch { return {}; }
  }, []);

  return (
    <EntidadGenerica
      tipoEntidad="producto"
      campos={camposProducto}
      titulo="Inventario & Costeo"
      descripcion="Expanda ▸ para costear — piedras, oro y precio sugerido calculado automáticamente"
      textoBoton="Producto"
      queries={{ GET: GET_PRODUCTOS_CURSOR, CREAR: CREAR_PRODUCTO, ACTUALIZAR: ACTUALIZAR_PRODUCTO, ELIMINAR: ELIMINAR_PRODUCTO }}
      fixedValues={{ empresaId: empresaActual.id }}
      getDetalle={(producto, refetch) => <BomPanel producto={producto} refetch={refetch} />}
    />
  );
}

import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const PERFIL_CLIENTA = gql`
  query PerfilClienta($clienteId: Int!, $empresaId: Int!) {
    perfilClienta(clienteId: $clienteId, empresaId: $empresaId) {
      clienteId nombre telefono
      totalComprado totalVentas ticketPromedio ultimaCompra
      ventas {
        id fecha precioVenta
        producto  { id referencia nombre foto }
        medioPago { id nombre }
        estado    { id codigo nombre }
      }
      conversaciones {
        id fecha telefono nombreContacto cotizo cerro
        canal { id nombre }
      }
      cotizaciones {
        id numero fecha total
        estado { id codigo nombre }
      }
    }
  }
`;

const fmt  = (n) => n != null ? `$${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0})}` : '-';
const fmtF = (s) => s ? new Date(s).toLocaleDateString('es-CO') : '-';

export default function PerfilClientaPanel({ clienta, empresaId }) {
  const { data, loading } = useQuery(PERFIL_CLIENTA, {
    variables: { clienteId: clienta.id, empresaId: Number(empresaId) },
    fetchPolicy: 'network-only',
    skip: !clienta.id,
  });

  const perfil = data?.perfilClienta;

  if (loading) return <div className="p-3 text-muted" style={{fontSize:13}}>Cargando perfil...</div>;
  if (!perfil)  return <div className="p-3 text-muted" style={{fontSize:13}}>Sin datos</div>;

  const diasDesdeUltimaCompra = perfil.ultimaCompra
    ? Math.floor((Date.now() - new Date(perfil.ultimaCompra).getTime()) / (1000*60*60*24))
    : null;

  return (
    <div className="p-3 bg-light border-top">

      {/* ── KPIs del cliente ── */}
      <div className="row g-2 mb-3">
        {[
          { label: 'Total comprado',   value: fmt(perfil.totalComprado),  color: 'success', icon: '💰' },
          { label: 'Ventas',           value: perfil.totalVentas,          color: 'primary', icon: '🛍️' },
          { label: 'Ticket promedio',  value: fmt(perfil.ticketPromedio),  color: 'info',    icon: '🏷️' },
          { label: 'Última compra',    value: diasDesdeUltimaCompra !== null ? `${diasDesdeUltimaCompra} días` : 'Sin compras', color: diasDesdeUltimaCompra > 60 ? 'warning' : 'success', icon: '📅' },
          { label: 'Conversaciones',   value: perfil.conversaciones.length, color: 'secondary', icon: '💬' },
          { label: 'Cotizaciones',     value: perfil.cotizaciones.length,   color: 'secondary', icon: '📋' },
        ].map((k,i) => (
          <div key={i} className="col-6 col-md-2">
            <div className={`card border-${k.color} text-center py-2`} style={{fontSize:12}}>
              <div style={{fontSize:18}}>{k.icon}</div>
              <div className={`fw-bold text-${k.color}`} style={{fontSize:14}}>{k.value}</div>
              <div className="text-muted" style={{fontSize:10}}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">

        {/* ── Historial de ventas ── */}
        <div className="col-md-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header py-2 fw-bold" style={{fontSize:12}}>🛍️ Historial de compras</div>
            <div className="card-body p-0">
              {perfil.ventas.length === 0
                ? <p className="text-muted p-3 mb-0" style={{fontSize:12}}>Sin compras registradas</p>
                : <table className="table table-sm mb-0" style={{fontSize:11}}>
                    <thead><tr><th>Fecha</th><th>Producto</th><th>Precio</th><th>Estado</th></tr></thead>
                    <tbody>
                      {perfil.ventas.map(v => (
                        <tr key={v.id}>
                          <td>{fmtF(v.fecha)}</td>
                          <td>
                            {v.producto?.foto && <img src={v.producto.foto} style={{width:20,height:20,objectFit:'cover',borderRadius:3,marginRight:4}} onError={e=>e.target.style.display='none'}/>}
                            {v.producto?.referencia}
                          </td>
                          <td className="fw-bold">{fmt(v.precioVenta)}</td>
                          <td>
                            <span className={`badge ${v.estado?.codigo==='CONF'?'bg-success':'bg-secondary'}`} style={{fontSize:10}}>
                              {v.estado?.nombre}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>

        {/* ── Conversaciones ── */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header py-2 fw-bold" style={{fontSize:12}}>💬 Conversaciones</div>
            <div className="card-body p-0">
              {perfil.conversaciones.length === 0
                ? <p className="text-muted p-3 mb-0" style={{fontSize:12}}>Sin conversaciones</p>
                : <table className="table table-sm mb-0" style={{fontSize:11}}>
                    <thead><tr><th>Fecha</th><th>Canal</th><th>Cotizó</th><th>Cerró</th></tr></thead>
                    <tbody>
                      {perfil.conversaciones.map(c => (
                        <tr key={c.id}>
                          <td>{fmtF(c.fecha)}</td>
                          <td>{c.canal?.nombre ?? '—'}</td>
                          <td><span className={`badge ${c.cotizo?'bg-primary':'bg-secondary'}`} style={{fontSize:10}}>{c.cotizo?'Sí':'No'}</span></td>
                          <td><span className={`badge ${c.cerro?'bg-success':'bg-secondary'}`} style={{fontSize:10}}>{c.cerro?'Sí':'No'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>

        {/* ── Cotizaciones ── */}
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header py-2 fw-bold" style={{fontSize:12}}>📋 Cotizaciones</div>
            <div className="card-body p-0">
              {perfil.cotizaciones.length === 0
                ? <p className="text-muted p-3 mb-0" style={{fontSize:12}}>Sin cotizaciones</p>
                : <table className="table table-sm mb-0" style={{fontSize:11}}>
                    <thead><tr><th>N°</th><th>Total</th><th>Estado</th></tr></thead>
                    <tbody>
                      {perfil.cotizaciones.map(c => {
                        const color = {BORRA:'secondary',ENVIA:'primary',ACEPT:'success',RECHA:'danger',CONV:'info'}[c.estado?.codigo]??'secondary';
                        return (
                          <tr key={c.id}>
                            <td style={{fontFamily:'monospace'}}>{c.numero}</td>
                            <td className="fw-bold">{fmt(c.total)}</td>
                            <td><span className={`badge bg-${color}`} style={{fontSize:10}}>{c.estado?.nombre}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

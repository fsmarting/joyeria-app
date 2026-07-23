import { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const [password,    setPassword]    = useState('');
  const [confirmar,   setConfirmar]   = useState('');
  const [verPwd,      setVerPwd]      = useState(false);
  const [verConf,     setVerConf]     = useState(false);
  const [mensaje,     setMensaje]     = useState('');
  const [enviando,    setEnviando]    = useState(false);
  const [exito,       setExito]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    if (password.length < 8)    { setMensaje('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirmar)  { setMensaje('Las contraseñas no coinciden.'); return; }
    if (!token)                  { setMensaje('Enlace inválido. Solicita uno nuevo.'); return; }
    setEnviando(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/auth/reset-password`, { token, password });
      setMensaje(res.data.mensaje);
      setExito(true);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al restablecer la contraseña.');
    } finally { setEnviando(false); }
  };

  const irLogin = () => { window.location.href = '/'; };

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', padding: '0 16px' }}>
      <div className="text-center mb-4">
        <span style={{ fontSize: 32 }}>💎</span>
        <h4 className="fw-bold mt-2" style={{ color: '#B8860B' }}>Río Rayo</h4>
      </div>
      <h5 className="mb-3">Nueva contraseña</h5>
      {!exito ? (
        <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
          <label>
            Nueva contraseña
            <div style={{ position: 'relative' }}>
              <input type={verPwd ? 'text' : 'password'} className="form-control mt-1"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: 40 }} placeholder="Mínimo 8 caracteres" autoFocus/>
              <span onClick={() => setVerPwd(v => !v)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer' }}>
                {verPwd ? '🙈' : '👁️'}
              </span>
            </div>
          </label>
          <label>
            Confirmar contraseña
            <div style={{ position: 'relative' }}>
              <input type={verConf ? 'text' : 'password'} className="form-control mt-1"
                value={confirmar} onChange={e => setConfirmar(e.target.value)}
                style={{ paddingRight: 40 }} placeholder="Repite la contraseña"/>
              <span onClick={() => setVerConf(v => !v)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer' }}>
                {verConf ? '🙈' : '👁️'}
              </span>
            </div>
          </label>
          {mensaje && <p className="text-danger mb-0" style={{ fontSize: 14 }}>{mensaje}</p>}
          <button type="submit" className="btn btn-primary" disabled={enviando || !token}>
            {enviando ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
          {!token && <p className="text-danger" style={{ fontSize:13 }}>Enlace inválido. Solicita uno nuevo desde el login.</p>}
        </form>
      ) : (
        <div>
          <div className="alert alert-success">{mensaje}</div>
          <button className="btn btn-primary w-100 mt-2" onClick={irLogin}>Ir al login</button>
        </div>
      )}
    </div>
  );
}

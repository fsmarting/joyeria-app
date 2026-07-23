import { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function ForgotPassword({ onVolver }) {
  const [correo,   setCorreo]   = useState('');
  const [mensaje,  setMensaje]  = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito,    setExito]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correo) { setMensaje('Ingresa tu correo electrónico.'); return; }
    setEnviando(true); setMensaje('');
    try {
      const res = await axios.post(`${BACKEND_URL}/auth/forgot-password`, { correo });
      setMensaje(res.data.mensaje);
      setExito(true);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al procesar la solicitud.');
    } finally { setEnviando(false); }
  };

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', padding: '0 16px' }}>
      <div className="text-center mb-4">
        <span style={{ fontSize: 32 }}>💎</span>
        <h4 className="fw-bold mt-2" style={{ color: '#B8860B' }}>Río Rayo</h4>
      </div>
      <h5 className="mb-3">Recuperar contraseña</h5>
      {!exito ? (
        <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
          <p className="text-muted" style={{ fontSize: 14 }}>
            Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
          </p>
          <label>
            Correo electrónico
            <input type="email" className="form-control mt-1" value={correo}
              onChange={e => setCorreo(e.target.value)} placeholder="tu@correo.com" autoFocus/>
          </label>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar enlace'}
          </button>
          <button type="button" className="btn btn-link p-0 text-start" style={{ fontSize: 14 }} onClick={onVolver}>
            ← Volver al login
          </button>
        </form>
      ) : (
        <div>
          <div className="alert alert-success">{mensaje}</div>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Revisa tu bandeja de entrada y carpeta de spam. El enlace expira en 30 minutos.
          </p>
          <button className="btn btn-outline-secondary btn-sm" onClick={onVolver}>
            ← Volver al login
          </button>
        </div>
      )}
      {mensaje && !exito && <p className="mt-3 text-danger" style={{ fontSize: 14 }}>{mensaje}</p>}
    </div>
  );
}

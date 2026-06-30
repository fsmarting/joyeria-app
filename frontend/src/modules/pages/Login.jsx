import { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

function Login({ onLogin }) {
  const [codigo,      setCodigo]    = useState('');
  const [empresas,    setEmpresas]  = useState([]);
  const [empresaId,   setEmpresaId] = useState('');
  const [password,    setPassword]  = useState('');
  const [verPassword, setVer]       = useState(false);
  const [mensaje,     setMensaje]   = useState('');
  const [cargando,    setCargando]  = useState(false);

  const cargarEmpresas = async (codigoUsuario) => {
    if (!codigoUsuario) { setEmpresas([]); return; }
    try {
      const res = await axios.get(`${BACKEND_URL}/auth/empresas`, {
        params: { codigo: codigoUsuario },
      });
      setEmpresas(res.data.empresas || []);
      setMensaje('');
    } catch {
      setEmpresas([]);
      setMensaje('No se pudieron cargar las empresas del usuario.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    if (!codigo || !empresaId || !password) {
      setMensaje('Completa usuario, empresa y contraseña.');
      return;
    }
    setCargando(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/auth/login`, {
        codigo,
        empresaId: Number(empresaId),
        password,
      });
      const { token, usuario, empresa, rol } = res.data;
      localStorage.setItem('token',          token);
      localStorage.setItem('usuario',        JSON.stringify(usuario));
      localStorage.setItem('empresa',        JSON.stringify(empresa));
      localStorage.setItem('rol',            JSON.stringify(rol));
      localStorage.setItem('empresaActualId', String(empresa.id));
      localStorage.setItem('rolId',          String(rol?.id || ''));
      if (onLogin) onLogin({ token, usuario, empresa, rol });
    } catch (err) {
      setMensaje(err.response?.data?.error || '❌ Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24 }}>Iniciar sesión</h2>
      <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">

        <label>
          Usuario (código)
          <input
            type="text"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value); cargarEmpresas(e.target.value); }}
            className="form-control mt-1"
            autoComplete="username"
          />
        </label>

        <label>
          Empresa
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="form-control mt-1"
          >
            <option value="">Seleccione...</option>
            {empresas.map((e) => (
              <option key={e.empresaId} value={e.empresaId}>
                {e.empresaCodigo} {e.empresaNombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Contraseña
          <div style={{ position: 'relative' }}>
            <input
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control mt-1"
              style={{ paddingRight: 40 }}
              autoComplete="current-password"
            />
            <span
              onClick={() => setVer((v) => !v)}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor:'pointer', userSelect:'none' }}
            >
              {verPassword ? '🙈' : '👁️'}
            </span>
          </div>
        </label>

        <button type="submit" className="btn btn-primary mt-2" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {mensaje && (
        <p style={{ marginTop:12, color: mensaje.startsWith('✅') ? 'green' : 'red' }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}

export default Login;

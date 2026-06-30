import { useState, useEffect } from 'react';
import Login from './modules/pages/Login.jsx';

function App() {
  const [sesion, setSesion] = useState(null);
  const [verificando, setVerificando] = useState(true);

  // Al cargar, revisar si ya había una sesión guardada
  useEffect(() => {
    const token   = localStorage.getItem('token');
    const usuario = localStorage.getItem('usuario');
    if (token && usuario) {
      setSesion({ token, usuario: JSON.parse(usuario) });
    }
    setVerificando(false);
  }, []);

  const handleLogin = ({ token, usuario }) => {
    setSesion({ token, usuario });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setSesion(null);
  };

  if (verificando) return null;

  if (!sesion) {
    return <Login onLogin={handleLogin} />;
  }

  // ————————————————————————————————————————
  // Pantalla principal (placeholder — aquí irán los módulos)
  // ————————————————————————————————————————
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>JoyeriaApp — Río Rayo</h2>
        <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
      <p style={{ marginTop: 16 }}>
        Bienvenida, <strong>{sesion.usuario.nombre}</strong>.
        Módulos en construcción.
      </p>
    </div>
  );
}

export default App;

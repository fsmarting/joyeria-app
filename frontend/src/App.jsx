import { useState, useRef, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./modules/pages/Login.jsx";
import ForgotPassword from "./modules/pages/ForgotPassword.jsx";
import ResetPassword from "./modules/pages/ResetPassword.jsx";
import Dashboard from "./modules/pages/Dashboard.jsx";
import Venta from "./modules/pages/Venta.jsx";
import Muestrario from "./modules/pages/Muestrario.jsx";
import Conversacion from "./modules/pages/Conversacion.jsx";
import Producto from "./modules/pages/Producto.jsx";
import Piedra from "./modules/pages/Piedra.jsx";
import CompraInsumo from "./modules/pages/CompraInsumo.jsx";
import OrdenProduccion from "./modules/pages/OrdenProduccion.jsx";
import MetaMensual from "./modules/pages/MetaMensual.jsx";
import Cotizacion from "./modules/pages/Cotizacion.jsx";
import {
  Clientas,
  Joyeros,
  Proveedores,
  Socios,
} from "./modules/pages/Tercero.jsx";
import {
  Empresas,
  Usuarios,
  UsuariosEmpresas,
  Catalogos,
  SubCatalogos,
  Grupos,
} from "./modules/pages/Admin.jsx";

// ── Modal sesión expirada ─────────────────────────────────────
function ModalSesionExpirada({ onEntendido }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "32px 28px",
          maxWidth: 380,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Sesión cerrada</h5>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 24 }}>
          No se ha detectado actividad o tu sesión ha expirado.
          <br />
          Por seguridad la sesión se ha cerrado automáticamente.
        </p>
        <button
          className="btn btn-primary w-100"
          style={{ background: "#B8860B", border: "none", fontWeight: 600 }}
          onClick={onEntendido}
        >
          Entendido — Iniciar sesión
        </button>
      </div>
    </div>
  );
}

// ── Dropdown menu ─────────────────────────────────────────────
function DropdownMenu({ label, icon, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  const isActive = items.some((i) => location.pathname === i.to);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`btn btn-link nav-link text-white d-flex align-items-center gap-1 px-2 py-1${isActive ? " fw-bold" : ""}`}
        style={{ fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}
      >
        {icon} {label} <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
            background: "var(--bs-dark)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            minWidth: 180,
            boxShadow: "0 4px 16px rgba(0,0,0,.4)",
            padding: "4px 0",
          }}
        >
          {items.map((item, i) => (
            <Link
              key={i}
              to={item.to}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "7px 16px",
                fontSize: 13,
                color:
                  location.pathname === item.to
                    ? "#ffc107"
                    : "rgba(255,255,255,.85)",
                textDecoration: "none",
                fontWeight: location.pathname === item.to ? 500 : 400,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,.08)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────
function Navbar({ usuario, empresa, onLogout }) {
  return (
    <nav
      className="navbar navbar-dark bg-dark px-3 py-0"
      style={{ minHeight: 48 }}
    >
      <Link
        className="navbar-brand fw-bold text-warning me-3"
        to="/"
        style={{ fontSize: 18 }}
      >
        💎
      </Link>
      <div className="d-flex align-items-center gap-1 flex-wrap flex-grow-1">
        <DropdownMenu
          icon="📊"
          label="Análisis"
          items={[
            { to: "/", label: "Dashboard" },
            { to: "/metas", label: "Metas mensuales" },
          ]}
        />
        <DropdownMenu
          icon="💰"
          label="Comercial"
          items={[
            { to: "/clientas", label: "Clientas" },
            { to: "/chats", label: "Conversaciones" },
            { to: "/muestrarios", label: "Muestrarios" },
            { to: "/ventas", label: "Ventas" },
            { to: "/cotizaciones", label: "Cotizaciones" },
          ]}
        />
        <DropdownMenu
          icon="🏭"
          label="Operaciones"
          items={[
            { to: "/joyeros", label: "Joyeros" },
            { to: "/proveedores", label: "Proveedores" },
            { to: "/insumos", label: "Insumos" },
            { to: "/compras", label: "Compras de insumos" },
            { to: "/ordenes", label: "Órdenes de producción" },
          ]}
        />
        <DropdownMenu
          icon="📦"
          label="Inventario"
          items={[{ to: "/productos", label: "Productos & BOM" }]}
        />
        <DropdownMenu
          icon="⚙️"
          label="Admin"
          items={[
            { to: "/admin/empresas", label: "Empresas" },
            { to: "/admin/usuarios", label: "Usuarios" },
            { to: "/admin/asignaciones", label: "Asignación de usuarios" },
            { to: "/socios", label: "Socias" },
            { to: "/admin/catalogos", label: "Catálogos" },
            { to: "/admin/subcatalogos", label: "SubCatálogos" },
            { to: "/admin/grupos", label: "Grupos" },
          ]}
        />
      </div>
      <div className="d-flex align-items-center gap-2 ms-2">
        <small className="text-white-50" style={{ fontSize: 11 }}>
          {usuario?.nombre} · {empresa?.nombre}
        </small>
        <button
          className="btn btn-outline-light btn-sm py-0"
          style={{ fontSize: 12 }}
          onClick={onLogout}
        >
          Salir
        </button>
      </div>
    </nav>
  );
}

// ── App ───────────────────────────────────────────────────────
function App() {
  const [sesion, setSesion] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const [pantallaAuth, setPantallaAuth] = useState("login");
  const [sesionExpirada, setSesionExpirada] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuario = localStorage.getItem("usuario");
    const empresa = localStorage.getItem("empresa");
    const rol = localStorage.getItem("rol");
    if (token && usuario)
      setSesion({
        token,
        usuario: JSON.parse(usuario),
        empresa: empresa ? JSON.parse(empresa) : null,
        rol: rol ? JSON.parse(rol) : null,
      });
    setVerificando(false);
  }, []);

  // ── Escuchar evento SESSION_EXPIRED del apolloClient ────────
  useEffect(() => {
    const handler = () => {
      setSesionExpirada(true);
    };
    window.addEventListener("SESSION_EXPIRED", handler);
    return () => window.removeEventListener("SESSION_EXPIRED", handler);
  }, []);

  const handleLogin = ({ token, usuario, empresa, rol }) =>
    setSesion({ token, usuario, empresa, rol });

  const handleLogout = () => {
    localStorage.clear();
    setSesion(null);
  };

  const handleSesionExpiradaOk = () => {
    setSesionExpirada(false);
    localStorage.clear();
    setSesion(null);
    setPantallaAuth("login");
  };

  if (verificando) return null;

  // ── Ruta /reset-password ─────────────────────────────────────
  if (window.location.pathname === "/reset-password") {
    return (
      <>
        <ResetPassword />
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    );
  }

  // ── Sin sesión ───────────────────────────────────────────────
  if (!sesion) {
    if (pantallaAuth === "forgot") {
      return (
        <>
          <ForgotPassword onVolver={() => setPantallaAuth("login")} />
          <ToastContainer position="top-right" autoClose={3000} />
        </>
      );
    }
    return (
      <>
        <Login
          onLogin={handleLogin}
          onForgotPassword={() => setPantallaAuth("forgot")}
        />
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    );
  }

  // ── Con sesión ───────────────────────────────────────────────
  return (
    <>
      {/* Modal sesión expirada — aparece encima de todo */}
      {sesionExpirada && (
        <ModalSesionExpirada onEntendido={handleSesionExpiradaOk} />
      )}

      <Navbar
        usuario={sesion.usuario}
        empresa={sesion.empresa}
        onLogout={handleLogout}
      />
      <div className="container-fluid p-3">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/metas" element={<MetaMensual />} />
          <Route path="/clientas" element={<Clientas />} />
          <Route path="/chats" element={<Conversacion />} />
          <Route path="/muestrarios" element={<Muestrario />} />
          <Route path="/ventas" element={<Venta />} />
          <Route path="/cotizaciones" element={<Cotizacion />} />
          <Route path="/joyeros" element={<Joyeros />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/insumos" element={<Piedra />} />
          <Route path="/compras" element={<CompraInsumo />} />
          <Route path="/ordenes" element={<OrdenProduccion />} />
          <Route path="/productos" element={<Producto />} />
          <Route path="/socios" element={<Socios />} />
          <Route path="/admin/empresas" element={<Empresas />} />
          <Route path="/admin/usuarios" element={<Usuarios />} />
          <Route path="/admin/asignaciones" element={<UsuariosEmpresas />} />
          <Route path="/admin/catalogos" element={<Catalogos />} />
          <Route path="/admin/subcatalogos" element={<SubCatalogos />} />
          <Route path="/admin/grupos" element={<Grupos />} />
        </Routes>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;

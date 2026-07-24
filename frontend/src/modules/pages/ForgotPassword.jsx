import { useState } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Límite local de intentos (espejo del backend)
const MAX_INTENTOS_LOCAL = 3;
const ESPERA_MINUTOS = 60;

export default function ForgotPassword({ onVolver }) {
  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [bloqueado, setBloqueado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correo) {
      setMensaje("Ingresa tu correo electrónico.");
      return;
    }

    // Bloqueo local antes de llamar al backend
    if (bloqueado) {
      setMensaje(
        `Has alcanzado el límite de intentos. Espera ${ESPERA_MINUTOS} minutos antes de intentarlo de nuevo.`,
      );
      return;
    }

    setEnviando(true);
    setMensaje("");
    try {
      const res = await axios.post(`${BACKEND_URL}/auth/forgot-password`, {
        correo,
      });

      const nuevosIntentos = intentos + 1;
      setIntentos(nuevosIntentos);

      // Si alcanzó el máximo → bloquear y mostrar aviso
      if (nuevosIntentos >= MAX_INTENTOS_LOCAL) {
        setBloqueado(true);
        setMensaje(
          `Has alcanzado el límite de ${MAX_INTENTOS_LOCAL} intentos. Por seguridad debes esperar ${ESPERA_MINUTOS} minutos antes de solicitar otro enlace.`,
        );
        // Desbloquear automáticamente después de la ventana
        setTimeout(
          () => {
            setBloqueado(false);
            setIntentos(0);
            setMensaje("");
          },
          ESPERA_MINUTOS * 60 * 1000,
        );
        return;
      }

      setMensaje(res.data.mensaje);
      setExito(true);
    } catch (err) {
      setMensaje(
        err.response?.data?.error || "Error al procesar la solicitud.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "60px auto", padding: "0 16px" }}>
      <div className="text-center mb-4">
        <span style={{ fontSize: 32 }}>💎</span>
        <h4 className="fw-bold mt-2" style={{ color: "#B8860B" }}>
          Río Rayo
        </h4>
      </div>
      <h5 className="mb-3">Recuperar contraseña</h5>

      {/* Aviso de bloqueo */}
      {bloqueado && (
        <div className="alert alert-warning" style={{ fontSize: 14 }}>
          🔒 <strong>Demasiados intentos.</strong>
          <br />
          Por seguridad debes esperar <strong>
            {ESPERA_MINUTOS} minutos
          </strong>{" "}
          antes de solicitar otro enlace de recuperación.
        </div>
      )}

      {!exito && !bloqueado ? (
        <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
          <p className="text-muted" style={{ fontSize: 14 }}>
            Ingresa el correo asociado a tu cuenta y te enviaremos un enlace
            para restablecer tu contraseña.
          </p>
          {intentos > 0 && (
            <p className="text-muted mb-0" style={{ fontSize: 12 }}>
              Intento {intentos} de {MAX_INTENTOS_LOCAL}
            </p>
          )}
          <label>
            Correo electrónico
            <input
              type="email"
              className="form-control mt-1"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              autoFocus
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar enlace"}
          </button>
          <button
            type="button"
            className="btn btn-link p-0 text-start"
            style={{ fontSize: 14 }}
            onClick={onVolver}
          >
            ← Volver al login
          </button>
          {mensaje && (
            <p className="mt-1 text-danger mb-0" style={{ fontSize: 14 }}>
              {mensaje}
            </p>
          )}
        </form>
      ) : exito ? (
        <div>
          <div className="alert alert-success">{mensaje}</div>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Revisa tu bandeja de entrada y carpeta de spam. El enlace expira en
            30 minutos.
          </p>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={onVolver}
          >
            ← Volver al login
          </button>
        </div>
      ) : null}

      {bloqueado && (
        <button
          className="btn btn-outline-secondary btn-sm mt-3"
          onClick={onVolver}
        >
          ← Volver al login
        </button>
      )}
    </div>
  );
}

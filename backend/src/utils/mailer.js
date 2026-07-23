const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FRONTEND_URL   = process.env.FRONTEND_URL || 'https://observant-success-production-90d3.up.railway.app';
const FROM_EMAIL     = 'onboarding@resend.dev';

async function enviarCorreo({ to, subject, html }) {
  if (!RESEND_API_KEY) { console.warn('⚠ RESEND_API_KEY no configurada'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) { const err = await res.text(); console.error('Error Resend:', err); throw new Error('No se pudo enviar el correo'); }
}

export async function enviarCorreoRecuperacion(correo, nombre, tokenPlano) {
  const link = `${FRONTEND_URL}/reset-password?token=${tokenPlano}`;
  await enviarCorreo({
    to: correo, subject: '💎 Río Rayo — Recuperación de contraseña',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#B8860B">💎 Río Rayo</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#B8860B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Restablecer contraseña</a>
      </p>
      <p style="color:#888;font-size:13px">Este enlace expira en 30 minutos.<br>Si no solicitaste este cambio, ignora este mensaje.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#888;font-size:12px">Río Rayo · Joyería artesanal · Medellín</p>
    </div>`,
  });
}

export async function enviarCorreoConfirmacionCambio(correo, nombre) {
  await enviarCorreo({
    to: correo, subject: '💎 Río Rayo — Contraseña actualizada',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#B8860B">💎 Río Rayo</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu contraseña fue actualizada exitosamente.</p>
      <p>Si no realizaste este cambio, contáctanos de inmediato.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#888;font-size:12px">Río Rayo · Joyería artesanal · Medellín</p>
    </div>`,
  });
}

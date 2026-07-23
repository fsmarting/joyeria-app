import { Router }   from 'express';
import bcrypt       from 'bcryptjs';
import jwt          from 'jsonwebtoken';
import crypto       from 'crypto';
import { prisma }   from '../helpers/dbActions.js';
import { enviarCorreoRecuperacion, enviarCorreoConfirmacionCambio } from '../utils/mailer.js';

const router = Router();

// Anti-spam en memoria
const intentosForgot  = new Map();
const MAX_INTENTOS    = 3;
const VENTANA_MS      = 60 * 60 * 1000; // 1 hora

router.get('/ping', (req, res) => res.json({ ok: true }));

// ── GET /auth/empresas ─────────────────────────────────────────
router.get('/empresas', async (req, res) => {
  try {
    const { codigo } = req.query;
    if (!codigo) return res.status(400).json({ error: 'Código requerido' });
    const usuario = await prisma.usuario.findFirst({
      where: { codigo: codigo.toUpperCase(), deletedAt: null },
      include: { empresasAsignadas: { where: { deletedAt: null }, include: { empresa: true } } },
    });
    if (!usuario) return res.json({ empresas: [] });
    const empresas = usuario.empresasAsignadas.map(ue => ({
      empresaId:    ue.empresaId,
      empresaCodigo:ue.empresa.codigo,
      empresaNombre:ue.empresa.nombre,
    }));
    res.json({ empresas });
  } catch (e) { console.error('Error /auth/empresas:', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /auth/login ───────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { codigo, empresaId, password } = req.body;
    if (!codigo || !empresaId || !password)
      return res.status(400).json({ error: 'Código, empresa y contraseña son obligatorios' });

    const usuario = await prisma.usuario.findFirst({
      where: { codigo: codigo.toUpperCase(), deletedAt: null },
      include: { empresasAsignadas: { where: { empresaId: Number(empresaId), deletedAt: null }, include: { empresa: true, rol: true } } },
    });

    if (!usuario || usuario.empresasAsignadas.length === 0)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ue    = usuario.empresasAsignadas[0];
    const token = jwt.sign(
      { id: usuario.id, codigo: usuario.codigo, empresaId: ue.empresaId, rolId: ue.rolId,
        comisionEfectivo: Number(ue.comisionEfectivo), comisionTarjeta: Number(ue.comisionTarjeta) },
      process.env.JWT_SECRET || 'dev_secret_cambia_esto',
      { expiresIn: '8h' },
    );

    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimo_login: new Date() } }).catch(() => {});

    res.json({
      token,
      usuario: { id: usuario.id, codigo: usuario.codigo, nombre: usuario.nombre },
      empresa: { id: ue.empresaId, codigo: ue.empresa.codigo, nombre: ue.empresa.nombre },
      rol: ue.rol ? { id: ue.rolId, codigo: ue.rol.codigo, nombre: ue.rol.nombre } : null,
    });
  } catch (e) { console.error('Error /auth/login:', e); res.status(500).json({ error: 'Error interno al iniciar sesión' }); }
});

// ── POST /auth/forgot-password ────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  // Siempre responde el mismo mensaje (anti-enumeración)
  const MSG_GENERICO = 'Si el correo está registrado, recibirás un enlace en los próximos minutos.';
  try {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ error: 'Correo requerido' });

    // Anti-spam
    const ahora  = Date.now();
    const key    = correo.toLowerCase();
    const estado = intentosForgot.get(key) || { intentos: 0, desde: ahora };
    if (ahora - estado.desde > VENTANA_MS) { estado.intentos = 0; estado.desde = ahora; }
    if (estado.intentos >= MAX_INTENTOS) return res.json({ mensaje: MSG_GENERICO });
    estado.intentos++;
    intentosForgot.set(key, estado);

    const usuario = await prisma.usuario.findUnique({ where: { correo: correo.toLowerCase() } });
    if (!usuario) return res.json({ mensaje: MSG_GENERICO });

    // Generar token
    const tokenPlano  = crypto.randomBytes(32).toString('hex');
    const tokenHashed = crypto.createHash('sha256').update(tokenPlano).digest('hex');
    const expira      = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await prisma.usuario.update({
      where: { id: usuario.id },
      data:  { resetPasswordToken: tokenHashed, resetPasswordExpires: expira },
    });

    await enviarCorreoRecuperacion(correo, usuario.nombre, tokenPlano);
    res.json({ mensaje: MSG_GENERICO });
  } catch (e) { console.error('Error /auth/forgot-password:', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /auth/reset-password ─────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    if (password.length < 8)  return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const tokenHashed = crypto.createHash('sha256').update(token).digest('hex');
    const usuario = await prisma.usuario.findFirst({
      where: { resetPasswordToken: tokenHashed, resetPasswordExpires: { gt: new Date() } },
    });

    if (!usuario) return res.status(400).json({ error: 'El enlace es inválido o ha expirado. Solicita uno nuevo.' });

    const passwordHashed = await bcrypt.hash(password, 10);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data:  { password: passwordHashed, resetPasswordToken: null, resetPasswordExpires: null },
    });

    if (usuario.correo) await enviarCorreoConfirmacionCambio(usuario.correo, usuario.nombre).catch(() => {});
    res.json({ mensaje: '✅ Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (e) { console.error('Error /auth/reset-password:', e); res.status(500).json({ error: 'Error interno' }); }
});

export default router;

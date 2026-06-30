// backend/src/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../helpers/dbActions.js';

const router = Router();

router.get('/ping', (req, res) => res.json({ ok: true }));

// Login: usuario.codigo + password (mismo patrón que FinanzasApp)
router.post('/login', async (req, res) => {
  try {
    const { codigo, password } = req.body;

    if (!codigo || !password) {
      return res.status(400).json({ error: 'Código y contraseña son obligatorios' });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { codigo, deletedAt: null },
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, codigo: usuario.codigo, empresaId: usuario.empresaId },
      process.env.JWT_SECRET || 'dev_secret_cambia_esto',
      { expiresIn: '8h' },
    );

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimo_login: new Date() },
    });

    res.json({
      token,
      usuario: { id: usuario.id, codigo: usuario.codigo, nombre: usuario.nombre },
    });
  } catch (error) {
    console.error('Error en /auth/login:', error);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

// /forgot-password y /reset-password se agregan después, reutilizando
// el patrón ya probado en FinanzasApp (tokens SHA-256, expiración 30 min,
// envío de correo vía Resend).

export default router;

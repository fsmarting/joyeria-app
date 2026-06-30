import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../helpers/dbActions.js';

const router = Router();

router.get('/ping', (req, res) => res.json({ ok: true }));

// ----------------------------------------------------------------
// GET /auth/empresas?codigo=ADMIN
// Devuelve las empresas del usuario para el selector de login.
// Mismo patrón que FinanzasApp.
// ----------------------------------------------------------------
router.get('/empresas', async (req, res) => {
  try {
    const { codigo } = req.query;
    if (!codigo) return res.status(400).json({ error: 'Código requerido' });

    const usuario = await prisma.usuario.findFirst({
      where: { codigo: codigo.toUpperCase(), deletedAt: null },
      include: {
        empresasAsignadas: {
          where: { deletedAt: null },
          include: { empresa: true },
        },
      },
    });

    if (!usuario) return res.json({ empresas: [] });

    const empresas = usuario.empresasAsignadas.map((ue) => ({
      empresaId:     ue.empresaId,
      empresaCodigo: ue.empresa.codigo,
      empresaNombre: ue.empresa.nombre,
    }));

    res.json({ empresas });
  } catch (error) {
    console.error('Error en /auth/empresas:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ----------------------------------------------------------------
// POST /auth/login
// Recibe codigo + empresaId + password.
// El token lleva empresaId, rolId y las comisiones del usuario
// para esa empresa — viajan en el contexto de Apollo.
// ----------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { codigo, empresaId, password } = req.body;

    if (!codigo || !empresaId || !password) {
      return res.status(400).json({
        error: 'Código, empresa y contraseña son obligatorios',
      });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { codigo: codigo.toUpperCase(), deletedAt: null },
      include: {
        empresasAsignadas: {
          where:   { empresaId: Number(empresaId), deletedAt: null },
          include: { empresa: true, rol: true },
        },
      },
    });

    if (!usuario || usuario.empresasAsignadas.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const ue = usuario.empresasAsignadas[0];

    const token = jwt.sign(
      {
        id:               usuario.id,
        codigo:           usuario.codigo,
        empresaId:        ue.empresaId,
        rolId:            ue.rolId,
        comisionEfectivo: Number(ue.comisionEfectivo),
        comisionTarjeta:  Number(ue.comisionTarjeta),
      },
      process.env.JWT_SECRET || 'dev_secret_cambia_esto',
      { expiresIn: '8h' },
    );

    await prisma.usuario.update({
      where: { id: usuario.id },
      data:  { ultimo_login: new Date() },
    });

    res.json({
      token,
      usuario: { id: usuario.id, codigo: usuario.codigo, nombre: usuario.nombre },
      empresa: { id: ue.empresaId, codigo: ue.empresa.codigo, nombre: ue.empresa.nombre },
      rol:     ue.rol ? { id: ue.rolId, nombre: ue.rol.nombre } : null,
    });
  } catch (error) {
    console.error('Error en /auth/login:', error);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

export default router;

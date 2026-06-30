import { Router } from 'express';

const router = Router();

router.get('/ping', (req, res) => res.json({ ok: true }));

// /forgot-password y /reset-password se agregan reutilizando
// el patron ya probado en FinanzasApp (tokens SHA-256, expiracion 30 min).

export default router;

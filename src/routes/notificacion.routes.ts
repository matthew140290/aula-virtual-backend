// src/routes/notificacion.routes.ts
import { Router } from 'express';
import * as notificacionController from '../controllers/notificacion.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de este módulo requieren que el usuario esté autenticado
router.use(protect);

// GET /api/notificaciones?page=1&limit=5
router.get('/', notificacionController.getMisNotificaciones);

// POST /api/notificaciones/marcar-leidas
router.post('/marcar-leidas', notificacionController.marcarNotificacionesLeidas);

// DELETE /api/notificaciones
router.delete('/', notificacionController.deleteNotificaciones);

export default router;
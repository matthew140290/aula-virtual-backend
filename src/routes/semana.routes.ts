// src/routes/semana.routes.ts
import { Router } from 'express';
import * as semanaController from '../controllers/semana.controller';
import { protect, authorize } from '../middleware/auth.middleware'; // Importamos el guardián

const router = Router();

// Todas las rutas de semanas requieren autenticación
router.use(protect);

// GET /api/semanas?codigoAsignatura=X&numeroPeriodo=Y
router.get('/', authorize(['Docente', 'Estudiante', 'Director de grupo']), semanaController.getWeeks);

// POST /api/semanas
router.post('/', authorize(['Docente', 'Director de grupo']),semanaController.addWeeks);

// PATCH /api/semanas/:id
router.patch('/:id', semanaController.updateWeek);

// DELETE /api/semanas/:id
router.delete('/:id', semanaController.deleteWeek);

router.post('/:id/clone', semanaController.cloneWeek);

export default router;
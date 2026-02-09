// src/routes/apartado.routes.ts
import { Router } from 'express';
import * as apartadoController from '../controllers/apartado.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de apartados requieren autenticación
router.use(protect);

// GET /api/apartados?codigoAsignatura=X
router.get('/', apartadoController.getApartados);

router.post('/', apartadoController.createApartado); 

// PATCH /api/apartados/:id
router.patch('/:id', apartadoController.updateApartado);

// DELETE /api/apartados/:id
router.delete('/:id', apartadoController.deleteApartado);

// POST /api/apartados/:id/toggle-pin
router.post('/:id/toggle-pin', apartadoController.togglePin);

// POST /api/apartados/:id/clone
router.post('/:id/clone', apartadoController.cloneApartado);

export default router;
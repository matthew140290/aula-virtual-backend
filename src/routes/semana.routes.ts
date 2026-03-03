// src/routes/semana.routes.ts
import { Router } from 'express';
import * as semanaController from '../controllers/semana.controller';
import { protect, authorize } from '../middleware/auth.middleware'; // Importamos el guardián
import { ROLES } from '../constants/roles';

const router = Router();

// Todas las rutas de semanas requieren autenticación
router.use(protect);

// GET /api/semanas?codigoAsignatura=X&numeroPeriodo=Y
router.get(
    '/', 
    authorize([
        ROLES.DOCENTE, 
        ROLES.ESTUDIANTE, 
        ROLES.DIRECTOR_GRUPO,
        ROLES.COORDINADOR,
        ROLES.COORDINADOR_GENERAL,
        ROLES.ADMINISTRADOR,
        ROLES.MASTER
    ]), 
    semanaController.getWeeks
);

router.post(
    '/', 
    authorize([ROLES.DOCENTE, ROLES.DIRECTOR_GRUPO]),
    semanaController.addWeeks
);

router.patch(
    '/:id', 
    authorize([ROLES.DOCENTE, ROLES.DIRECTOR_GRUPO]), 
    semanaController.updateWeek
);

router.delete(
    '/:id', 
    authorize([ROLES.DOCENTE, ROLES.DIRECTOR_GRUPO]), 
    semanaController.deleteWeek
);

router.post(
    '/:id/clone', 
    authorize([ROLES.DOCENTE, ROLES.DIRECTOR_GRUPO]), 
    semanaController.cloneWeek
);

export default router;
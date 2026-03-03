// src/routes/periodo.routes.ts
import { Router } from 'express';
import * as periodoController from '../controllers/periodo.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { ROLES } from '../constants/roles';
import { validateSchema } from '../middleware/validate.middleware';
import { configPeriodoSchema, excepcionPeriodoSchema } from '../schemas/periodo.schema';

const router = Router();

router.use(protect);

// GET /api/periodos
router.get('/', periodoController.getAllPeriods);

router.post(
    '/:numeroPeriodo/configurar', 
    authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]), 
    validateSchema(configPeriodoSchema),
    periodoController.configurarPeriodo
);

router.post(
    '/:numeroPeriodo/excepcion', 
    authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]), 
    validateSchema(excepcionPeriodoSchema),
    periodoController.otorgarExcepcion
);

export default router;
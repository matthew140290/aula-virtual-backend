// src/routes/auditoria.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import * as auditoriaController from '../controllers/auditoria.controller';
import { ROLES } from '../constants/roles';

const router = Router();

// Protegido solo para perfiles administrativos
router.use(protect);
router.use(authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]));

router.get('/docentes', auditoriaController.getDocentesStats);

export default router;
// src/routes/periodo.routes.ts
import { Router } from 'express';
import * as periodoController from '../controllers/periodo.controller';
import { authorize, protect } from '../middleware/auth.middleware';

const router = Router();

// GET /api/periodos
router.get('/', protect, authorize(['Docente', 'Estudiante', 'Director de grupo']), periodoController.getAllPeriods);

export default router;
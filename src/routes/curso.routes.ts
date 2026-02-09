// src/routes/curso.routes.ts
import { Router } from 'express';
import * as cursoController from '../controllers/curso.controller';
import { authorize, protect } from '../middleware/auth.middleware'; 

const router = Router();


router.get('/mis-cursos', protect, authorize(['Docente', 'Estudiante', 'Director de grupo']), cursoController.getMisCursos);

export default router;
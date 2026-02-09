// src/routes/estudiante.routes.ts
import { Router } from 'express';
import * as estudianteController from '../controllers/estudiante.controller';
import { authorize, protect } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de estudiantes requieren autenticación
router.use(protect);

// GET /api/estudiantes/por-curso/:codigoCurso
router.get('/por-asignatura/:codigoAsignatura', estudianteController.getEstudiantesPorAsignatura);

router.get('/mis-asignaturas', authorize(['Estudiante']), estudianteController.getMisAsignaturas);
router.get('/mis-eventos', authorize(['Estudiante']), estudianteController.getMisEventosProximos);
router.get('/recursos/:recursoId/vista', authorize(['Estudiante']), estudianteController.getRecursoVista);
router.post(
    '/eventos/ocultar', 
    protect, 
    authorize(['Estudiante']), 
    estudianteController.ocultarEvento
);

export default router;
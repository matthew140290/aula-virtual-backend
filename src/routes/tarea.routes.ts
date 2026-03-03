//src/routes/tarea.routes
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { verificarPeriodoPorRecurso } from '../middleware/periodo.middleware';
import * as tareaController from '../controllers/tarea.controller';

const router = Router();

// Todas las rutas de tareas requieren autenticación
router.use(protect);

router.post(
    '/:id/entregas',
    authorize(['Estudiante', 'Docente', 'Director de grupo']),
    verificarPeriodoPorRecurso(),
    tareaController.crearEntrega
);


// Solo accesible para perfiles de docentes.
router.get(
    '/:id/entregas', 
    authorize(['Docente', 'Director de grupo', 'Administrador']), 
    tareaController.getEntregasPorTarea
);

router.patch(
    '/:tareaId/entregas/:matriculaNo',
    authorize(['Docente', 'Director de grupo', 'Administrador', 'Master']),
    tareaController.guardarCalificacion
);

router.get(
    '/entregas/:id/archivo',
    authorize(['Docente', 'Estudiante', 'Administrador', 'Director de grupo']),
    tareaController.descargarEntrega
);

export default router;
// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import * as dashboardController from '../controllers/dashboard.controller';
import * as expedienteController from '../controllers/expedienteEstudiantil.controller';
import { ROLES } from '../constants/roles';

const router = Router();

router.use(protect);
router.use(authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]));

router.get('/resumen', dashboardController.getResumenGeneral);
router.get('/docentes-sin-calificar', dashboardController.getDocentesSinCalificar);
router.get('/estudiantes-sin-conexion', dashboardController.getEstudiantesSinConexion);
router.get('/actividad-reciente', dashboardController.getActividadReciente);
router.get('/periodos-resumen', dashboardController.getPeriodosResumen);

// Expediente Estudiantil 360°
router.get('/estudiantes/buscar', expedienteController.buscarEstudiantes);
router.get('/estudiantes/:matriculaNo/expediente', expedienteController.getExpediente);
router.get('/estudiantes/:matriculaNo/actividad', expedienteController.getActividad);

export default router;

// src/routes/prueba.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { verificarPeriodoPorPreguntaPrueba, verificarPeriodoPorPrueba } from '../middleware/periodo.middleware';
import * as pruebaController from '../controllers/prueba.controller';
import { ROLES } from '../constants/roles';

const router = Router();

const editorRoles = [
  ROLES.DOCENTE,
  ROLES.DIRECTOR_GRUPO,
  ROLES.COORDINADOR,
  ROLES.COORDINADOR_GENERAL,
  ROLES.ADMINISTRADOR,
  ROLES.MASTER,
];

router.use(protect); // Todas las rutas de pruebas requieren autenticación

router.get('/publicacion/:recursoId', pruebaController.getPublicacionPorRecursoId);
router.post('/publicaciones', pruebaController.getPublicacionesByRecursoIds);

router.get('/banco-preguntas', authorize(editorRoles), pruebaController.getBancoPreguntas);
router.post('/banco-preguntas', authorize(editorRoles), pruebaController.addPreguntaToBanco);

// Rutas por pruebaId
router.get('/:pruebaId', pruebaController.getPruebaDetalles);
router.put('/:pruebaId/competencia', authorize(editorRoles), verificarPeriodoPorPrueba(), pruebaController.updatePruebaCompetencia);
router.put('/:pruebaId/publicar', authorize(editorRoles), verificarPeriodoPorPrueba(), pruebaController.setPruebaPublicado);
router.post('/:pruebaId/iniciar', authorize([ROLES.ESTUDIANTE]), pruebaController.iniciarPrueba);
router.post('/:pruebaId/entregar', authorize([ROLES.ESTUDIANTE]), pruebaController.entregarPrueba);
router.post('/:pruebaId/abandonar', authorize([ROLES.ESTUDIANTE]), pruebaController.abandonarPrueba);
router.post('/:pruebaId/heartbeat', authorize([ROLES.ESTUDIANTE]), pruebaController.heartbeatPrueba);

router.get('/:pruebaId/estudiantes', authorize(editorRoles), pruebaController.getEstudiantesParaPrueba);
router.get('/:pruebaId/simulacros', authorize(editorRoles), pruebaController.getResultadosSimulacro);
router.get('/:pruebaId/resultados', authorize(editorRoles), pruebaController.getResultadosReales);
router.post('/:pruebaId/simulacros', authorize(editorRoles), verificarPeriodoPorPrueba(), pruebaController.crearSimulacro);

// Rutas por IDs propios
router.post('/:pruebaId/preguntas', authorize(editorRoles), verificarPeriodoPorPrueba(), pruebaController.addPregunta);
router.put('/preguntas/:preguntaId', authorize(editorRoles), verificarPeriodoPorPreguntaPrueba(), pruebaController.updatePregunta);
router.delete('/preguntas/:preguntaId', authorize(editorRoles), verificarPeriodoPorPreguntaPrueba(), pruebaController.deletePregunta);

router.delete('/simulacros/:simulacroId', authorize(editorRoles), pruebaController.eliminarSimulacro);
router.put('/resultados/:resultadoId/calificar', authorize(editorRoles), pruebaController.guardarCalificacion);

router.put('/:pruebaId/finalizada', authorize(editorRoles), verificarPeriodoPorPrueba(), pruebaController.setPruebaFinalizada);
router.put('/:pruebaId/config', authorize(editorRoles), verificarPeriodoPorPrueba(), pruebaController.updateConfig);
// routes/pruebas.routes.ts





export default router;

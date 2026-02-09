// src/routes/prueba.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import * as pruebaController from '../controllers/prueba.controller';

const router = Router();

router.use(protect); // Todas las rutas de pruebas requieren autenticación

router.get('/publicacion/:recursoId', pruebaController.getPublicacionPorRecursoId);
router.post('/publicaciones', pruebaController.getPublicacionesByRecursoIds);

router.get('/banco-preguntas', pruebaController.getBancoPreguntas); 
router.post('/banco-preguntas', pruebaController.addPreguntaToBanco); 

// Rutas por pruebaId
router.get('/:pruebaId', pruebaController.getPruebaDetalles);
router.put('/:pruebaId/competencia', pruebaController.updatePruebaCompetencia);
router.put('/:pruebaId/publicar', pruebaController.setPruebaPublicado);
router.post('/:pruebaId/iniciar', pruebaController.iniciarPrueba);
router.post('/:pruebaId/entregar', pruebaController.entregarPrueba);

router.get('/:pruebaId/estudiantes', pruebaController.getEstudiantesParaPrueba);
router.get('/:pruebaId/simulacros', pruebaController.getResultadosSimulacro);
router.get('/:pruebaId/resultados', pruebaController.getResultadosReales);
router.post('/:pruebaId/simulacros', pruebaController.crearSimulacro);

// Rutas por IDs propios
router.post('/:pruebaId/preguntas', pruebaController.addPregunta);
router.put('/preguntas/:preguntaId', pruebaController.updatePregunta);
router.delete('/preguntas/:preguntaId', pruebaController.deletePregunta);

router.delete('/simulacros/:simulacroId', pruebaController.eliminarSimulacro);
router.put('/resultados/:resultadoId/calificar', pruebaController.guardarCalificacion);

router.put('/:pruebaId/finalizada', pruebaController.setPruebaFinalizada);
router.put('/:pruebaId/config', pruebaController.updateConfig);
// routes/pruebas.routes.ts





export default router;
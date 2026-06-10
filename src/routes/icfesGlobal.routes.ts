import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { validateSchema } from '../middleware/validate.middleware';
import { ROLES } from '../constants/roles';
import * as icfesGlobalController from '../controllers/icfesGlobal.controller';
import {
  createExamenGlobalSchema,
  entregarIntentoGlobalSchema,
  generarPreguntasIaSchema,
  updatePreguntaGlobalSchema,
} from '../schemas/icfesGlobal.schema';

const router = Router();

router.use(protect);

const allowedEditors = [
  ROLES.DOCENTE,
  ROLES.COORDINADOR,
  ROLES.COORDINADOR_GENERAL,
  ROLES.ADMINISTRADOR,
  ROLES.MASTER,
];

const allowedCoordinacion = [
  ROLES.COORDINADOR,
  ROLES.COORDINADOR_GENERAL,
  ROLES.ADMINISTRADOR,
  ROLES.MASTER,
];

router.get('/publicados', icfesGlobalController.listExamenesPublicados);
router.get('/publicados/:examenId', icfesGlobalController.getExamenPublicadoDetalle);
router.post('/publicados/:examenId/iniciar', authorize([ROLES.ESTUDIANTE]), icfesGlobalController.iniciarIntentoGlobal);
router.post(
  '/intentos/:intentoId/entregar',
  authorize([ROLES.ESTUDIANTE]),
  validateSchema(entregarIntentoGlobalSchema),
  icfesGlobalController.entregarIntentoGlobal
);
router.get('/intentos/:intentoId/revision', authorize([ROLES.ESTUDIANTE]), icfesGlobalController.getRevisionIntentoGlobal);
router.post(
  '/intentos/:intentoId/preguntas/:preguntaId/explicacion-ia',
  authorize([ROLES.ESTUDIANTE]),
  icfesGlobalController.getExplicacionErrorIa
);
router.get('/estudiante/mis-intentos', authorize([ROLES.ESTUDIANTE]), icfesGlobalController.getMisIntentos);
router.get('/estudiante/diagnostico', authorize([ROLES.ESTUDIANTE]), icfesGlobalController.getDiagnosticoCompetencias);
router.get('/coordinacion/resumen', authorize(allowedCoordinacion), icfesGlobalController.getResumenCoordinacion);
router.get('/coordinacion/filtros', authorize(allowedCoordinacion), icfesGlobalController.getOpcionesFiltroCoordinacion);

router.get('/examenes', authorize(allowedEditors), icfesGlobalController.listExamenesGlobales);
router.get('/examenes/:examenId', authorize(allowedEditors), icfesGlobalController.getExamenGlobalDetalle);

router.post(
  '/examenes',
  authorize(allowedEditors),
  validateSchema(createExamenGlobalSchema),
  icfesGlobalController.createExamenGlobal
);

router.post(
  '/examenes/:examenId/generar-ia',
  authorize(allowedEditors),
  validateSchema(generarPreguntasIaSchema),
  icfesGlobalController.generarPreguntasIa
);

router.put(
  '/preguntas/:preguntaId',
  authorize(allowedEditors),
  validateSchema(updatePreguntaGlobalSchema),
  icfesGlobalController.updatePreguntaGlobal
);

router.delete('/examenes/:examenId', authorize(allowedEditors), icfesGlobalController.deleteExamenGlobal);
router.delete('/preguntas/:preguntaId', authorize(allowedEditors), icfesGlobalController.deletePreguntaGlobal);

router.post('/examenes/:examenId/publicar', authorize(allowedEditors), icfesGlobalController.publicarExamenGlobal);
router.post('/examenes/:examenId/despublicar', authorize(allowedEditors), icfesGlobalController.despublicarExamenGlobal);

export default router;

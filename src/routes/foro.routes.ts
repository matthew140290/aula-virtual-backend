// src/routes/foro.routes.ts
import { Router } from 'express';
import multer from 'multer'; // 💡 1. Importamos multer
import * as foroController from '../controllers/foro.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { verificarPeriodoPorRecurso, verificarPeriodoPorEntradaForo } from '../middleware/periodo.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // 💡 2. Configuramos multer

// Todas las rutas de foros requieren autenticación
router.use(protect);

// GET /api/foros/:recursoId/entradas
router.get('/:recursoId/entradas', foroController.getEntradas);

// POST /api/foros/:recursoId/entradas
router.post('/:recursoId/entradas', upload.single('adjunto'), verificarPeriodoPorRecurso(), foroController.crearEntrada);

// PUT y DELETE para entradas individuales
router.put('/entradas/:entradaId', upload.single('adjunto'), verificarPeriodoPorEntradaForo(), foroController.actualizarUnaEntrada);
router.delete('/entradas/:entradaId', verificarPeriodoPorEntradaForo(), foroController.eliminarUnaEntrada);


router.get('/entradas/:entradaId/adjunto', foroController.getAdjuntoEntrada);

// Rutas de calificación
router.get('/:recursoId/calificaciones', authorize(['Docente', 'Director de grupo']), foroController.obtenerCalificaciones);
router.post('/:recursoId/calificaciones', authorize(['Docente', 'Director de grupo']), foroController.calificarParticipacion);

export default router;
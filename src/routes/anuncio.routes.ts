// src/routes/anuncio.routes.ts
import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as anuncioController from '../controllers/anuncio.controller';

const router = Router();

// Middleware de autenticación para todas las rutas de anuncios
router.use(protect);



// GET: Obtener todos los comentarios de un anuncio específico
// Ruta final: /api/anuncios/:recursoId/respuestas
router.get('/:recursoId/respuestas', anuncioController.getRespuestas);

// POST: Publicar un nuevo comentario en un anuncio
// Ruta final: /api/anuncios/:recursoId/respuestas
router.post('/:recursoId/respuestas', anuncioController.crearRespuesta);

// DELETE: Eliminar un comentario específico
// Ruta final: /api/anuncios/respuestas/:respuestaId
router.delete('/respuestas/:respuestaId', anuncioController.eliminarRespuesta);

export default router;
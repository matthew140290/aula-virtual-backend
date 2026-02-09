// src/routes/recurso.routes.ts
import { Router } from 'express';

import * as recursoController from '../controllers/recurso.controller';
import * as recursoCtrl from '../controllers/recurso.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();


// Todas las rutas de recursos requieren autenticación
router.use(protect);

// --- Rutas de Creación (MODIFICADAS CON MULTER) ---
router.post('/url', recursoController.addRecursoUrl);
router.post('/anuncio', recursoController.addRecursoAnuncio);

// 'archivo' debe coincidir con el nombre del campo en el FormData del frontend
router.post('/archivo', recursoController.addRecursoArchivo);

// 'archivos' para tareas que pueden tener múltiples adjuntos
router.post('/tarea', recursoController.addRecursoTarea);

// 'archivo' para el adjunto principal de un foro (opcional)
router.post('/foro',  recursoController.addRecursoForo);

router.post('/videoconferencia', authorize(['Docente', 'Director de grupo']), recursoController.createVideoconferencia);

router.post('/video', recursoController.createVideo);


// --- Rutas de Gestión de un Recurso Específico (SIN CAMBIOS) ---
router.get('/:id', recursoController.getRecursoById);
router.put('/:id', recursoController.updateRecurso);
router.patch('/:id/toggle-visibility', recursoController.toggleRecursoVisibility);
router.delete('/:id', recursoController.deleteRecurso);
router.post('/:id/clone', recursoController.cloneRecurso);


// --- Rutas para SERVIR archivos desde la BD (NUEVAS) ---
// Estas rutas obtendrán los datos binarios desde la BD y los enviarán al cliente.
router.get('/tarea/archivo/:archivoId', recursoController.getAdjuntoTarea);
router.get('/foro/:recursoId/adjunto-principal', recursoController.getAdjuntoForo);
router.post('/prueba', recursoController.addRecursoPrueba);
router.get('/:recursoId/archivo-data', recursoController.getRecursoArchivoData);


// Crear imagen desde archivo (multipart: campo "archivo", y "jsonData" con el resto)
router.post('/imagen', recursoCtrl.createImagenFromFile);

// Crear imagen desde URL remota (descarga y guarda en BD)
router.post('/imagen-url', recursoCtrl.createImagenFromUrl);

// Servir binario desde BD
router.get('/imagen/:recursoId/stream', recursoCtrl.streamImagen);


router.post('/carpeta',  recursoController.createCarpeta);
router.get('/carpeta/:recursoId/archivos',  recursoController.getArchivosCarpeta);
router.post('/carpeta/:recursoId/archivos',  recursoController.uploadArchivosCarpeta);
router.get('/carpeta/archivo/:archivoId/download',  recursoController.downloadArchivoCarpeta);
router.delete('/carpeta/archivo/:archivoId',  recursoController.deleteArchivoCarpeta);
router.get('/carpeta/:recursoId/contenido',  recursoController.getContenidoCarpeta);
router.post('/carpeta/:recursoId/subcarpeta',  recursoController.createSubFolder);
router.post('/carpeta/:recursoId/archivos',  recursoController.uploadArchivosCarpeta);
router.delete('/carpeta/subcarpeta/:folderId',  recursoController.deleteSubFolder);

// Rutas de Carpetas
router.post('/carpeta/:recursoId/enlace',  recursoController.createLinkInFolder);
router.delete('/carpeta/enlace/:enlaceId',  recursoController.deleteLinkInFolder);

router.put('/carpeta/:recursoId/mover', recursoController.moveItemInFolder);

// --- Otras rutas (SIN CAMBIOS) ---
router.post('/:id/vista', authorize(['Estudiante']), recursoController.registrarVistaRecurso);
router.post('/prueba', recursoController.addRecursoPrueba);

export default router;
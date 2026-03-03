// src/routes/recurso.routes.ts
import { Router } from 'express';
import * as recursoController from '../controllers/recurso.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { verificarPeriodoPorApartado, verificarPeriodoPorRecurso } from '../middleware/periodo.middleware';
import { validateSchema } from '../middleware/validate.middleware';
import { uploadDiskGeneral, uploadDiskImagen } from '../config/multer.config';
import { 
    recursoUrlSchema, 
    recursoVideoSchema, 
    recursoAnuncioSchema, 
    recursoVideoconferenciaSchema 
} from '../schemas/recurso.schema';

const router = Router();

// Todas las rutas requieren autenticación
router.use(protect);

// --- Rutas JSON (Validadas con Zod) ---
router.post('/url', verificarPeriodoPorApartado(), validateSchema(recursoUrlSchema), recursoController.addRecursoUrl);
router.post('/anuncio', verificarPeriodoPorApartado(), validateSchema(recursoAnuncioSchema), recursoController.addRecursoAnuncio);
router.post('/video', verificarPeriodoPorApartado(), validateSchema(recursoVideoSchema), recursoController.createVideo);
router.post('/videoconferencia', authorize(['Docente', 'Director de grupo', 'Coordinador', 'Administrador']), verificarPeriodoPorApartado(), validateSchema(recursoVideoconferenciaSchema), recursoController.createVideoconferencia);
router.post('/prueba', verificarPeriodoPorApartado(), recursoController.addRecursoPrueba);
router.post('/carpeta', verificarPeriodoPorApartado(), recursoController.createCarpeta);

// --- Rutas Multipart/Form-Data (Manejadas con Multer + Disco) ---
router.post('/archivo', uploadDiskGeneral.single('archivo'), verificarPeriodoPorApartado(), recursoController.addRecursoArchivo);
router.post('/tarea', uploadDiskGeneral.array('archivos', 5), verificarPeriodoPorApartado(), recursoController.addRecursoTarea);
router.post('/foro', uploadDiskGeneral.single('archivo'), verificarPeriodoPorApartado(), recursoController.addRecursoForo);
router.post('/imagen', uploadDiskImagen.single('archivo'), verificarPeriodoPorApartado(), recursoController.createImagenFromFile);
router.post('/imagen-url', verificarPeriodoPorApartado(), recursoController.createImagenFromUrl);

// --- Rutas de Gestión de Recursos ---
router.get('/:id', recursoController.getRecursoById);
router.put('/:id', verificarPeriodoPorRecurso(), recursoController.updateRecurso);
router.patch('/:id/toggle-visibility', verificarPeriodoPorRecurso(), recursoController.toggleRecursoVisibility);
router.delete('/:id', verificarPeriodoPorRecurso(), recursoController.deleteRecurso);
router.post('/:id/clone', recursoController.cloneRecurso);
router.post('/:id/vista', authorize(['Estudiante']), recursoController.registrarVistaRecurso);

// --- Rutas de Carpetas ---
router.get('/carpeta/:recursoId/archivos', recursoController.getArchivosCarpeta);
router.post('/carpeta/:recursoId/archivos', uploadDiskGeneral.array('archivo', 10), recursoController.uploadArchivosCarpeta);
router.get('/carpeta/archivo/:archivoId/download', recursoController.downloadArchivoCarpeta);
router.delete('/carpeta/archivo/:archivoId', recursoController.deleteArchivoCarpeta);
router.get('/carpeta/:recursoId/contenido', recursoController.getContenidoCarpeta);
router.post('/carpeta/:recursoId/subcarpeta', recursoController.createSubFolder);
router.delete('/carpeta/subcarpeta/:folderId', recursoController.deleteSubFolder);
router.post('/carpeta/:recursoId/enlace', recursoController.createLinkInFolder);
router.delete('/carpeta/enlace/:enlaceId', recursoController.deleteLinkInFolder);
router.put('/carpeta/:recursoId/mover', recursoController.moveItemInFolder);

// --- Servir Archivos desde BD ---
router.get('/tarea/archivo/:archivoId', recursoController.getAdjuntoTarea);
router.get('/foro/:recursoId/adjunto-principal', recursoController.getAdjuntoForo);
router.get('/:recursoId/archivo-data', recursoController.getRecursoArchivoData);
router.get('/imagen/:recursoId/stream', recursoController.streamImagen);

export default router;
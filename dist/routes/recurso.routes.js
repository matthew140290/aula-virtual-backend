"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/recurso.routes.ts
const express_1 = require("express");
const recursoController = __importStar(require("../controllers/recurso.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const periodo_middleware_1 = require("../middleware/periodo.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const multer_config_1 = require("../config/multer.config");
const recurso_schema_1 = require("../schemas/recurso.schema");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.protect);
// --- Rutas JSON (Validadas con Zod) ---
router.post('/url', (0, periodo_middleware_1.verificarPeriodoPorApartado)(), (0, validate_middleware_1.validateSchema)(recurso_schema_1.recursoUrlSchema), recursoController.addRecursoUrl);
router.post('/anuncio', (0, periodo_middleware_1.verificarPeriodoPorApartado)(), (0, validate_middleware_1.validateSchema)(recurso_schema_1.recursoAnuncioSchema), recursoController.addRecursoAnuncio);
router.post('/video', (0, periodo_middleware_1.verificarPeriodoPorApartado)(), (0, validate_middleware_1.validateSchema)(recurso_schema_1.recursoVideoSchema), recursoController.createVideo);
router.post('/videoconferencia', (0, auth_middleware_1.authorize)(['Docente', 'Director de grupo', 'Coordinador', 'Administrador']), (0, periodo_middleware_1.verificarPeriodoPorApartado)(), (0, validate_middleware_1.validateSchema)(recurso_schema_1.recursoVideoconferenciaSchema), recursoController.createVideoconferencia);
router.post('/prueba', (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.addRecursoPrueba);
router.post('/carpeta', (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.createCarpeta);
// --- Rutas Multipart/Form-Data (Manejadas con Multer + Disco) ---
router.post('/archivo', multer_config_1.uploadDiskGeneral.single('archivo'), (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.addRecursoArchivo);
router.post('/tarea', multer_config_1.uploadDiskGeneral.array('archivos', 5), (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.addRecursoTarea);
router.post('/foro', multer_config_1.uploadDiskGeneral.single('archivo'), (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.addRecursoForo);
router.post('/imagen', multer_config_1.uploadDiskImagen.single('archivo'), (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.createImagenFromFile);
router.post('/imagen-url', (0, periodo_middleware_1.verificarPeriodoPorApartado)(), recursoController.createImagenFromUrl);
// --- Rutas de Gestión de Recursos ---
router.get('/:id', recursoController.getRecursoById);
router.put('/:id', (0, periodo_middleware_1.verificarPeriodoPorRecurso)(), recursoController.updateRecurso);
router.patch('/:id/toggle-visibility', (0, periodo_middleware_1.verificarPeriodoPorRecurso)(), recursoController.toggleRecursoVisibility);
router.delete('/:id', (0, periodo_middleware_1.verificarPeriodoPorRecurso)(), recursoController.deleteRecurso);
router.post('/:id/clone', recursoController.cloneRecurso);
router.post('/:id/vista', (0, auth_middleware_1.authorize)(['Estudiante']), recursoController.registrarVistaRecurso);
router.get('/:id/vistas', (0, auth_middleware_1.authorize)(['Docente', 'Director de grupo', 'Coordinador', 'Administrador']), recursoController.getVistasRecurso);
// --- Rutas de Carpetas ---
router.get('/carpeta/:recursoId/archivos', recursoController.getArchivosCarpeta);
router.post('/carpeta/:recursoId/archivos', multer_config_1.uploadDiskGeneral.array('archivo', 10), recursoController.uploadArchivosCarpeta);
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
exports.default = router;

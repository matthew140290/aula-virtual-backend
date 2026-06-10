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
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const roles_1 = require("../constants/roles");
const icfesGlobalController = __importStar(require("../controllers/icfesGlobal.controller"));
const icfesGlobal_schema_1 = require("../schemas/icfesGlobal.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
const allowedEditors = [
    roles_1.ROLES.DOCENTE,
    roles_1.ROLES.COORDINADOR,
    roles_1.ROLES.COORDINADOR_GENERAL,
    roles_1.ROLES.ADMINISTRADOR,
    roles_1.ROLES.MASTER,
];
const allowedCoordinacion = [
    roles_1.ROLES.COORDINADOR,
    roles_1.ROLES.COORDINADOR_GENERAL,
    roles_1.ROLES.ADMINISTRADOR,
    roles_1.ROLES.MASTER,
];
router.get('/publicados', icfesGlobalController.listExamenesPublicados);
router.get('/publicados/:examenId', icfesGlobalController.getExamenPublicadoDetalle);
router.post('/publicados/:examenId/iniciar', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), icfesGlobalController.iniciarIntentoGlobal);
router.post('/intentos/:intentoId/entregar', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), (0, validate_middleware_1.validateSchema)(icfesGlobal_schema_1.entregarIntentoGlobalSchema), icfesGlobalController.entregarIntentoGlobal);
router.get('/intentos/:intentoId/revision', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), icfesGlobalController.getRevisionIntentoGlobal);
router.post('/intentos/:intentoId/preguntas/:preguntaId/explicacion-ia', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), icfesGlobalController.getExplicacionErrorIa);
router.get('/estudiante/mis-intentos', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), icfesGlobalController.getMisIntentos);
router.get('/estudiante/diagnostico', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), icfesGlobalController.getDiagnosticoCompetencias);
router.get('/coordinacion/resumen', (0, auth_middleware_1.authorize)(allowedCoordinacion), icfesGlobalController.getResumenCoordinacion);
router.get('/coordinacion/filtros', (0, auth_middleware_1.authorize)(allowedCoordinacion), icfesGlobalController.getOpcionesFiltroCoordinacion);
router.get('/examenes', (0, auth_middleware_1.authorize)(allowedEditors), icfesGlobalController.listExamenesGlobales);
router.get('/examenes/:examenId', (0, auth_middleware_1.authorize)(allowedEditors), icfesGlobalController.getExamenGlobalDetalle);
router.post('/examenes', (0, auth_middleware_1.authorize)(allowedEditors), (0, validate_middleware_1.validateSchema)(icfesGlobal_schema_1.createExamenGlobalSchema), icfesGlobalController.createExamenGlobal);
router.post('/examenes/:examenId/generar-ia', (0, auth_middleware_1.authorize)(allowedEditors), (0, validate_middleware_1.validateSchema)(icfesGlobal_schema_1.generarPreguntasIaSchema), icfesGlobalController.generarPreguntasIa);
router.put('/preguntas/:preguntaId', (0, auth_middleware_1.authorize)(allowedEditors), (0, validate_middleware_1.validateSchema)(icfesGlobal_schema_1.updatePreguntaGlobalSchema), icfesGlobalController.updatePreguntaGlobal);
router.delete('/examenes/:examenId', (0, auth_middleware_1.authorize)(allowedEditors), icfesGlobalController.deleteExamenGlobal);
router.delete('/preguntas/:preguntaId', (0, auth_middleware_1.authorize)(allowedEditors), icfesGlobalController.deletePreguntaGlobal);
router.post('/examenes/:examenId/publicar', (0, auth_middleware_1.authorize)(allowedEditors), icfesGlobalController.publicarExamenGlobal);
router.post('/examenes/:examenId/despublicar', (0, auth_middleware_1.authorize)(allowedEditors), icfesGlobalController.despublicarExamenGlobal);
exports.default = router;

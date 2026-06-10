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
// src/routes/prueba.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const periodo_middleware_1 = require("../middleware/periodo.middleware");
const pruebaController = __importStar(require("../controllers/prueba.controller"));
const roles_1 = require("../constants/roles");
const router = (0, express_1.Router)();
const editorRoles = [
    roles_1.ROLES.DOCENTE,
    roles_1.ROLES.DIRECTOR_GRUPO,
    roles_1.ROLES.COORDINADOR,
    roles_1.ROLES.COORDINADOR_GENERAL,
    roles_1.ROLES.ADMINISTRADOR,
    roles_1.ROLES.MASTER,
];
router.use(auth_middleware_1.protect); // Todas las rutas de pruebas requieren autenticación
router.get('/publicacion/:recursoId', pruebaController.getPublicacionPorRecursoId);
router.post('/publicaciones', pruebaController.getPublicacionesByRecursoIds);
router.get('/banco-preguntas', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.getBancoPreguntas);
router.post('/banco-preguntas', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.addPreguntaToBanco);
// Rutas por pruebaId
router.get('/:pruebaId', pruebaController.getPruebaDetalles);
router.put('/:pruebaId/competencia', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPrueba)(), pruebaController.updatePruebaCompetencia);
router.put('/:pruebaId/publicar', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPrueba)(), pruebaController.setPruebaPublicado);
router.post('/:pruebaId/iniciar', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), pruebaController.iniciarPrueba);
router.post('/:pruebaId/entregar', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), pruebaController.entregarPrueba);
router.post('/:pruebaId/abandonar', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), pruebaController.abandonarPrueba);
router.post('/:pruebaId/heartbeat', (0, auth_middleware_1.authorize)([roles_1.ROLES.ESTUDIANTE]), pruebaController.heartbeatPrueba);
router.get('/:pruebaId/estudiantes', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.getEstudiantesParaPrueba);
router.get('/:pruebaId/simulacros', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.getResultadosSimulacro);
router.get('/:pruebaId/resultados', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.getResultadosReales);
router.post('/:pruebaId/simulacros', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPrueba)(), pruebaController.crearSimulacro);
// Rutas por IDs propios
router.post('/:pruebaId/preguntas', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPrueba)(), pruebaController.addPregunta);
router.put('/preguntas/:preguntaId', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPreguntaPrueba)(), pruebaController.updatePregunta);
router.delete('/preguntas/:preguntaId', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPreguntaPrueba)(), pruebaController.deletePregunta);
router.delete('/simulacros/:simulacroId', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.eliminarSimulacro);
router.put('/resultados/:resultadoId/calificar', (0, auth_middleware_1.authorize)(editorRoles), pruebaController.guardarCalificacion);
router.put('/:pruebaId/finalizada', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPrueba)(), pruebaController.setPruebaFinalizada);
router.put('/:pruebaId/config', (0, auth_middleware_1.authorize)(editorRoles), (0, periodo_middleware_1.verificarPeriodoPorPrueba)(), pruebaController.updateConfig);
// routes/pruebas.routes.ts
exports.default = router;

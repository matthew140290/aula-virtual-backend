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
// src/routes/estudiante.routes.ts
const express_1 = require("express");
const estudianteController = __importStar(require("../controllers/estudiante.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas de estudiantes requieren autenticación
router.use(auth_middleware_1.protect);
// GET /api/estudiantes/por-curso/:codigoCurso
router.get('/por-asignatura/:codigoAsignatura', estudianteController.getEstudiantesPorAsignatura);
router.get('/mis-asignaturas', (0, auth_middleware_1.authorize)(['Estudiante']), estudianteController.getMisAsignaturas);
router.get('/mis-eventos', (0, auth_middleware_1.authorize)(['Estudiante']), estudianteController.getMisEventosProximos);
router.get('/recursos/:recursoId/vista', (0, auth_middleware_1.authorize)(['Estudiante']), estudianteController.getRecursoVista);
router.post('/eventos/ocultar', auth_middleware_1.protect, (0, auth_middleware_1.authorize)(['Estudiante']), estudianteController.ocultarEvento);
exports.default = router;

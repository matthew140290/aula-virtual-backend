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
//src/routes/tarea.routes
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const periodo_middleware_1 = require("../middleware/periodo.middleware");
const tareaController = __importStar(require("../controllers/tarea.controller"));
const router = (0, express_1.Router)();
// Todas las rutas de tareas requieren autenticación
router.use(auth_middleware_1.protect);
router.post('/:id/entregas', (0, auth_middleware_1.authorize)(['Estudiante', 'Docente', 'Director de grupo']), (0, periodo_middleware_1.verificarPeriodoPorRecurso)(), tareaController.crearEntrega);
// Solo accesible para perfiles de docentes.
router.get('/:id/entregas', (0, auth_middleware_1.authorize)(['Docente', 'Director de grupo', 'Administrador']), tareaController.getEntregasPorTarea);
router.patch('/:tareaId/entregas/:matriculaNo', (0, auth_middleware_1.authorize)(['Docente', 'Director de grupo', 'Administrador', 'Master']), tareaController.guardarCalificacion);
router.get('/entregas/:id/archivo', (0, auth_middleware_1.authorize)(['Docente', 'Estudiante', 'Administrador', 'Director de grupo']), tareaController.descargarEntrega);
exports.default = router;

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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/foro.routes.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer")); // 💡 1. Importamos multer
const foroController = __importStar(require("../controllers/foro.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const periodo_middleware_1 = require("../middleware/periodo.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() }); // 💡 2. Configuramos multer
// Todas las rutas de foros requieren autenticación
router.use(auth_middleware_1.protect);
// GET /api/foros/:recursoId/entradas
router.get('/:recursoId/entradas', foroController.getEntradas);
// POST /api/foros/:recursoId/entradas
router.post('/:recursoId/entradas', upload.single('adjunto'), (0, periodo_middleware_1.verificarPeriodoPorRecurso)(), foroController.crearEntrada);
// PUT y DELETE para entradas individuales
router.put('/entradas/:entradaId', upload.single('adjunto'), (0, periodo_middleware_1.verificarPeriodoPorEntradaForo)(), foroController.actualizarUnaEntrada);
router.delete('/entradas/:entradaId', (0, periodo_middleware_1.verificarPeriodoPorEntradaForo)(), foroController.eliminarUnaEntrada);
router.get('/entradas/:entradaId/adjunto', foroController.getAdjuntoEntrada);
// Rutas de calificación
router.get('/:recursoId/calificaciones', (0, auth_middleware_1.authorize)(['Docente', 'Director de grupo']), foroController.obtenerCalificaciones);
router.post('/:recursoId/calificaciones', (0, auth_middleware_1.authorize)(['Docente', 'Director de grupo']), foroController.calificarParticipacion);
exports.default = router;

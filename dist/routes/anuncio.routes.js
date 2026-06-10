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
// src/routes/anuncio.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const anuncioController = __importStar(require("../controllers/anuncio.controller"));
const router = (0, express_1.Router)();
// Middleware de autenticación para todas las rutas de anuncios
router.use(auth_middleware_1.protect);
// GET: Obtener todos los comentarios de un anuncio específico
// Ruta final: /api/anuncios/:recursoId/respuestas
router.get('/:recursoId/respuestas', anuncioController.getRespuestas);
// POST: Publicar un nuevo comentario en un anuncio
// Ruta final: /api/anuncios/:recursoId/respuestas
router.post('/:recursoId/respuestas', anuncioController.crearRespuesta);
// DELETE: Eliminar un comentario específico
// Ruta final: /api/anuncios/respuestas/:respuestaId
router.delete('/respuestas/:respuestaId', anuncioController.eliminarRespuesta);
exports.default = router;

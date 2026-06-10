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
exports.eliminarRespuesta = exports.crearRespuesta = exports.getRespuestas = void 0;
const anuncioService = __importStar(require("../services/anuncio.service"));
const recursoService = __importStar(require("../services/recurso.service"));
const notificacion_service_1 = require("../services/notificacion.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const validarAccesoEstudiante = async (req, res, recursoId) => {
    if (req.user?.perfil !== 'Estudiante')
        return true;
    const puedeAcceder = await recursoService.estudiantePuedeAccederRecurso(recursoId, Number(req.user.codigo));
    if (!puedeAcceder) {
        res.status(404).json({ message: 'Anuncio no encontrado.' });
        return false;
    }
    return true;
};
exports.getRespuestas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const respuestas = await anuncioService.getRespuestasAnuncio(recursoId);
    res.status(200).json(respuestas);
});
exports.crearRespuesta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const contenido = req.body.contenido;
    if (!contenido)
        return res.status(400).json({ message: 'El contenido es requerido.' });
    await anuncioService.crearRespuestaAnuncio(recursoId, req.user.codigo, req.user.perfil, contenido);
    if (req.user.perfil === 'Estudiante') {
        (0, notificacion_service_1.notificarDocentePorInteraccion)(recursoId, { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto }, 'ANUNCIO_RESPUESTA').catch(console.error); // No bloqueamos la respuesta ("Fire and forget")
    }
    res.status(201).json({ message: 'Comentario publicado.' });
});
exports.eliminarRespuesta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const respuestaId = Number(req.params.respuestaId);
    const exito = await anuncioService.eliminarRespuestaAnuncio(respuestaId, req.user.codigo, req.user.perfil);
    if (exito) {
        res.status(200).json({ message: 'Comentario eliminado.' });
    }
    else {
        res.status(403).json({ message: 'No tienes permiso para eliminar este comentario.' });
    }
});

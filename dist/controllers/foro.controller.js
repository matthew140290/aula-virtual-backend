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
exports.getAdjuntoEntrada = exports.calificarParticipacion = exports.obtenerCalificaciones = exports.eliminarUnaEntrada = exports.actualizarUnaEntrada = exports.crearEntrada = exports.getEntradas = void 0;
const foroService = __importStar(require("../services/foro.service"));
const recursoService = __importStar(require("../services/recurso.service"));
const notificacion_service_1 = require("../services/notificacion.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const validarAccesoEstudiante = async (req, res, recursoId) => {
    if (req.user?.perfil !== 'Estudiante')
        return true;
    const puedeAcceder = await recursoService.estudiantePuedeAccederRecurso(recursoId, Number(req.user.codigo));
    if (!puedeAcceder) {
        res.status(404).json({ message: 'Foro no encontrado.' });
        return false;
    }
    return true;
};
const validarAccesoEstudiantePorEntrada = async (req, res, entradaId) => {
    if (req.user?.perfil !== 'Estudiante')
        return true;
    const recursoId = await foroService.findRecursoIdByEntradaId(entradaId);
    if (!recursoId) {
        res.status(404).json({ message: 'Foro no encontrado.' });
        return false;
    }
    return validarAccesoEstudiante(req, res, recursoId);
};
exports.getEntradas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const entradas = await foroService.getEntradasDelForo(recursoId);
    res.status(200).json(entradas);
});
exports.crearEntrada = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
    }
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const { contenidoHTML, entradaPadreId } = JSON.parse(req.body.jsonData);
    const adjunto = req.file;
    await foroService.crearNuevaEntrada({
        recursoId,
        contenidoHTML,
        entradaPadreId,
        usuarioId: req.user.codigo,
        perfilUsuario: req.user.perfil,
        adjunto,
    }, { codigo: req.user.codigo, perfil: req.user.perfil });
    if (req.user.perfil === 'Estudiante') {
        (0, notificacion_service_1.notificarDocentePorInteraccion)(recursoId, { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto }, 'FORO_PARTICIPACION').catch(console.error);
    }
    res.status(201).json({ message: 'Respuesta publicada con exito.' });
});
exports.actualizarUnaEntrada = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const entradaId = Number(req.params.entradaId);
    if (!(await validarAccesoEstudiantePorEntrada(req, res, entradaId)))
        return;
    const { contenidoHTML, adjuntoAction } = JSON.parse(req.body.jsonData);
    const nuevoAdjunto = req.file;
    let adjuntoParam = nuevoAdjunto;
    if (adjuntoAction === 'delete') {
        adjuntoParam = null;
    }
    else if (!nuevoAdjunto) {
        adjuntoParam = undefined;
    }
    const exito = await foroService.actualizarEntrada(entradaId, contenidoHTML, req.user.codigo, req.user.perfil, adjuntoParam);
    if (exito) {
        res.status(200).json({ message: 'Mensaje actualizado con exito.' });
    }
    else {
        res.status(403).json({ message: 'No tienes permiso para editar este mensaje.' });
    }
});
exports.eliminarUnaEntrada = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const entradaId = Number(req.params.entradaId);
    if (!(await validarAccesoEstudiantePorEntrada(req, res, entradaId)))
        return;
    const exito = await foroService.eliminarEntrada(entradaId, req.user.codigo, req.user.perfil);
    if (exito) {
        res.status(200).json({ message: 'Mensaje eliminado con exito.' });
    }
    else {
        res.status(403).json({ message: 'No tienes permiso para eliminar este mensaje.' });
    }
});
exports.obtenerCalificaciones = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    const calificaciones = await foroService.getCalificacionesForo(recursoId);
    res.status(200).json(calificaciones);
});
exports.calificarParticipacion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !req.user.perfil.includes('Docente')) {
        return res.status(403).json({ message: 'No tienes permiso para calificar.' });
    }
    const recursoId = Number(req.params.recursoId);
    const { matriculaNo, calificacion, comentario } = req.body;
    await foroService.guardarCalificacion(recursoId, matriculaNo, calificacion, comentario);
    res.status(200).json({ message: 'Calificacion guardada con exito.' });
});
exports.getAdjuntoEntrada = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const entradaId = Number(req.params.entradaId);
    const archivo = await foroService.findAdjuntoDeEntrada(entradaId);
    if (!archivo || !archivo.ImagenData) {
        return res.status(404).json({ message: 'Adjunto no encontrado.' });
    }
    if (!(await validarAccesoEstudiante(req, res, archivo.RecursoID)))
        return;
    res.setHeader('Content-Type', archivo.ImagenMimeType);
    res.send(archivo.ImagenData);
});

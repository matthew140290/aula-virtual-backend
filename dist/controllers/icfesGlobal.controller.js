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
exports.deletePreguntaGlobal = exports.deleteExamenGlobal = exports.getOpcionesFiltroCoordinacion = exports.getResumenCoordinacion = exports.getDiagnosticoCompetencias = exports.getMisIntentos = exports.getExplicacionErrorIa = exports.getRevisionIntentoGlobal = exports.entregarIntentoGlobal = exports.iniciarIntentoGlobal = exports.getExamenPublicadoDetalle = exports.listExamenesPublicados = exports.despublicarExamenGlobal = exports.publicarExamenGlobal = exports.updatePreguntaGlobal = exports.generarPreguntasIa = exports.getExamenGlobalDetalle = exports.listExamenesGlobales = exports.createExamenGlobal = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const icfesGlobalService = __importStar(require("../services/icfesGlobal.service"));
const getActor = (req) => {
    const codigo = req.user?.codigo;
    const perfil = req.user?.perfil;
    if (!codigo || !perfil)
        return null;
    return { codigo, perfil };
};
exports.createExamenGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const actor = getActor(req);
    if (!actor)
        return res.status(401).json({ message: 'No autorizado.' });
    const data = await icfesGlobalService.createExamenGlobal(req.body, actor);
    res.status(201).json({ message: 'Examen global creado.', data });
});
exports.listExamenesGlobales = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const items = await icfesGlobalService.listExamenesGlobales();
    res.status(200).json(items);
});
exports.getExamenGlobalDetalle = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const examenId = Number(req.params.examenId);
    const data = await icfesGlobalService.getExamenGlobalDetalle(examenId);
    if (!data) {
        return res.status(404).json({ message: 'Examen global no encontrado.' });
    }
    return res.status(200).json(data);
});
exports.generarPreguntasIa = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const actor = getActor(req);
    if (!actor)
        return res.status(401).json({ message: 'No autorizado.' });
    const examenId = Number(req.params.examenId);
    const data = await icfesGlobalService.generarPreguntasIa(examenId, req.body, actor);
    res.status(200).json({ message: 'Preguntas generadas y guardadas en borrador.', data });
});
exports.updatePreguntaGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const preguntaId = Number(req.params.preguntaId);
    await icfesGlobalService.updatePreguntaGlobal(preguntaId, req.body);
    res.status(200).json({ message: 'Pregunta actualizada.' });
});
exports.publicarExamenGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const examenId = Number(req.params.examenId);
    await icfesGlobalService.publicarExamenGlobal(examenId);
    res.status(200).json({ message: 'Examen global publicado.' });
});
exports.despublicarExamenGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const examenId = Number(req.params.examenId);
    await icfesGlobalService.despublicarExamenGlobal(examenId);
    res.status(200).json({ message: 'Examen global despublicado.' });
});
exports.listExamenesPublicados = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const items = await icfesGlobalService.listExamenesGlobalesPublicados();
    res.status(200).json(items);
});
exports.getExamenPublicadoDetalle = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const examenId = Number(req.params.examenId);
    const data = await icfesGlobalService.getExamenGlobalPublicadoDetalle(examenId);
    if (!data)
        return res.status(404).json({ message: 'Examen global no disponible.' });
    return res.status(200).json(data);
});
exports.iniciarIntentoGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const examenId = Number(req.params.examenId);
    const matriculaNo = Number(req.user?.codigo);
    if (!Number.isFinite(matriculaNo)) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const data = await icfesGlobalService.iniciarIntentoGlobal(examenId, matriculaNo);
    return res.status(201).json({ message: 'Intento iniciado.', data });
});
exports.entregarIntentoGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const intentoId = Number(req.params.intentoId);
    const matriculaNo = Number(req.user?.codigo);
    if (!Number.isFinite(matriculaNo)) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const { respuestas, duracionSegundos } = req.body;
    const data = await icfesGlobalService.entregarIntentoGlobal(intentoId, matriculaNo, respuestas, duracionSegundos);
    return res.status(200).json({ message: 'Intento entregado.', data });
});
exports.getRevisionIntentoGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const intentoId = Number(req.params.intentoId);
    const matriculaNo = Number(req.user?.codigo);
    if (!Number.isFinite(matriculaNo)) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const data = await icfesGlobalService.getRevisionIntentoGlobal(intentoId, matriculaNo);
    return res.status(200).json(data);
});
exports.getExplicacionErrorIa = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const intentoId = Number(req.params.intentoId);
    const preguntaId = Number(req.params.preguntaId);
    const matriculaNo = Number(req.user?.codigo);
    if (!Number.isFinite(matriculaNo)) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const data = await icfesGlobalService.generarExplicacionErrorIa(intentoId, preguntaId, matriculaNo);
    return res.status(200).json({ message: 'Explicacion generada.', data });
});
exports.getMisIntentos = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const matriculaNo = Number(req.user?.codigo);
    if (!Number.isFinite(matriculaNo)) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const data = await icfesGlobalService.getMisIntentosGlobales(matriculaNo);
    return res.status(200).json(data);
});
exports.getDiagnosticoCompetencias = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const matriculaNo = Number(req.user?.codigo);
    if (!Number.isFinite(matriculaNo)) {
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const data = await icfesGlobalService.getDiagnosticoCompetencias(matriculaNo);
    return res.status(200).json(data);
});
exports.getResumenCoordinacion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const numOrUndef = (value) => {
        if (value === undefined || value === null || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    };
    const filtros = {
        anio: numOrUndef(req.query.anio),
        trimestre: numOrUndef(req.query.trimestre),
        gradoCodigo: numOrUndef(req.query.gradoCodigo),
        cursoCodigo: numOrUndef(req.query.cursoCodigo),
    };
    const data = await icfesGlobalService.getResumenCoordinacion(filtros);
    return res.status(200).json(data);
});
exports.getOpcionesFiltroCoordinacion = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const data = await icfesGlobalService.getOpcionesFiltroCoordinacion();
    return res.status(200).json(data);
});
exports.deleteExamenGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const examenId = Number(req.params.examenId);
    await icfesGlobalService.deleteExamenGlobal(examenId);
    res.status(200).json({ message: 'Examen global eliminado.' });
});
exports.deletePreguntaGlobal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const preguntaId = Number(req.params.preguntaId);
    await icfesGlobalService.deletePreguntaGlobal(preguntaId);
    res.status(200).json({ message: 'Pregunta eliminada.' });
});

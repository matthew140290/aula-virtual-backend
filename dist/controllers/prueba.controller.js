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
exports.getPublicacionesByRecursoIds = exports.getPublicacionPorRecursoId = exports.crearSimulacro = exports.setPruebaFinalizada = exports.setPruebaPublicado = exports.guardarCalificacion = exports.eliminarSimulacro = exports.getResultadosReales = exports.getResultadosSimulacro = exports.getEstudiantesParaPrueba = exports.addPreguntaToBanco = exports.getBancoPreguntas = exports.deletePregunta = exports.updateConfig = exports.updatePregunta = exports.addPregunta = exports.updatePruebaCompetencia = exports.getPruebaDetalles = exports.heartbeatPrueba = exports.abandonarPrueba = exports.entregarPrueba = exports.iniciarPrueba = void 0;
const pruebaService = __importStar(require("../services/prueba.service")); // Crearemos este servicio en un momento
const notificacion_service_1 = require("../services/notificacion.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const roles_1 = require("../constants/roles");
exports.iniciarPrueba = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const matriculaNo = req.user?.codigo;
    if (!matriculaNo)
        return res.status(401).json({ message: 'No autorizado' });
    const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : undefined;
    try {
        const data = await pruebaService.iniciarPrueba(pruebaId, Number(matriculaNo), contrasena);
        res.status(201).json(data);
    }
    catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }
        throw error;
    }
});
exports.entregarPrueba = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { resultadoId, respuestas, duracionSegundos } = req.body;
    const matriculaNo = req.user?.codigo;
    if (!matriculaNo)
        return res.status(401).json({ message: 'No autorizado' });
    if (!Number.isFinite(Number(resultadoId))) {
        return res.status(400).json({ message: 'resultadoId inválido' });
    }
    if (!Array.isArray(respuestas)) {
        return res.status(400).json({ message: 'El campo respuestas debe ser un arreglo.' });
    }
    if (!Number.isFinite(Number(duracionSegundos)) || Number(duracionSegundos) < 0) {
        return res.status(400).json({ message: 'duracionSegundos inválida.' });
    }
    let resultado;
    try {
        resultado = await pruebaService.entregarPrueba(Number(resultadoId), respuestas, Number(duracionSegundos), Number(matriculaNo));
    }
    catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }
        throw error;
    }
    if (req.user && req.user.perfil === 'Estudiante' && resultado.recursoId) {
        (0, notificacion_service_1.notificarDocentePorInteraccion)(resultado.recursoId, { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto }, 'PRUEBA_FINALIZADA').catch(console.error);
    }
    res.status(200).json({ message: 'Prueba entregada con éxito.', data: resultado });
});
exports.abandonarPrueba = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const matriculaNo = req.user?.codigo;
    const { resultadoId, duracionSegundos } = req.body || {};
    if (!matriculaNo) {
        return res.status(401).json({ message: 'No autorizado' });
    }
    if (!Number.isFinite(pruebaId) || !Number.isFinite(Number(resultadoId))) {
        return res.status(400).json({ message: 'Parámetros inválidos para abandono de prueba.' });
    }
    const abandonada = await pruebaService.abandonarPrueba(pruebaId, Number(resultadoId), Number(matriculaNo), Number.isFinite(Number(duracionSegundos)) ? Number(duracionSegundos) : undefined);
    return res.status(200).json({ abandonada });
});
exports.heartbeatPrueba = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const matriculaNo = req.user?.codigo;
    const { resultadoId, duracionSegundos } = req.body || {};
    if (!matriculaNo) {
        return res.status(401).json({ message: 'No autorizado' });
    }
    if (!Number.isFinite(pruebaId) || !Number.isFinite(Number(resultadoId))) {
        return res.status(400).json({ message: 'Parámetros inválidos para heartbeat.' });
    }
    const data = await pruebaService.heartbeatPrueba(pruebaId, Number(resultadoId), Number(matriculaNo), Number.isFinite(Number(duracionSegundos)) ? Number(duracionSegundos) : undefined);
    return res.status(200).json(data);
});
exports.getPruebaDetalles = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = Number(req.params.pruebaId); // puede ser RecursoID o PruebaID
    const isStudent = (0, roles_1.normalizeRole)(req.user?.perfil || '') === (0, roles_1.normalizeRole)('Estudiante');
    const prueba = await pruebaService.getPruebaDetalles(id, {
        includeAnswers: !isStudent,
        includeSecret: !isStudent,
        viewerMatriculaNo: isStudent ? Number(req.user?.codigo) : undefined,
    });
    if (!prueba)
        return res.status(404).json({ message: 'Prueba no encontrada.' });
    res.status(200).json(prueba);
});
// Actualizar el nombre de la competencia de la prueba
exports.updatePruebaCompetencia = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const { nombreCompetencia } = req.body;
    await pruebaService.updatePruebaCompetencia(pruebaId, nombreCompetencia);
    res.status(200).json({ message: 'Nombre de competencia actualizado con éxito.' });
});
// Añadir una nueva pregunta a la prueba
exports.addPregunta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const preguntaData = req.body; // Debería contener texto, tipo, porcentaje, respuestas
    const newPreguntaId = await pruebaService.addPreguntaToPrueba(pruebaId, preguntaData);
    res.status(201).json({ message: 'Pregunta añadida con éxito.', preguntaId: newPreguntaId });
});
// Actualizar una pregunta existente
exports.updatePregunta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const preguntaId = Number(req.params.preguntaId);
    const preguntaData = req.body;
    await pruebaService.updatePregunta(preguntaId, preguntaData);
    res.status(200).json({ message: 'Pregunta actualizada con éxito.' });
});
exports.updateConfig = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    await pruebaService.updatePruebaConfig(pruebaId, req.body);
    res.json({ message: 'Configuración actualizada correctamente.' });
});
// Eliminar una pregunta
exports.deletePregunta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const preguntaId = Number(req.params.preguntaId);
    await pruebaService.deletePregunta(preguntaId);
    res.status(200).json({ message: 'Pregunta eliminada con éxito.' });
});
exports.getBancoPreguntas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const banco = await pruebaService.getBancoPreguntas();
    res.status(200).json(banco);
});
exports.addPreguntaToBanco = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const preguntaData = req.body;
    if (!preguntaData || typeof preguntaData !== 'object') {
        return res.status(400).json({ message: 'Payload inválido para guardar en banco.' });
    }
    try {
        const result = await pruebaService.addPreguntaToBanco(preguntaData, req.user ? {
            codigo: req.user.codigo,
            perfil: req.user.perfil,
        } : undefined);
        res.status(201).json({ message: 'Pregunta guardada en el banco con éxito.', ...result });
    }
    catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }
        throw error;
    }
});
exports.getEstudiantesParaPrueba = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getEstudiantesParaPrueba(pruebaId);
    res.json(data);
});
exports.getResultadosSimulacro = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getResultadosSimulacro(pruebaId);
    res.json(data);
});
exports.getResultadosReales = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getResultadosReales(pruebaId);
    res.json(data);
});
exports.eliminarSimulacro = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const simulacroId = Number(req.params.simulacroId);
    await pruebaService.deleteSimulacroById(simulacroId);
    res.json({ message: 'Simulacro eliminado.' });
});
exports.guardarCalificacion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const resultadoId = Number(req.params.resultadoId);
    const { calificacionFinal, retroalimentacion } = req.body;
    if (!Number.isFinite(resultadoId)) {
        return res.status(400).json({ message: 'resultadoId inválido.' });
    }
    const nota = Number(calificacionFinal);
    if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
        return res.status(400).json({ message: 'La calificación debe estar entre 0 y 5.' });
    }
    await pruebaService.setResultadoCalificacion(resultadoId, nota, retroalimentacion);
    res.json({ message: 'Calificación guardada.' });
});
exports.setPruebaPublicado = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const { publicado } = req.body;
    const { recursoId, publicado: pubFinal } = await pruebaService.validateAndSetPublicadoReturningRecurso(pruebaId, publicado);
    return res.status(200).json({
        message: `Prueba ${pubFinal ? 'publicada' : 'despublicada'} con éxito.`,
        recursoId,
        publicado: pubFinal,
        success: true
    });
});
exports.setPruebaFinalizada = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const { finalizada } = req.body;
    await pruebaService.setPruebaFinalizada(pruebaId, finalizada);
    res.status(200).json({ message: `Prueba marcada como ${finalizada ? 'finalizada' : 'editable'}.` });
});
exports.crearSimulacro = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const pruebaId = Number(req.params.pruebaId);
    const body = req.body;
    if (!Number.isFinite(pruebaId) || !Number.isFinite(body.matriculaNo)) {
        return res.status(400).json({ message: 'Parámetros inválidos.' });
    }
    if (typeof body.calificacion === 'number' && (body.calificacion < 0 || body.calificacion > 5)) {
        return res.status(400).json({ message: 'calificacion inválida. Debe estar entre 0 y 5.' });
    }
    if (typeof body.duracionSegundos === 'number' && body.duracionSegundos < 0) {
        return res.status(400).json({ message: 'duracionSegundos inválida.' });
    }
    const id = await pruebaService.createSimulacro(pruebaId, Number(body.matriculaNo), typeof body.calificacion === 'number' ? body.calificacion : undefined, typeof body.duracionSegundos === 'number' ? body.duracionSegundos : undefined);
    res.status(201).json({ simulacroId: id });
});
exports.getPublicacionPorRecursoId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) {
        return res.status(400).json({ message: 'recursoId inválido' });
    }
    const publicado = await pruebaService.getPublicacionByRecursoId(recursoId);
    if (publicado === null) {
        return res.status(404).json({ message: 'No hay prueba asociada a este recurso' });
    }
    return res.json({ recursoId, publicado });
});
// ✅ NUEVO: bulk por muchos RecursoID
exports.getPublicacionesByRecursoIds = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoIds = Array.isArray(req.body?.recursoIds)
        ? req.body.recursoIds.map(Number).filter(Number.isFinite)
        : [];
    if (!recursoIds.length) {
        return res.json({ items: [] });
    }
    const items = await pruebaService.getPublicacionesByRecursoIds(recursoIds);
    return res.json({ items });
});

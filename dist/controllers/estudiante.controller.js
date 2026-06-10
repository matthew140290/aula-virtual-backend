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
exports.getRecursoVista = exports.ocultarEvento = exports.getMisEventosProximos = exports.getMisAsignaturas = exports.getEstudiantesPorAsignatura = void 0;
const estudianteService = __importStar(require("../services/estudiante.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
const getEstudiantesPorAsignatura = async (req, res) => {
    try {
        const codigoAsignatura = parseInt(req.params.codigoAsignatura, 10);
        if (isNaN(codigoAsignatura)) {
            return res.status(400).json({ message: 'El código del curso debe ser un número válido.' });
        }
        const estudiantes = await estudianteService.findEstudiantesByAsignatura(codigoAsignatura);
        res.status(200).json(estudiantes);
    }
    catch (error) {
        console.error('Error al obtener estudiantes por curso:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
exports.getEstudiantesPorAsignatura = getEstudiantesPorAsignatura;
exports.getMisAsignaturas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    //console.log('--- 🚀 [CONTROLLER] Iniciando getMisAsignaturas ---');
    if (!req.user) {
        console.error('❌ [CONTROLLER] No hay usuario en req.user (Token inválido o middleware falló)');
        return res.status(401).json({ message: 'No autorizado.' });
    }
    const asignaturas = await estudianteService.findAsignaturasByEstudiante(req.user.codigo);
    //console.log(`📤 [CONTROLLER] Enviando respuesta JSON con ${asignaturas.length} asignaturas.`);
    res.status(200).json(asignaturas);
});
exports.getMisEventosProximos = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const eventos = await estudianteService.findEventosProximosByEstudiante(req.user.codigo);
    res.status(200).json(eventos);
});
exports.ocultarEvento = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { codigo } = req.user; // Viene de tu auth.middleware.ts (DecodedUserToken)
    const { recursoId } = req.body;
    if (!recursoId) {
        return res.status(400).json({ message: 'recursoId es requerido' });
    }
    await estudianteService.ocultarEventoEstudiante(codigo, recursoId);
    return res.json({ message: 'Evento ocultado' });
});
exports.getRecursoVista = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    const matriculaNo = req.user?.codigo;
    if (!matriculaNo)
        return res.status(401).json({ message: 'No autorizado' });
    const data = await estudianteService.getVistaRecursoEstudiante(recursoId, Number(matriculaNo));
    if (!data)
        return res.status(404).json({ message: 'Recurso no encontrado' });
    res.json(data);
});

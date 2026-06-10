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
exports.getActividad = exports.getExpediente = exports.buscarEstudiantes = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const expedienteService = __importStar(require("../services/expedienteEstudiantil.service"));
exports.buscarEstudiantes = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    if (query.trim().length < 2) {
        res.status(200).json([]);
        return;
    }
    const estudiantes = await expedienteService.buscarEstudiantes(query);
    res.status(200).json(estudiantes);
});
exports.getExpediente = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const matriculaNo = Number(req.params.matriculaNo);
    if (!matriculaNo || isNaN(matriculaNo)) {
        res.status(400).json({ message: 'MatrículaNo inválido.' });
        return;
    }
    const [infoBasica, resumenAcademico] = await Promise.all([
        expedienteService.getInfoBasica(matriculaNo),
        expedienteService.getResumenAcademico(matriculaNo),
    ]);
    if (!infoBasica) {
        res.status(404).json({ message: 'Estudiante no encontrado.' });
        return;
    }
    res.status(200).json({ infoBasica, resumenAcademico });
});
exports.getActividad = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const matriculaNo = Number(req.params.matriculaNo);
    if (!matriculaNo || isNaN(matriculaNo)) {
        res.status(400).json({ message: 'MatrículaNo inválido.' });
        return;
    }
    const rawLimite = Number(req.query.limite);
    const limite = !isNaN(rawLimite) && rawLimite > 0 ? Math.min(rawLimite, 500) : 100;
    const timeline = await expedienteService.getTimelineActividad(matriculaNo, limite);
    res.status(200).json(timeline);
});

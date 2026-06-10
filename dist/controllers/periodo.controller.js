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
exports.otorgarExcepcion = exports.configurarPeriodo = exports.getAllPeriods = void 0;
const periodoService = __importStar(require("../services/periodo.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getAllPeriods = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const actor = { codigo: req.user.codigo, perfil: req.user.perfil };
    const periods = await periodoService.findAllPeriods(actor);
    res.status(200).json(periods);
});
exports.configurarPeriodo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const numeroPeriodo = Number(req.params.numeroPeriodo);
    if (isNaN(numeroPeriodo))
        return res.status(400).json({ message: 'Número de período inválido.' });
    const { fechaApertura, fechaCierre, bloqueadoManualmente } = req.body;
    const actor = { codigo: req.user.codigo, perfil: req.user.perfil };
    await periodoService.configurarControlPeriodo(numeroPeriodo, fechaApertura ? new Date(fechaApertura) : null, fechaCierre ? new Date(fechaCierre) : null, bloqueadoManualmente, actor);
    res.status(200).json({ message: 'Período configurado exitosamente.' });
});
exports.otorgarExcepcion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado.' });
    const numeroPeriodo = Number(req.params.numeroPeriodo);
    if (isNaN(numeroPeriodo))
        return res.status(400).json({ message: 'Número de período inválido.' });
    const { docentesIds, fechaLimiteExcepcion, comentario } = req.body;
    if (!Array.isArray(docentesIds) || docentesIds.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un docente.' });
    }
    if (!fechaLimiteExcepcion) {
        return res.status(400).json({ message: 'La fecha límite es requerida.' });
    }
    const actor = { codigo: req.user.codigo, perfil: req.user.perfil };
    await periodoService.otorgarExcepcionDocentes(numeroPeriodo, docentesIds, new Date(fechaLimiteExcepcion), comentario || '', actor);
    res.status(200).json({ message: 'Excepción otorgada exitosamente a los docentes seleccionados.' });
});

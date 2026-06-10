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
exports.cloneWeek = exports.deleteWeek = exports.updateWeek = exports.addWeeks = exports.getWeeks = void 0;
const semanaService = __importStar(require("../services/semana.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
// Obtener semanas
exports.getWeeks = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { codigoAsignatura, numeroPeriodo } = req.query;
    const user = req.user;
    if (!codigoAsignatura || !numeroPeriodo) {
        return res.status(400).json({ message: 'Se requieren el código de asignatura y el número de período.' });
    }
    const weeks = await semanaService.findWeeksByCourseAndPeriod(Number(codigoAsignatura), Number(numeroPeriodo), user.codigo, user.perfil);
    res.status(200).json(weeks);
});
// Crear semanas
exports.addWeeks = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const weeksData = req.body;
    if (!Array.isArray(weeksData) || weeksData.length === 0) {
        return res.status(400).json({ message: 'Se requiere un array de semanas.' });
    }
    console.log('Datos recibidos para crear semanas:', JSON.stringify(weeksData, null, 2));
    await semanaService.createWeeks(weeksData);
    res.status(201).json({ message: 'Semanas creadas exitosamente.' });
});
// Actualizar semana
exports.updateWeek = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ message: 'Se requiere el nuevo nombre.' });
    await semanaService.updateWeekName(Number(id), name);
    res.status(200).json({ message: 'Semana actualizada exitosamente.' });
});
// Eliminar semana
exports.deleteWeek = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await semanaService.deleteWeekById(Number(id));
    res.status(200).json({ message: 'Semana eliminada exitosamente.' });
});
exports.cloneWeek = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await semanaService.cloneWeekById(Number(id));
    res.status(201).json({ message: 'Semana clonada exitosamente.' });
});

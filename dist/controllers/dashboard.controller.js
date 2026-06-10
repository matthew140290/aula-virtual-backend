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
exports.getPeriodosResumen = exports.getActividadReciente = exports.getEstudiantesSinConexion = exports.getDocentesSinCalificar = exports.getResumenGeneral = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const dashboardService = __importStar(require("../services/dashboard.service"));
exports.getResumenGeneral = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const resumen = await dashboardService.getResumenGeneral();
    res.status(200).json(resumen);
});
exports.getDocentesSinCalificar = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const docentes = await dashboardService.getDocentesSinCalificar();
    res.status(200).json(docentes);
});
exports.getEstudiantesSinConexion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const raw = Number(req.query.dias);
    const dias = !isNaN(raw) && raw > 0 ? raw : 7;
    const estudiantes = await dashboardService.getEstudiantesSinConexion(dias);
    res.status(200).json(estudiantes);
});
exports.getActividadReciente = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const raw = Number(req.query.limite);
    const limite = !isNaN(raw) && raw > 0 ? Math.min(raw, 100) : 20;
    const actividad = await dashboardService.getActividadReciente(limite);
    res.status(200).json(actividad);
});
exports.getPeriodosResumen = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const periodos = await dashboardService.getPeriodosResumen();
    res.status(200).json(periodos);
});

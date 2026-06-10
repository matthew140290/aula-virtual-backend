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
exports.cloneApartado = exports.togglePin = exports.deleteApartado = exports.updateApartado = exports.getApartados = exports.createApartado = void 0;
const apartadoService = __importStar(require("../services/apartado.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.createApartado = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { semanaId, titulo, tipoApartado } = req.body || {};
    if (!semanaId || !titulo) {
        return res.status(400).json({ message: 'Faltan datos (semanaId, titulo).' });
    }
    const { newApartadoId } = await apartadoService.createApartado({
        semanaId: Number(semanaId),
        nombre: String(titulo),
        tipoApartado: tipoApartado ? String(tipoApartado) : undefined,
    });
    res.status(201).json({ message: 'Apartado creado exitosamente.', newApartadoId });
});
exports.getApartados = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { codigoAsignatura } = req.query;
    if (!codigoAsignatura) {
        return res.status(400).json({ message: 'Se requiere el código de asignatura.' });
    }
    const apartados = await apartadoService.findApartadosByAsignatura(Number(codigoAsignatura));
    res.status(200).json(apartados);
});
exports.updateApartado = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Se requiere el nuevo nombre del apartado.' });
    }
    await apartadoService.updateApartadoName(Number(id), name);
    res.status(200).json({ message: 'Apartado actualizado exitosamente.' });
});
exports.deleteApartado = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await apartadoService.deleteApartadoById(Number(id));
    res.status(200).json({ message: 'Apartado eliminado exitosamente.' });
});
exports.togglePin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await apartadoService.toggleApartadoPin(Number(id));
    res.status(200).json({ message: 'Estado de fijado cambiado exitosamente.' });
});
exports.cloneApartado = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await apartadoService.cloneApartadoById(Number(id));
    res.status(201).json({ message: 'Apartado clonado exitosamente.' });
});

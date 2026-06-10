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
exports.deleteNotificaciones = exports.marcarNotificacionesLeidas = exports.getMisNotificaciones = void 0;
const notificacionService = __importStar(require("../services/notificacion.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getMisNotificaciones = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado' });
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const result = await notificacionService.getNotificaciones(req.user, page, limit);
    res.status(200).json(result);
});
exports.marcarNotificacionesLeidas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado' });
    const { ids } = req.body; // Se espera un array opcional de IDs
    await notificacionService.marcarComoLeidas(req.user, ids);
    res.status(200).json({ message: 'Notificaciones marcadas como leídas.' });
});
exports.deleteNotificaciones = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const ids = req.body.ids;
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado.' });
    }
    await notificacionService.deleteNotificaciones(user, ids);
    const mensaje = ids && ids.length > 0
        ? 'Notificaciones eliminadas correctamente.'
        : 'Bandeja de notificaciones vaciada.';
    res.status(200).json({ message: mensaje });
});

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
exports.getMiFoto = exports.getFotoByUsuario = exports.uploadMiFoto = exports.getMiPerfil = void 0;
const usuarioService = __importStar(require("../services/usuario.service"));
const log_service_1 = require("../services/log.service");
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getMiPerfil = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado' });
    console.log('--- Controlador getMiPerfil: req.user recibido del token ---', req.user);
    const perfilData = await usuarioService.findUserById(req.user.codigo, req.user.perfil);
    res.status(200).json(perfilData);
});
exports.uploadMiFoto = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado' });
    if (!req.file)
        return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
    await usuarioService.updateUserPhoto(req.user.codigo, req.user.perfil, req.file.buffer);
    await (0, log_service_1.registrarAccion)(req.user.codigo, req.user.perfil, 'Perfil de Usuario', 'Mi Perfil', 'Actualizó su foto de perfil');
    res.status(200).json({ message: 'Foto de perfil actualizada con éxito.' });
});
exports.getFotoByUsuario = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const codigo = Number(req.params.codigo);
    const perfil = req.query.perfil;
    if (!codigo || !perfil) {
        return res.status(400).json({ message: 'Código y perfil son requeridos.' });
    }
    const photoBuffer = await usuarioService.findUserPhotoById(codigo, perfil);
    if (photoBuffer) {
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600'); // Cache 1 hora para no bombardear la BD
        res.send(photoBuffer);
    }
    else {
        res.status(204).send();
    }
});
exports.getMiFoto = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autorizado' });
    const photoBuffer = await usuarioService.findUserPhotoById(req.user.codigo, req.user.perfil);
    if (photoBuffer) {
        res.set('Content-Type', 'image/jpeg');
        res.send(photoBuffer);
    }
    else {
        res.status(204).send();
    }
});

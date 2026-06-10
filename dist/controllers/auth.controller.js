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
exports.toggleStudentView = exports.ssoLogin = exports.login = void 0;
const authService = __importStar(require("../services/auth.service"));
const estudianteService = __importStar(require("../services/estudiante.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
const roles_1 = require("../constants/roles");
const authToken_1 = require("../config/authToken");
const tenantContext_1 = require("../config/tenantContext");
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nombre, contrasena } = req.body;
    try {
        const { token, user } = await authService.processLogin(nombre, contrasena);
        console.log(`✅ [AUTH_SUCCESS] ${user.perfil} ${user.nombre} inició sesión.`);
        res.status(200).json({ message: 'Inicio de sesión exitoso.', token, user });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'CredencialesIncorrectas') {
            console.warn(`🔒 [AUTH_FAILED] Intento fallido para el usuario: "${nombre}". IP: ${req.ip}`);
            res.status(401).json({ message: 'Usuario o contraseña incorrecta.' });
        }
        else {
            // Si es un error de Base de Datos (ej. SQL Server offline), lo lanzamos al Global Error Handler
            throw error;
        }
    }
});
exports.ssoLogin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { token: ssoToken } = req.body;
    try {
        const decoded = (0, authToken_1.verifyUserToken)(ssoToken);
        if (decoded.tenantId !== (0, tenantContext_1.getTenantId)()) {
            return res.status(403).json({ message: 'El token SSO no pertenece a este tenant.' });
        }
        const sessionTokenPayload = {
            codigo: decoded.codigo,
            perfil: decoded.perfil,
            nombre: decoded.nombre,
            nombreCompleto: decoded.nombreCompleto,
            tenantId: decoded.tenantId,
        };
        const sessionToken = (0, authToken_1.signUserToken)(sessionTokenPayload, '8h');
        console.log(`✅ [SSO_SUCCESS] ${decoded.nombre} autenticado vía SSO.`);
        res.status(200).json({
            message: 'Autenticación SSO exitosa.',
            token: sessionToken,
            user: sessionTokenPayload
        });
    }
    catch (error) {
        console.warn(`🔒 [SSO_FAILED] Intento de SSO fallido con token inválido/expirado. IP: ${req.ip}`);
        res.status(401).json({ message: 'Token de SSO inválido o expirado.' });
    }
});
exports.toggleStudentView = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const originalToken = req.cookies.originalToken;
    // --- VOLVER A LA VISTA ORIGINAL ---
    if (originalToken) {
        res.cookie('originalToken', '', { expires: new Date(0) });
        const decodedOriginal = (0, authToken_1.verifyUserToken)(originalToken);
        if (decodedOriginal.tenantId !== (0, tenantContext_1.getTenantId)()) {
            return res.status(403).json({ message: 'La sesion original no pertenece a este tenant.' });
        }
        return res.status(200).json({ token: originalToken, user: decodedOriginal });
    }
    // --- CAMBIAR A VISTA DE ESTUDIANTE ---
    const allowedRolesToToggle = new Set([
        roles_1.ROLES.DOCENTE,
        roles_1.ROLES.DIRECTOR_GRUPO,
        roles_1.ROLES.COORDINADOR,
        roles_1.ROLES.COORDINADOR_GENERAL,
        roles_1.ROLES.ADMINISTRADOR,
        roles_1.ROLES.MASTER,
    ].map(roles_1.normalizeRole));
    // Validamos usando nuestras constantes estrictas
    if (allowedRolesToToggle.has((0, roles_1.normalizeRole)(req.user.perfil))) {
        const currentToken = req.headers.authorization?.split(' ')[1];
        if (!currentToken)
            throw new Error('Token actual no encontrado.');
        const contexto = await estudianteService.findContextoAcademicoByDocente(req.user.codigo);
        const studentContext = contexto || {
            NombreGrado: 'Grado General',
            NombreCurso: 'Institucional',
        };
        const studentViewPayload = {
            codigo: req.user.codigo,
            nombre: req.user.nombre,
            nombreCompleto: req.user.nombreCompleto,
            perfil: roles_1.ROLES.ESTUDIANTE,
            tenantId: req.user.tenantId,
            originalPerfil: req.user.perfil,
            contexto: studentContext,
        };
        const studentToken = (0, authToken_1.signUserToken)(studentViewPayload, '1h');
        res.cookie('originalToken', currentToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 // 1 hora
        });
        console.log(`🔄 [VIEW_TOGGLE] ${req.user.nombre} cambió a vista de estudiante.`);
        return res.status(200).json({ token: studentToken, user: studentViewPayload });
    }
    console.warn(`🛑 [VIEW_TOGGLE_DENIED] El usuario ${req.user.nombre} (${req.user.perfil}) intentó cambiar de vista sin permisos.`);
    return res.status(403).json({ message: 'Función no permitida para tu perfil actual.' });
});

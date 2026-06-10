"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.protect = void 0;
const roles_1 = require("../constants/roles");
const authToken_1 = require("../config/authToken");
const tenantContext_1 = require("../config/tenantContext");
const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const bearer = authHeader?.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : undefined;
        const cookieToken = typeof req.cookies?.access_token === 'string'
            ? req.cookies.access_token
            : undefined;
        const token = bearer || cookieToken;
        if (!token) {
            return res.status(401).json({ message: 'No autorizado, no se encontro token.' });
        }
        const decoded = (0, authToken_1.verifyUserToken)(token);
        if (decoded.tenantId !== (0, tenantContext_1.getTenantId)()) {
            return res.status(403).json({ message: 'El token no pertenece a este tenant.' });
        }
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ message: 'No autorizado, token invalido o expirado.' });
    }
};
exports.protect = protect;
const authorize = (allowedRoles) => {
    const normalizedAllowed = allowedRoles.map(roles_1.normalizeRole);
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado. Se requiere autenticacion.' });
        }
        if (!normalizedAllowed.includes((0, roles_1.normalizeRole)(req.user.perfil))) {
            return res.status(403).json({
                message: 'Acceso prohibido: no tienes los permisos necesarios.',
            });
        }
        next();
    };
};
exports.authorize = authorize;

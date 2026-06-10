"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUserToken = exports.signUserToken = exports.assertAuthConfiguration = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const tenantRegistry_1 = require("./tenantRegistry");
const TOKEN_ISSUER = 'aula-virtual';
const TOKEN_AUDIENCE = 'aula-virtual-api';
const userTokenSchema = zod_1.z.object({
    codigo: zod_1.z.number().int(),
    perfil: zod_1.z.string().trim().min(1).max(96),
    nombre: zod_1.z.string().trim().min(1).max(255),
    nombreCompleto: zod_1.z.string().trim().min(1).max(255),
    tenantId: zod_1.z.string().transform(tenantRegistry_1.normalizeTenantId),
    originalPerfil: zod_1.z.string().trim().min(1).max(96).optional(),
    contexto: zod_1.z.object({
        NombreGrado: zod_1.z.string(),
        NombreCurso: zod_1.z.string(),
    }).optional(),
});
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres.');
    }
    return secret;
};
exports.getJwtSecret = getJwtSecret;
const assertAuthConfiguration = () => {
    (0, exports.getJwtSecret)();
};
exports.assertAuthConfiguration = assertAuthConfiguration;
const signUserToken = (payload, expiresIn) => jsonwebtoken_1.default.sign(payload, (0, exports.getJwtSecret)(), {
    algorithm: 'HS256',
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
    expiresIn,
});
exports.signUserToken = signUserToken;
const verifyUserToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, (0, exports.getJwtSecret)(), {
        algorithms: ['HS256'],
        audience: TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
    });
    return userTokenSchema.parse(decoded);
};
exports.verifyUserToken = verifyUserToken;

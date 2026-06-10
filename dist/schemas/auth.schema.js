"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ssoSchema = exports.loginSchema = void 0;
// src/schemas/auth.schema.ts
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        nombre: zod_1.z.string().min(1, 'El nombre de usuario es requerido').trim(),
        contrasena: zod_1.z.string().min(1, 'La contraseña es requerida').trim()
    })
});
exports.ssoSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1, 'Token de SSO no proporcionado.')
    })
});

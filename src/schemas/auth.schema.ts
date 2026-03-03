// src/schemas/auth.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        nombre: z.string().min(1, 'El nombre de usuario es requerido').trim(),
        contrasena: z.string().min(1, 'La contraseña es requerida').trim()
    })
});

export const ssoSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'Token de SSO no proporcionado.')
    })
});
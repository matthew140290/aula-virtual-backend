"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recursoVideoconferenciaSchema = exports.recursoAnuncioSchema = exports.recursoVideoSchema = exports.recursoUrlSchema = void 0;
// src/schemas/recurso.schema.ts
const zod_1 = require("zod");
// Esquema base para los campos comunes de todos los recursos
const recursoBaseSchema = zod_1.z.object({
    apartadoId: zod_1.z.number().positive('El ID del apartado es requerido'),
    titulo: zod_1.z.string().min(1, 'El título es requerido').max(1024),
    contenido: zod_1.z.string().optional().default(''),
    fechaPublicacion: zod_1.z.string().datetime({ message: 'Fecha de publicación inválida' }).or(zod_1.z.date()),
    esPersonalizado: zod_1.z.boolean().default(false),
    estudiantesIds: zod_1.z.array(zod_1.z.number()).optional().default([]),
    whatsappTarget: zod_1.z.enum(['NONE', 'STUDENT_ONLY', 'GUARDIAN_ONLY', 'BOTH']).optional().default('NONE')
});
exports.recursoUrlSchema = zod_1.z.object({
    body: recursoBaseSchema.extend({
        urlExterna: zod_1.z.string().url('Debe ser una URL válida')
    })
});
exports.recursoVideoSchema = zod_1.z.object({
    body: recursoBaseSchema.extend({
        urlVideo: zod_1.z.string().url('Debe ser una URL válida de video')
    })
});
exports.recursoAnuncioSchema = zod_1.z.object({
    body: recursoBaseSchema.extend({
        fechaCierre: zod_1.z.string().datetime().nullable().optional(),
        permiteRespuestas: zod_1.z.boolean().default(true)
    })
});
exports.recursoVideoconferenciaSchema = zod_1.z.object({
    body: recursoBaseSchema.extend({
        modo: zod_1.z.enum(['jitsi', 'externo']),
        urlExterna: zod_1.z.string().url().nullable().optional(),
        fechaCierre: zod_1.z.string().datetime().nullable().optional()
    })
});

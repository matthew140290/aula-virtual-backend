// src/schemas/recurso.schema.ts
import { z } from 'zod';

// Esquema base para los campos comunes de todos los recursos
const recursoBaseSchema = z.object({
    apartadoId: z.number().positive('El ID del apartado es requerido'),
    titulo: z.string().min(1, 'El título es requerido').max(1024),
    contenido: z.string().optional().default(''),
    fechaPublicacion: z.string().datetime({ message: 'Fecha de publicación inválida' }).or(z.date()),
    esPersonalizado: z.boolean().default(false),
    estudiantesIds: z.array(z.number()).optional().default([]),
    whatsappTarget: z.enum(['NONE', 'STUDENT_ONLY', 'GUARDIAN_ONLY', 'BOTH']).optional().default('NONE')
});

export const recursoUrlSchema = z.object({
    body: recursoBaseSchema.extend({
        urlExterna: z.string().url('Debe ser una URL válida')
    })
});

export const recursoVideoSchema = z.object({
    body: recursoBaseSchema.extend({
        urlVideo: z.string().url('Debe ser una URL válida de video')
    })
});

export const recursoAnuncioSchema = z.object({
    body: recursoBaseSchema.extend({
        fechaCierre: z.string().datetime().nullable().optional(),
        permiteRespuestas: z.boolean().default(true)
    })
});

export const recursoVideoconferenciaSchema = z.object({
    body: recursoBaseSchema.extend({
        modo: z.enum(['jitsi', 'externo']),
        urlExterna: z.string().url().nullable().optional(),
        fechaCierre: z.string().datetime().nullable().optional()
    })
});
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entregarIntentoGlobalSchema = exports.updatePreguntaGlobalSchema = exports.generarPreguntasIaSchema = exports.createExamenGlobalSchema = void 0;
const zod_1 = require("zod");
const competenciaSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).max(100),
    peso: zod_1.z.number().positive().max(100),
});
exports.createExamenGlobalSchema = zod_1.z.object({
    body: zod_1.z.object({
        titulo: zod_1.z.string().min(5).max(255),
        descripcion: zod_1.z.string().max(4000).optional().default(''),
        periodicidad: zod_1.z.enum(['TRIMESTRAL', 'ANUAL']),
        trimestre: zod_1.z.number().int().min(1).max(4).nullable().optional(),
        anio: zod_1.z.number().int().min(2020).max(2100),
        duracionMinutos: zod_1.z.number().int().min(10).max(300),
        numeroIntentos: zod_1.z.number().int().min(1).max(5),
        fechaInicio: zod_1.z.string().datetime().or(zod_1.z.date()),
        fechaCierre: zod_1.z.string().datetime().or(zod_1.z.date()),
        competencias: zod_1.z.array(competenciaSchema).min(1).max(10),
    }),
});
exports.generarPreguntasIaSchema = zod_1.z.object({
    body: zod_1.z.object({
        tema: zod_1.z.string().min(3).max(200),
        textoBase: zod_1.z.string().min(20).max(12000),
        dificultad: zod_1.z.enum(['BAJA', 'MEDIA', 'ALTA']).default('MEDIA'),
        cantidad: zod_1.z.number().int().min(1).max(40),
        replaceDraft: zod_1.z.boolean().optional().default(true),
    }),
});
const opcionSchema = zod_1.z.object({
    letra: zod_1.z.enum(['A', 'B', 'C', 'D']),
    texto: zod_1.z.string().min(1).max(2000),
    esCorrecta: zod_1.z.boolean(),
});
exports.updatePreguntaGlobalSchema = zod_1.z.object({
    body: zod_1.z.object({
        textoPregunta: zod_1.z.string().min(8).max(6000),
        nombreCompetencia: zod_1.z.string().min(2).max(100),
        peso: zod_1.z.number().positive().max(100),
        explicacionRespuesta: zod_1.z.string().max(5000).optional().nullable(),
        opciones: zod_1.z.array(opcionSchema).length(4),
    }),
});
exports.entregarIntentoGlobalSchema = zod_1.z.object({
    body: zod_1.z.object({
        respuestas: zod_1.z.array(zod_1.z.object({
            preguntaGlobalId: zod_1.z.number().int().positive(),
            opcionId: zod_1.z.number().int().positive().nullable(),
        })).min(1),
        duracionSegundos: zod_1.z.number().int().min(0).max(24 * 60 * 60).optional(),
    }),
});

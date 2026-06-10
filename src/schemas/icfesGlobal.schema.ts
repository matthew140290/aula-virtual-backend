import { z } from 'zod';

const competenciaSchema = z.object({
  nombre: z.string().min(2).max(100),
  peso: z.number().positive().max(100),
});

export const createExamenGlobalSchema = z.object({
  body: z.object({
    titulo: z.string().min(5).max(255),
    descripcion: z.string().max(4000).optional().default(''),
    periodicidad: z.enum(['TRIMESTRAL', 'ANUAL']),
    trimestre: z.number().int().min(1).max(4).nullable().optional(),
    anio: z.number().int().min(2020).max(2100),
    duracionMinutos: z.number().int().min(10).max(300),
    numeroIntentos: z.number().int().min(1).max(5),
    fechaInicio: z.string().datetime().or(z.date()),
    fechaCierre: z.string().datetime().or(z.date()),
    competencias: z.array(competenciaSchema).min(1).max(10),
  }),
});

export const generarPreguntasIaSchema = z.object({
  body: z.object({
    tema: z.string().min(3).max(200),
    textoBase: z.string().min(20).max(12000),
    dificultad: z.enum(['BAJA', 'MEDIA', 'ALTA']).default('MEDIA'),
    cantidad: z.number().int().min(1).max(40),
    replaceDraft: z.boolean().optional().default(true),
  }),
});

const opcionSchema = z.object({
  letra: z.enum(['A', 'B', 'C', 'D']),
  texto: z.string().min(1).max(2000),
  esCorrecta: z.boolean(),
});

export const updatePreguntaGlobalSchema = z.object({
  body: z.object({
    textoPregunta: z.string().min(8).max(6000),
    nombreCompetencia: z.string().min(2).max(100),
    peso: z.number().positive().max(100),
    explicacionRespuesta: z.string().max(5000).optional().nullable(),
    opciones: z.array(opcionSchema).length(4),
  }),
});

export const entregarIntentoGlobalSchema = z.object({
  body: z.object({
    respuestas: z.array(z.object({
      preguntaGlobalId: z.number().int().positive(),
      opcionId: z.number().int().positive().nullable(),
    })).min(1),
    duracionSegundos: z.number().int().min(0).max(24 * 60 * 60).optional(),
  }),
});

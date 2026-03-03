// src/schemas/periodo.schema.ts
import { z } from 'zod';

export const configPeriodoSchema = z.object({
    body: z.object({
        fechaApertura: z.iso.datetime().nullable().optional().or(z.literal('')),
        fechaCierre: z.iso.datetime().nullable().optional().or(z.literal('')),
        bloqueadoManualmente: z.boolean().default(false)
    }).refine(data => {
        // Solo validamos rango si ambas fechas fueron enviadas
        if (data.fechaApertura && data.fechaCierre) {
            return new Date(data.fechaCierre) > new Date(data.fechaApertura);
        }
        return true;
    }, {
        message: "La fecha de cierre debe ser posterior a la fecha de apertura",
        path: ["fechaCierre"]
    })
});

export const excepcionPeriodoSchema = z.object({
    body: z.object({
        docentesIds: z.array(z.number().positive()).min(1, "Debes seleccionar al menos un docente"),
        fechaLimiteExcepcion: z.iso.datetime(),
        comentario: z.string().max(512).optional()
    })
});
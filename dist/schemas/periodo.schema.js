"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.excepcionPeriodoSchema = exports.configPeriodoSchema = void 0;
// src/schemas/periodo.schema.ts
const zod_1 = require("zod");
exports.configPeriodoSchema = zod_1.z.object({
    body: zod_1.z.object({
        fechaApertura: zod_1.z.iso.datetime().nullable().optional().or(zod_1.z.literal('')),
        fechaCierre: zod_1.z.iso.datetime().nullable().optional().or(zod_1.z.literal('')),
        bloqueadoManualmente: zod_1.z.boolean().default(false)
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
exports.excepcionPeriodoSchema = zod_1.z.object({
    body: zod_1.z.object({
        docentesIds: zod_1.z.array(zod_1.z.number().positive()).min(1, "Debes seleccionar al menos un docente"),
        fechaLimiteExcepcion: zod_1.z.iso.datetime(),
        comentario: zod_1.z.string().max(512).optional()
    })
});

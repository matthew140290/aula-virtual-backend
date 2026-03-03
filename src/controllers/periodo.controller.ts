// src/controllers/periodo.controller.ts
import { Request, Response } from 'express';
import * as periodoService from '../services/periodo.service';
import { asyncHandler } from '../utils/asyncHandler';

export const getAllPeriods = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

    const actor = { codigo: req.user.codigo, perfil: req.user.perfil };
    const periods = await periodoService.findAllPeriods(actor);
    res.status(200).json(periods);
});

export const configurarPeriodo = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

    const numeroPeriodo = Number(req.params.numeroPeriodo);
    if (isNaN(numeroPeriodo)) return res.status(400).json({ message: 'Número de período inválido.' });

    const { fechaApertura, fechaCierre, bloqueadoManualmente } = req.body;
    const actor = { codigo: req.user.codigo, perfil: req.user.perfil };

    await periodoService.configurarControlPeriodo(
        numeroPeriodo,
        fechaApertura ? new Date(fechaApertura) : null,
        fechaCierre ? new Date(fechaCierre) : null,
        bloqueadoManualmente,
        actor
    );

    res.status(200).json({ message: 'Período configurado exitosamente.' });
});

export const otorgarExcepcion = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

    const numeroPeriodo = Number(req.params.numeroPeriodo);
    if (isNaN(numeroPeriodo)) return res.status(400).json({ message: 'Número de período inválido.' });

    const { docentesIds, fechaLimiteExcepcion, comentario } = req.body;

    if (!Array.isArray(docentesIds) || docentesIds.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un docente.' });
    }

    if (!fechaLimiteExcepcion) {
        return res.status(400).json({ message: 'La fecha límite es requerida.' });
    }

    const actor = { codigo: req.user.codigo, perfil: req.user.perfil };

    await periodoService.otorgarExcepcionDocentes(
        numeroPeriodo,
        docentesIds as number[],
        new Date(fechaLimiteExcepcion),
        comentario || '',
        actor
    );

    res.status(200).json({ message: 'Excepción otorgada exitosamente a los docentes seleccionados.' });
});

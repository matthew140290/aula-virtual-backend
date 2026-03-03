// src/controllers/expedienteEstudiantil.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as expedienteService from '../services/expedienteEstudiantil.service';

export const buscarEstudiantes = asyncHandler(async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';

    if (query.trim().length < 2) {
        res.status(200).json([]);
        return;
    }

    const estudiantes = await expedienteService.buscarEstudiantes(query);
    res.status(200).json(estudiantes);
});

export const getExpediente = asyncHandler(async (req: Request, res: Response) => {
    const matriculaNo = Number(req.params.matriculaNo);

    if (!matriculaNo || isNaN(matriculaNo)) {
        res.status(400).json({ message: 'MatrículaNo inválido.' });
        return;
    }

    const [infoBasica, resumenAcademico] = await Promise.all([
        expedienteService.getInfoBasica(matriculaNo),
        expedienteService.getResumenAcademico(matriculaNo),
    ]);

    if (!infoBasica) {
        res.status(404).json({ message: 'Estudiante no encontrado.' });
        return;
    }

    res.status(200).json({ infoBasica, resumenAcademico });
});

export const getActividad = asyncHandler(async (req: Request, res: Response) => {
    const matriculaNo = Number(req.params.matriculaNo);

    if (!matriculaNo || isNaN(matriculaNo)) {
        res.status(400).json({ message: 'MatrículaNo inválido.' });
        return;
    }

    const rawLimite = Number(req.query.limite);
    const limite = !isNaN(rawLimite) && rawLimite > 0 ? Math.min(rawLimite, 500) : 100;

    const timeline = await expedienteService.getTimelineActividad(matriculaNo, limite);
    res.status(200).json(timeline);
});
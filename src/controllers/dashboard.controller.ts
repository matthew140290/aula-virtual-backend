// src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as dashboardService from '../services/dashboard.service';

export const getResumenGeneral = asyncHandler(async (_req: Request, res: Response) => {
    const resumen = await dashboardService.getResumenGeneral();
    res.status(200).json(resumen);
});

export const getDocentesSinCalificar = asyncHandler(async (_req: Request, res: Response) => {
    const docentes = await dashboardService.getDocentesSinCalificar();
    res.status(200).json(docentes);
});

export const getEstudiantesSinConexion = asyncHandler(async (req: Request, res: Response) => {
    const raw = Number(req.query.dias);
    const dias = !isNaN(raw) && raw > 0 ? raw : 7;
    const estudiantes = await dashboardService.getEstudiantesSinConexion(dias);
    res.status(200).json(estudiantes);
});

export const getActividadReciente = asyncHandler(async (req: Request, res: Response) => {
    const raw = Number(req.query.limite);
    const limite = !isNaN(raw) && raw > 0 ? Math.min(raw, 100) : 20;
    const actividad = await dashboardService.getActividadReciente(limite);
    res.status(200).json(actividad);
});

export const getPeriodosResumen = asyncHandler(async (_req: Request, res: Response) => {
    const periodos = await dashboardService.getPeriodosResumen();
    res.status(200).json(periodos);
});

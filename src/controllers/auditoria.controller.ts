// src/controllers/auditoria.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as auditoriaService from '../services/auditoria.service';

export const getDocentesStats = asyncHandler(async (req: Request, res: Response) => {
    const docentes = await auditoriaService.getDocentesAuditoriaStats();
    res.status(200).json(docentes);
});
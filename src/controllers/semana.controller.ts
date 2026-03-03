// src/controllers/semana.controller.ts
import { Request, Response } from 'express';
import * as semanaService from '../services/semana.service';
import { asyncHandler } from '../utils/asyncHandler';

// Obtener semanas
export const getWeeks = asyncHandler(async (req: Request, res: Response) => {
  const { codigoAsignatura, numeroPeriodo } = req.query;
  const user = req.user!;

  if (!codigoAsignatura || !numeroPeriodo) {
    return res.status(400).json({ message: 'Se requieren el código de asignatura y el número de período.' });
  }
  
    const weeks = await semanaService.findWeeksByCourseAndPeriod(
      Number(codigoAsignatura), 
      Number(numeroPeriodo),
      user.codigo,
      user.perfil
  );
    res.status(200).json(weeks);
});



// Crear semanas
export const addWeeks = asyncHandler(async (req: Request, res: Response) => {
  const weeksData = req.body;

  if (!Array.isArray(weeksData) || weeksData.length === 0) {
    return res.status(400).json({ message: 'Se requiere un array de semanas.' });
  }

  console.log('Datos recibidos para crear semanas:', JSON.stringify(weeksData, null, 2));

    await semanaService.createWeeks(weeksData);
    res.status(201).json({ message: 'Semanas creadas exitosamente.' });
});



// Actualizar semana
export const updateWeek = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Se requiere el nuevo nombre.' });

    await semanaService.updateWeekName(Number(id), name);
    res.status(200).json({ message: 'Semana actualizada exitosamente.' });
});

// Eliminar semana
export const deleteWeek = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
    await semanaService.deleteWeekById(Number(id));
    res.status(200).json({ message: 'Semana eliminada exitosamente.' });
});

export const cloneWeek = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
    await semanaService.cloneWeekById(Number(id));
    res.status(201).json({ message: 'Semana clonada exitosamente.' });
});
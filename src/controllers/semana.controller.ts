// src/controllers/semana.controller.ts
import { Request, Response } from 'express';
import * as semanaService from '../services/semana.service';

// Obtener semanas
export const getWeeks = async (req: Request, res: Response) => {
  const { codigoAsignatura, numeroPeriodo } = req.query;
  if (!codigoAsignatura || !numeroPeriodo) {
    return res.status(400).json({ message: 'Se requieren el código de asignatura y el número de período.' });
  }
  
  try {
    const weeks = await semanaService.findWeeksByCourseAndPeriod(Number(codigoAsignatura), Number(numeroPeriodo));
    res.status(200).json(weeks);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};



// Crear semanas
export const addWeeks = async (req: Request, res: Response) => {
  const weeksData = req.body; // Se espera un array de objetos semana
  if (!Array.isArray(weeksData) || weeksData.length === 0) {
    return res.status(400).json({ message: 'Se requiere un array de semanas.' });
  }

  console.log('Datos recibidos para crear semanas:', JSON.stringify(weeksData, null, 2));

  try {
    await semanaService.createWeeks(weeksData);
    res.status(201).json({ message: 'Semanas creadas exitosamente.' });
  } catch (error) {
     // Si ocurre un error en el servicio, lo registramos aquí.
    console.error('Error al llamar al servicio createWeeks:', error);
    
    // Devolvemos el error en la respuesta para más detalles en el navegador
    res.status(500).json({ 
        message: 'Error interno del servidor al crear las semanas.',
        error: (error as Error).message // Enviamos el mensaje de error específico
    });
  }
};



// Actualizar semana
export const updateWeek = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Se requiere el nuevo nombre de la semana.' });
  }

  try {
    await semanaService.updateWeekName(Number(id), name);
    res.status(200).json({ message: 'Semana actualizada exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// Eliminar semana
export const deleteWeek = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    await semanaService.deleteWeekById(Number(id));
    res.status(200).json({ message: 'Semana eliminada exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const cloneWeek = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await semanaService.cloneWeekById(Number(id));
    res.status(201).json({ message: 'Semana clonada exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
// src/controllers/apartado.controller.ts
import { Request, Response } from 'express';
import * as apartadoService from '../services/apartado.service';
import { asyncHandler } from '../utils/asyncHandler';

export const createApartado = asyncHandler(async (req: Request, res: Response) => {
  const { semanaId, titulo, tipoApartado } = req.body || {};
  if (!semanaId || !titulo) {
    return res.status(400).json({ message: 'Faltan datos (semanaId, titulo).' });
  }
    const { newApartadoId } = await apartadoService.createApartado({
      semanaId: Number(semanaId),
      nombre: String(titulo),
      tipoApartado: tipoApartado ? String(tipoApartado) : undefined,
    });

    res.status(201).json({ message: 'Apartado creado exitosamente.', newApartadoId });
});

export const getApartados = asyncHandler(async (req: Request, res: Response) => {
  const { codigoAsignatura } = req.query;
  if (!codigoAsignatura) {
    return res.status(400).json({ message: 'Se requiere el código de asignatura.' });
  }
    const apartados = await apartadoService.findApartadosByAsignatura(Number(codigoAsignatura));
    res.status(200).json(apartados);
});

export const updateApartado = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Se requiere el nuevo nombre del apartado.' });
  }
    await apartadoService.updateApartadoName(Number(id), name);

    res.status(200).json({ message: 'Apartado actualizado exitosamente.' });
});

export const deleteApartado = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
    await apartadoService.deleteApartadoById(Number(id));

    res.status(200).json({ message: 'Apartado eliminado exitosamente.' });
});

export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
    await apartadoService.toggleApartadoPin(Number(id));
    
    res.status(200).json({ message: 'Estado de fijado cambiado exitosamente.' });
});

export const cloneApartado = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
    await apartadoService.cloneApartadoById(Number(id));
    
    res.status(201).json({ message: 'Apartado clonado exitosamente.' });
});
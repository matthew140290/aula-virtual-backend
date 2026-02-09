// src/controllers/apartado.controller.ts
import { Request, Response } from 'express';
import * as apartadoService from '../services/apartado.service';

export const createApartado = async (req: Request, res: Response) => {
  const { semanaId, titulo, tipoApartado } = req.body || {};
  if (!semanaId || !titulo) {
    return res.status(400).json({ message: 'Faltan datos (semanaId, titulo).' });
  }
  try {
    const { newApartadoId } = await apartadoService.createApartado({
      semanaId: Number(semanaId),
      nombre: String(titulo),
      tipoApartado: tipoApartado ? String(tipoApartado) : undefined,
    });
    res.status(201).json({ message: 'Apartado creado exitosamente.', newApartadoId });
  } catch {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const getApartados = async (req: Request, res: Response) => {
  const { codigoAsignatura } = req.query;
  if (!codigoAsignatura) {
    return res.status(400).json({ message: 'Se requiere el código de asignatura.' });
  }
  try {
    const apartados = await apartadoService.findApartadosByAsignatura(Number(codigoAsignatura));
    res.status(200).json(apartados);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const updateApartado = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Se requiere el nuevo nombre del apartado.' });
  }
  try {
    await apartadoService.updateApartadoName(Number(id), name);
    res.status(200).json({ message: 'Apartado actualizado exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const deleteApartado = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await apartadoService.deleteApartadoById(Number(id));
    res.status(200).json({ message: 'Apartado eliminado exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const togglePin = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await apartadoService.toggleApartadoPin(Number(id));
    res.status(200).json({ message: 'Estado de fijado cambiado exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const cloneApartado = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await apartadoService.cloneApartadoById(Number(id));
    res.status(201).json({ message: 'Apartado clonado exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
// src/controllers/periodo.controller.ts
import { Request, Response } from 'express';
import * as periodoService from '../services/periodo.service';

export const getAllPeriods = async (req: Request, res: Response) => {
  try {
    const periods = await periodoService.findAllPeriods();
    res.status(200).json(periods);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
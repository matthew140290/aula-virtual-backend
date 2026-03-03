// src/controllers/anuncioInstitucional.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as anuncioInstitucionalService from '../services/anuncioInstitucional.service';

export const getAnunciosInstitucionales = asyncHandler(async (req: Request, res: Response) => {
    const anuncios = await anuncioInstitucionalService.getAnunciosInstitucionales();
    res.status(200).json(anuncios);
});

export const createAnuncioInstitucional = asyncHandler(async (req: Request, res: Response) => {
    const { titulo, contenido } = req.body;
    const { codigo, perfil } = req.user!; 

    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }

    const nuevoAnuncio = await anuncioInstitucionalService.createAnuncioInstitucional(titulo, contenido, codigo, perfil);
    res.status(201).json(nuevoAnuncio);
});

export const updateAnuncioInstitucional = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { titulo, contenido } = req.body;
    const { codigo, perfil } = req.user!; 

    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de anuncio inválido.' });
    }

    const anuncioActualizado = await anuncioInstitucionalService.updateAnuncioInstitucional(id, titulo, contenido, codigo, perfil);
    res.status(200).json(anuncioActualizado);
});

export const deleteAnuncioInstitucional = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { codigo, perfil } = req.user!; 

    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de anuncio inválido.' });
    }

    await anuncioInstitucionalService.deleteAnuncioInstitucional(id, codigo, perfil);
    res.status(204).send();
});

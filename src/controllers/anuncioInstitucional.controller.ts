// src/controllers/anuncioInstitucional.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as anuncioInstitucionalService from '../services/anuncioInstitucional.service';

export const getAnunciosInstitucionales = asyncHandler(async (req: Request, res: Response) => {
    const { codigo, perfil } = req.user!;
    const anuncios = await anuncioInstitucionalService.getAnunciosInstitucionales(codigo, perfil);
    res.status(200).json(anuncios);
});

export const createAnuncioInstitucional = asyncHandler(async (req: Request, res: Response) => {
    const { titulo, contenido, destinatarios } = req.body;
    const { codigo, perfil } = req.user!; 

    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }

    const nuevoAnuncio = await anuncioInstitucionalService.createAnuncioInstitucional(titulo, contenido, codigo, perfil, destinatarios);
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

export const getAudienciaData = asyncHandler(async (req: Request, res: Response) => {
    const data = await anuncioInstitucionalService.getAudienciaData();
    res.status(200).json(data);
});

export const getHierarchyData = asyncHandler(async (req: Request, res: Response) => {
    const tipo = req.query.tipo as 'Estudiantes' | 'Docentes';
    if (!tipo) return res.status(400).json({ message: 'El tipo es requerido.' });
    const data = await anuncioInstitucionalService.getHierarchyData(tipo);
    res.status(200).json(data);
});

export const getDocentes = asyncHandler(async (req: Request, res: Response) => {
    const docentes = await anuncioInstitucionalService.getDocentes();
    res.status(200).json(docentes);
});

export const getEstudiantes = asyncHandler(async (req: Request, res: Response) => {
    const estudiantes = await anuncioInstitucionalService.getEstudiantes();
    res.status(200).json(estudiantes);
});

export const getCargaDocente = asyncHandler(async (req: Request, res: Response) => {
    const codigo = Number(req.params.codigo);
    if (isNaN(codigo)) {
        return res.status(400).json({ message: 'Código de docente inválido.' });
    }
    const carga = await anuncioInstitucionalService.getCargaDocente(codigo);
    res.status(200).json(carga);
});

export const buscarUsuarios = asyncHandler(async (req: Request, res: Response) => {
    const termino = req.query.q as string;
    if (!termino || termino.length < 2) {
        return res.status(200).json([]);
    }
    const usuarios = await anuncioInstitucionalService.buscarUsuarios(termino);
    res.status(200).json(usuarios);
});

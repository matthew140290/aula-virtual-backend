// src/controllers/usuario.controller.ts
import { Request, Response } from 'express';
import * as usuarioService from '../services/usuario.service';
import { registrarAccion } from '../services/log.service';
import { asyncHandler } from '../utils/asyncHandler';

export const getMiPerfil = asyncHandler(async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });
        console.log('--- Controlador getMiPerfil: req.user recibido del token ---', req.user);
        const perfilData = await usuarioService.findUserById(req.user.codigo, req.user.perfil);
        res.status(200).json(perfilData);
})

export const uploadMiFoto = asyncHandler(async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });
        if (!req.file) return res.status(400).json({ message: 'No se ha subido ningún archivo.' });

        await usuarioService.updateUserPhoto(req.user.codigo, req.user.perfil, req.file.buffer);
        
        await registrarAccion(req.user.codigo, req.user.perfil, 'Perfil de Usuario', 'Mi Perfil', 'Actualizó su foto de perfil');

        res.status(200).json({ message: 'Foto de perfil actualizada con éxito.' });
});

export const getFotoByUsuario = asyncHandler(async (req: Request, res: Response) => {
        const codigo = Number(req.params.codigo);
        const perfil = req.query.perfil as string;

        if (!codigo || !perfil) {
            return res.status(400).json({ message: 'Código y perfil son requeridos.' });
        }

        const photoBuffer = await usuarioService.findUserPhotoById(codigo, perfil);

        if (photoBuffer) {
            res.set('Content-Type', 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=3600'); // Cache 1 hora para no bombardear la BD
            res.send(photoBuffer);
        } else {
            res.status(204).send();
        }
});

export const getMiFoto = asyncHandler(async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });
        
        const photoBuffer = await usuarioService.findUserPhotoById(req.user.codigo, req.user.perfil);

        if (photoBuffer) {
            res.set('Content-Type', 'image/jpeg');
            res.send(photoBuffer);
        } else {
            res.status(204).send();
        }
});
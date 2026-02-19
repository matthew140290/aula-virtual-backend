// src/controllers/usuario.controller.ts
import { Request, Response } from 'express';
import * as usuarioService from '../services/usuario.service';
import { registrarAccion } from '../services/log.service';

export const getMiPerfil = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });
        console.log('--- Controlador getMiPerfil: req.user recibido del token ---', req.user);
        const perfilData = await usuarioService.findUserById(req.user.codigo, req.user.perfil);
        res.status(200).json(perfilData);
    } catch (error) { 
        console.error('!!!!!!!!!! ERROR ATRAPADO EN EL CONTROLADOR getMiPerfil !!!!!!!!!!', error);
        res.status(500).json({ message: 'Error interno del servidor.' }); 
    }
}

export const uploadMiFoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });
        if (!req.file) return res.status(400).json({ message: 'No se ha subido ningún archivo.' });

        await usuarioService.updateUserPhoto(req.user.codigo, req.user.perfil, req.file.buffer);
        
        await registrarAccion(req.user.codigo, req.user.perfil, 'Perfil de Usuario', 'Mi Perfil', 'Actualizó su foto de perfil');

        res.status(200).json({ message: 'Foto de perfil actualizada con éxito.' });
    } catch (error) { res.status(500).json({ message: 'Error al subir la foto.' }); }
};

export const getMiFoto = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });
        
        const photoBuffer = await usuarioService.findUserPhotoById(req.user.codigo, req.user.perfil);

        if (photoBuffer) {
            res.set('Content-Type', 'image/jpeg'); // O el tipo de imagen que guardes
            res.send(photoBuffer);
        } else {
            res.status(204).send();
        }
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
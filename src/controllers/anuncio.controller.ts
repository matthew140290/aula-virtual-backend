// src/controllers/anuncio.controller.ts
import { Request, Response } from 'express';
import * as anuncioService from '../services/anuncio.service';
import { notificarDocentePorInteraccion } from '../services/notificacion.service';

export const getRespuestas = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const respuestas = await anuncioService.getRespuestasAnuncio(recursoId);
        res.status(200).json(respuestas);
    } catch (error) {
        console.error('Error obteniendo respuestas de anuncio:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const crearRespuesta = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

        const recursoId = Number(req.params.recursoId);
        const contenido = req.body.contenido; 

        if (!contenido) return res.status(400).json({ message: 'El contenido es requerido.' });

        await anuncioService.crearRespuestaAnuncio(
            recursoId, 
            req.user.codigo, 
            req.user.perfil, 
            contenido
        );

        if (req.user.perfil === 'Estudiante') {
            notificarDocentePorInteraccion(
                recursoId,
                { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto },
                'ANUNCIO_RESPUESTA'
            ).catch(console.error); // No bloqueamos la respuesta ("Fire and forget")
        }

        res.status(201).json({ message: 'Comentario publicado.' });
    } catch (error) {
        console.error('Error publicando respuesta en anuncio:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const eliminarRespuesta = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
        
        const respuestaId = Number(req.params.respuestaId);
        
        const exito = await anuncioService.eliminarRespuestaAnuncio(
            respuestaId,
            req.user.codigo,
            req.user.perfil
        );

        if (exito) {
            res.status(200).json({ message: 'Comentario eliminado.' });
        } else {
            res.status(403).json({ message: 'No tienes permiso para eliminar este comentario.' });
        }
    } catch (error) {
        console.error('Error eliminando respuesta:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
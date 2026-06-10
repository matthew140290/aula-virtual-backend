// src/controllers/anuncio.controller.ts
import { Request, Response } from 'express';
import * as anuncioService from '../services/anuncio.service';
import * as recursoService from '../services/recurso.service';
import { notificarDocentePorInteraccion } from '../services/notificacion.service';
import { asyncHandler } from '../utils/asyncHandler';

const validarAccesoEstudiante = async (req: Request, res: Response, recursoId: number) => {
        if (req.user?.perfil !== 'Estudiante') return true;

        const puedeAcceder = await recursoService.estudiantePuedeAccederRecurso(recursoId, Number(req.user.codigo));
        if (!puedeAcceder) {
                res.status(404).json({ message: 'Anuncio no encontrado.' });
                return false;
        }

        return true;
};

export const getRespuestas = asyncHandler(async (req: Request, res: Response) => {
        const recursoId = Number(req.params.recursoId);
        if (!(await validarAccesoEstudiante(req, res, recursoId))) return;

        const respuestas = await anuncioService.getRespuestasAnuncio(recursoId);

        res.status(200).json(respuestas);
});

export const crearRespuesta = asyncHandler(async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

        const recursoId = Number(req.params.recursoId);
        if (!(await validarAccesoEstudiante(req, res, recursoId))) return;

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
});

export const eliminarRespuesta = asyncHandler(async (req: Request, res: Response) => {

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

});

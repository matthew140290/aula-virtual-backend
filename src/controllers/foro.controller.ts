//src/controller/foro.controller
import { Request, Response } from 'express';
import * as foroService from '../services/foro.service';
import { notificarDocentePorInteraccion } from '../services/notificacion.service';


export const getEntradas = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const entradas = await foroService.getEntradasDelForo(recursoId);
        res.status(200).json(entradas);
    } catch (error) {
        console.error('Error al obtener entradas del foro:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const crearEntrada = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado' });
        }

        
        const recursoId = Number(req.params.recursoId);
        
        // 💡 1. Los datos del formulario vienen como string JSON
        const { contenidoHTML, entradaPadreId } = JSON.parse(req.body.jsonData);
        // 💡 2. El archivo (opcional) viene en req.file
        const adjunto = req.file as Express.Multer.File | undefined;

        await foroService.crearNuevaEntrada({
            recursoId,
            contenidoHTML,
            entradaPadreId,
            usuarioId: req.user.codigo,
            perfilUsuario: req.user.perfil,
            adjunto // Pasamos el objeto File de multer
        }, { codigo: req.user.codigo, perfil: req.user.perfil });

        if (req.user.perfil === 'Estudiante') {
            notificarDocentePorInteraccion(
                recursoId,
                { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto },
                'FORO_PARTICIPACION'
            ).catch(console.error);
        }
        
        res.status(201).json({ message: 'Respuesta publicada con éxito.' });
    } catch (error) {
        console.error('Error al crear entrada del foro:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const actualizarUnaEntrada = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
        
        const entradaId = Number(req.params.entradaId);

        const { contenidoHTML, adjuntoAction } = JSON.parse(req.body.jsonData); 
        const nuevoAdjunto = req.file as Express.Multer.File | undefined;

        let adjuntoParam: Express.Multer.File | null | undefined = nuevoAdjunto;
        if (adjuntoAction === 'delete') {
            adjuntoParam = null; // null para borrar
        } else if (!nuevoAdjunto) {
            adjuntoParam = undefined; // undefined para no hacer cambios
        }
        console.log('--- Controlador actualizarUnaEntrada: adjuntoParam ---', adjuntoParam);
        
        const exito = await foroService.actualizarEntrada(entradaId, contenidoHTML, req.user.codigo, req.user.perfil, adjuntoParam);

        if (exito) {
            res.status(200).json({ message: 'Mensaje actualizado con éxito.' });
        } else {
            res.status(403).json({ message: 'No tienes permiso para editar este mensaje.' });
        }
    } catch (error) {
        console.error('Error al actualizar entrada:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const eliminarUnaEntrada = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

        const entradaId = Number(req.params.entradaId);
        const exito = await foroService.eliminarEntrada(entradaId, req.user.codigo, req.user.perfil);

        if (exito) {
            res.status(200).json({ message: 'Mensaje eliminado con éxito.' });
        } else {
            res.status(403).json({ message: 'No tienes permiso para eliminar este mensaje.' });
        }
    } catch (error) {
        console.error('Error al eliminar entrada:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const obtenerCalificaciones = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const calificaciones = await foroService.getCalificacionesForo(recursoId);
        res.status(200).json(calificaciones);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const calificarParticipacion = async (req: Request, res: Response) => {
    try {
        if (!req.user || !req.user.perfil.includes('Docente')) {
            return res.status(403).json({ message: 'No tienes permiso para calificar.' });
        }
        const recursoId = Number(req.params.recursoId);
        const { matriculaNo, calificacion, comentario } = req.body;
        await foroService.guardarCalificacion(recursoId, matriculaNo, calificacion, comentario);
        res.status(200).json({ message: 'Calificación guardada con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const getAdjuntoEntrada = async (req: Request, res: Response) => {
    try {
        const entradaId = Number(req.params.entradaId);
        const archivo = await foroService.findAdjuntoDeEntrada(entradaId);

        if (!archivo || !archivo.ImagenData) {
            return res.status(404).json({ message: 'Adjunto no encontrado.' });
        }

        res.setHeader('Content-Type', archivo.ImagenMimeType);
        res.send(archivo.ImagenData);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el adjunto.' });
    }
};
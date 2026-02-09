// src/controllers/tarea.controller.ts
import { Request, Response } from 'express';
import * as tareaService from '../services/tarea.service';
import { uploadGeneral } from './recurso.controller';
import { notificarDocentePorInteraccion } from '../services/notificacion.service';

export const getEntregasPorTarea = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.id);
        if (isNaN(recursoId)) {
            return res.status(400).json({ message: 'El ID del recurso-tarea debe ser un número válido.' });
        }

        const datosCalificacion = await tareaService.findEntregasByRecursoId(recursoId);
        res.status(200).json(datosCalificacion);
    } catch (error) {
        console.error('Error al obtener las entregas de la tarea:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const guardarCalificacion = async (req: Request, res: Response) => {
    try {
        const { tareaId, matriculaNo } = req.params;
        const { calificacion, comentariosProfesor } = req.body;

        await tareaService.upsertCalificacion({
            recursoId: Number(tareaId),
            matriculaNo: Number(matriculaNo),
            calificacion,
            comentariosProfesor
        });
        
        res.status(200).json({ message: 'Calificación guardada con éxito.' });
    } catch (error) {
        console.error('Error al guardar la calificación:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const crearEntrega = (req: Request, res: Response) => {
    uploadGeneral(req, res, async (err: any) => {
        if (err) return res.status(400).json({ message: err.message || 'Error al subir archivo' });

        try {
            const recursoId = Number(req.params.id); 
            const usuario = req.user;

            if (!usuario) return res.status(401).json({ message: 'No autorizado' });


            let bodyData = {};
            if (req.body.jsonData) {
                try {
                    bodyData = JSON.parse(req.body.jsonData);
                } catch (e) {
                    console.error("Error parseando JSON", e);
                }
            }


            await tareaService.guardarEntregaEstudiante({
                recursoId: recursoId,
                matriculaNo: usuario.codigo,
                contenidoHTML: (bodyData as any).contenidoHTML || '',
                archivo: req.file // Pasamos el buffer
            });

            notificarDocentePorInteraccion(
                recursoId,
                { codigo: usuario.codigo, nombreCompleto: usuario.nombreCompleto },
                'TAREA_ENTREGADA'
            ).catch(console.error);

            res.status(201).json({ message: 'Entrega realizada con éxito.' });

        } catch (error: any) {
            console.error('Error al crear entrega:', error);
            res.status(500).json({ message: error.message || 'Error interno' });
        }
    });
};

export const descargarEntrega = async (req: Request, res: Response) => {
    try {
        const entregaId = Number(req.params.id);
        if (isNaN(entregaId)) return res.status(400).json({ message: 'ID inválido' });

        const archivo = await tareaService.getArchivoEntregaById(entregaId);

        if (!archivo || !archivo.ArchivoData) {
            return res.status(404).json({ message: 'El archivo no existe o está dañado.' });
        }

        // Configurar headers para descarga
        res.setHeader('Content-Type', archivo.ArchivoMimeType || 'application/octet-stream');
        // encodeURIComponent evita errores con tildes o espacios
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(archivo.NombreArchivo)}"`);
        res.setHeader('Content-Length', archivo.ArchivoData.length);

        res.end(archivo.ArchivoData);

    } catch (error) {
        console.error('Error descargando entrega:', error);
        res.status(500).json({ message: 'Error interno al descargar archivo.' });
    }
};
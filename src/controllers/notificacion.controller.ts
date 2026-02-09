//src/controller/notificacion.controller
import { Request, Response } from 'express';
import * as notificacionService from '../services/notificacion.service';

export const getMisNotificaciones = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });

        const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

        const result = await notificacionService.getNotificaciones(req.user, page, limit);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor al obtener notificaciones.' });
    }
};

export const marcarNotificacionesLeidas = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });

        const { ids } = req.body; // Se espera un array opcional de IDs
        await notificacionService.marcarComoLeidas(req.user, ids);
        res.status(200).json({ message: 'Notificaciones marcadas como leídas.' });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor al marcar notificaciones.' });
    }
};

export const deleteNotificaciones = async (req: Request, res: Response) => {
    try {
        const ids = req.body.ids as number[] | undefined;
        
        // Asumimos que req.user viene del middleware de autenticación
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        await notificacionService.deleteNotificaciones(user, ids);

        const mensaje = ids && ids.length > 0 
            ? 'Notificaciones eliminadas correctamente.' 
            : 'Bandeja de notificaciones vaciada.';

        res.status(200).json({ message: mensaje });
    } catch (error) {
        console.error('Error al eliminar notificaciones:', error);
        res.status(500).json({ message: 'Error interno al procesar la solicitud.' });
    }
};
//src/controller/notificacion.controller
import { Request, Response } from 'express';
import * as notificacionService from '../services/notificacion.service';
import { asyncHandler } from '../utils/asyncHandler';

export const getMisNotificaciones = asyncHandler(async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });

        const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

        const result = await notificacionService.getNotificaciones(req.user, page, limit);
        res.status(200).json(result);

});

export const marcarNotificacionesLeidas = asyncHandler(async (req: Request, res: Response) => {

        if (!req.user) return res.status(401).json({ message: 'No autorizado' });

        const { ids } = req.body; // Se espera un array opcional de IDs
        await notificacionService.marcarComoLeidas(req.user, ids);
        res.status(200).json({ message: 'Notificaciones marcadas como leídas.' });
});

export const deleteNotificaciones = asyncHandler(async (req: Request, res: Response) => {
       const ids = req.body.ids as number[] | undefined;
        
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        await notificacionService.deleteNotificaciones(user, ids);

        const mensaje = ids && ids.length > 0 
            ? 'Notificaciones eliminadas correctamente.' 
            : 'Bandeja de notificaciones vaciada.';

        res.status(200).json({ message: mensaje });

});
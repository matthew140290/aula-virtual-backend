// src/controllers/foro.controller.ts
import { Request, Response } from 'express';
import * as foroService from '../services/foro.service';
import * as recursoService from '../services/recurso.service';
import { notificarDocentePorInteraccion } from '../services/notificacion.service';
import { asyncHandler } from '../utils/asyncHandler';

const validarAccesoEstudiante = async (req: Request, res: Response, recursoId: number) => {
    if (req.user?.perfil !== 'Estudiante') return true;

    const puedeAcceder = await recursoService.estudiantePuedeAccederRecurso(recursoId, Number(req.user.codigo));
    if (!puedeAcceder) {
        res.status(404).json({ message: 'Foro no encontrado.' });
        return false;
    }

    return true;
};

const validarAccesoEstudiantePorEntrada = async (req: Request, res: Response, entradaId: number) => {
    if (req.user?.perfil !== 'Estudiante') return true;

    const recursoId = await foroService.findRecursoIdByEntradaId(entradaId);
    if (!recursoId) {
        res.status(404).json({ message: 'Foro no encontrado.' });
        return false;
    }

    return validarAccesoEstudiante(req, res, recursoId);
};

export const getEntradas = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId))) return;

    const entradas = await foroService.getEntradasDelForo(recursoId);
    res.status(200).json(entradas);
});

export const crearEntrada = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId))) return;

    const { contenidoHTML, entradaPadreId } = JSON.parse(req.body.jsonData);
    const adjunto = req.file as Express.Multer.File | undefined;

    await foroService.crearNuevaEntrada({
        recursoId,
        contenidoHTML,
        entradaPadreId,
        usuarioId: req.user.codigo,
        perfilUsuario: req.user.perfil,
        adjunto,
    }, { codigo: req.user.codigo, perfil: req.user.perfil });

    if (req.user.perfil === 'Estudiante') {
        notificarDocentePorInteraccion(
            recursoId,
            { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto },
            'FORO_PARTICIPACION'
        ).catch(console.error);
    }

    res.status(201).json({ message: 'Respuesta publicada con exito.' });
});

export const actualizarUnaEntrada = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

    const entradaId = Number(req.params.entradaId);
    if (!(await validarAccesoEstudiantePorEntrada(req, res, entradaId))) return;

    const { contenidoHTML, adjuntoAction } = JSON.parse(req.body.jsonData);
    const nuevoAdjunto = req.file as Express.Multer.File | undefined;

    let adjuntoParam: Express.Multer.File | null | undefined = nuevoAdjunto;
    if (adjuntoAction === 'delete') {
        adjuntoParam = null;
    } else if (!nuevoAdjunto) {
        adjuntoParam = undefined;
    }

    const exito = await foroService.actualizarEntrada(
        entradaId,
        contenidoHTML,
        req.user.codigo,
        req.user.perfil,
        adjuntoParam
    );

    if (exito) {
        res.status(200).json({ message: 'Mensaje actualizado con exito.' });
    } else {
        res.status(403).json({ message: 'No tienes permiso para editar este mensaje.' });
    }
});

export const eliminarUnaEntrada = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });

    const entradaId = Number(req.params.entradaId);
    if (!(await validarAccesoEstudiantePorEntrada(req, res, entradaId))) return;

    const exito = await foroService.eliminarEntrada(entradaId, req.user.codigo, req.user.perfil);

    if (exito) {
        res.status(200).json({ message: 'Mensaje eliminado con exito.' });
    } else {
        res.status(403).json({ message: 'No tienes permiso para eliminar este mensaje.' });
    }
});

export const obtenerCalificaciones = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    const calificaciones = await foroService.getCalificacionesForo(recursoId);
    res.status(200).json(calificaciones);
});

export const calificarParticipacion = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || !req.user.perfil.includes('Docente')) {
        return res.status(403).json({ message: 'No tienes permiso para calificar.' });
    }

    const recursoId = Number(req.params.recursoId);
    const { matriculaNo, calificacion, comentario } = req.body;
    await foroService.guardarCalificacion(recursoId, matriculaNo, calificacion, comentario);
    res.status(200).json({ message: 'Calificacion guardada con exito.' });
});

export const getAdjuntoEntrada = asyncHandler(async (req: Request, res: Response) => {
    const entradaId = Number(req.params.entradaId);
    const archivo = await foroService.findAdjuntoDeEntrada(entradaId);

    if (!archivo || !archivo.ImagenData) {
        return res.status(404).json({ message: 'Adjunto no encontrado.' });
    }
    if (!(await validarAccesoEstudiante(req, res, archivo.RecursoID))) return;

    res.setHeader('Content-Type', archivo.ImagenMimeType);
    res.send(archivo.ImagenData);
});

 // src/controllers/estudiante.controller.ts
import { Request, Response } from 'express';
import * as estudianteService from '../services/estudiante.service';

export const getEstudiantesPorAsignatura = async (req: Request, res: Response) => {
    try {
        const codigoAsignatura = parseInt(req.params.codigoAsignatura, 10);
        if (isNaN(codigoAsignatura)) {
            return res.status(400).json({ message: 'El código del curso debe ser un número válido.' });
        }
        const estudiantes = await estudianteService.findEstudiantesByAsignatura(codigoAsignatura);
        res.status(200).json(estudiantes);
    } catch (error) {
        console.error('Error al obtener estudiantes por curso:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const getMisAsignaturas = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
        const asignaturas = await estudianteService.findAsignaturasByEstudiante(req.user.codigo);
        res.status(200).json(asignaturas);
    } catch (error) {
        console.error('Error al obtener las asignaturas del estudiante:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const getMisEventosProximos = async (req: Request, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
        const eventos = await estudianteService.findEventosProximosByEstudiante(req.user.codigo);
        res.status(200).json(eventos);
    } catch (error) {
        console.error('Error al obtener los eventos próximos:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const ocultarEvento = async (req: Request, res: Response) => {
    try {
        const { codigo } = req.user!; // Viene de tu auth.middleware.ts (DecodedUserToken)
        const { recursoId } = req.body;

        if (!recursoId) {
            return res.status(400).json({ message: 'recursoId es requerido' });
        }

        // 'codigo' en tu token de estudiante corresponde a 'MatriculaNo'
        await estudianteService.ocultarEventoEstudiante(codigo, recursoId);

        return res.json({ message: 'Evento ocultado' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al ocultar evento' });
    }
};

export const getRecursoVista = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const matriculaNo = req.user?.codigo;

        if (!matriculaNo) return res.status(401).json({ message: 'No autorizado' });

        const data = await estudianteService.getVistaRecursoEstudiante(recursoId, Number(matriculaNo));
        
        if (!data) return res.status(404).json({ message: 'Recurso no encontrado' });

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al cargar el recurso.' });
    }
};
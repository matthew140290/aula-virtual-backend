 // src/controllers/estudiante.controller.ts
import { Request, Response } from 'express';
import * as estudianteService from '../services/estudiante.service';
import { asyncHandler } from '../utils/asyncHandler';


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

export const getMisAsignaturas = asyncHandler(async (req: Request, res: Response) => {
    //console.log('--- 🚀 [CONTROLLER] Iniciando getMisAsignaturas ---');
        if (!req.user) {
            console.error('❌ [CONTROLLER] No hay usuario en req.user (Token inválido o middleware falló)');
            return res.status(401).json({ message: 'No autorizado.' });
        }
        const asignaturas = await estudianteService.findAsignaturasByEstudiante(req.user.codigo);
        
        //console.log(`📤 [CONTROLLER] Enviando respuesta JSON con ${asignaturas.length} asignaturas.`);
        res.status(200).json(asignaturas);

});

export const getMisEventosProximos = asyncHandler(async (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
        const eventos = await estudianteService.findEventosProximosByEstudiante(req.user.codigo);

        res.status(200).json(eventos);
});

export const ocultarEvento = asyncHandler(async (req: Request, res: Response) => {
        const { codigo } = req.user!; // Viene de tu auth.middleware.ts (DecodedUserToken)
        const { recursoId } = req.body;

        if (!recursoId) {
            return res.status(400).json({ message: 'recursoId es requerido' });
        }


        await estudianteService.ocultarEventoEstudiante(codigo, recursoId);

        return res.json({ message: 'Evento ocultado' });
});

export const getRecursoVista = asyncHandler(async (req: Request, res: Response) => {
        const recursoId = Number(req.params.recursoId);
        const matriculaNo = req.user?.codigo;

        if (!matriculaNo) return res.status(401).json({ message: 'No autorizado' });

        const data = await estudianteService.getVistaRecursoEstudiante(recursoId, Number(matriculaNo));
        
        if (!data) return res.status(404).json({ message: 'Recurso no encontrado' });

        res.json(data);

});
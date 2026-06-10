// src/controllers/prueba.controller.ts
import { Request, Response } from 'express';
import * as pruebaService from '../services/prueba.service'; // Crearemos este servicio en un momento
import { notificarDocentePorInteraccion } from '../services/notificacion.service';
import { asyncHandler } from '../utils/asyncHandler';
import { normalizeRole } from '../constants/roles';



export const iniciarPrueba = asyncHandler(async (req: Request, res: Response) => {

        const pruebaId = Number(req.params.pruebaId);
        const matriculaNo = req.user?.codigo;
        if (!matriculaNo) return res.status(401).json({ message: 'No autorizado' });

        const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : undefined;

        try {
            const data = await pruebaService.iniciarPrueba(pruebaId, Number(matriculaNo), contrasena);
            res.status(201).json(data);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            throw error;
        }
});

export const entregarPrueba = asyncHandler(async (req: Request, res: Response) => {

        const { resultadoId, respuestas, duracionSegundos } = req.body;
        const matriculaNo = req.user?.codigo;
        if (!matriculaNo) return res.status(401).json({ message: 'No autorizado' });
        
        if (!Number.isFinite(Number(resultadoId))) {
            return res.status(400).json({ message: 'resultadoId inválido' });
        }

        if (!Array.isArray(respuestas)) {
            return res.status(400).json({ message: 'El campo respuestas debe ser un arreglo.' });
        }

        if (!Number.isFinite(Number(duracionSegundos)) || Number(duracionSegundos) < 0) {
            return res.status(400).json({ message: 'duracionSegundos inválida.' });
        }

        let resultado;
        try {
            resultado = await pruebaService.entregarPrueba(
                Number(resultadoId),
                respuestas,
                Number(duracionSegundos),
                Number(matriculaNo)
            );
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            throw error;
        }

        if (req.user && req.user.perfil === 'Estudiante' && resultado.recursoId) {
            notificarDocentePorInteraccion(
                resultado.recursoId,
                { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto },
                'PRUEBA_FINALIZADA'
            ).catch(console.error);
        }

        res.status(200).json({ message: 'Prueba entregada con éxito.', data: resultado });

});

export const abandonarPrueba = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const matriculaNo = req.user?.codigo;
    const { resultadoId, duracionSegundos } = req.body || {};

    if (!matriculaNo) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    if (!Number.isFinite(pruebaId) || !Number.isFinite(Number(resultadoId))) {
        return res.status(400).json({ message: 'Parámetros inválidos para abandono de prueba.' });
    }

    const abandonada = await pruebaService.abandonarPrueba(
        pruebaId,
        Number(resultadoId),
        Number(matriculaNo),
        Number.isFinite(Number(duracionSegundos)) ? Number(duracionSegundos) : undefined
    );

    return res.status(200).json({ abandonada });
});

export const heartbeatPrueba = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const matriculaNo = req.user?.codigo;
    const { resultadoId, duracionSegundos } = req.body || {};

    if (!matriculaNo) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    if (!Number.isFinite(pruebaId) || !Number.isFinite(Number(resultadoId))) {
        return res.status(400).json({ message: 'Parámetros inválidos para heartbeat.' });
    }

    const data = await pruebaService.heartbeatPrueba(
        pruebaId,
        Number(resultadoId),
        Number(matriculaNo),
        Number.isFinite(Number(duracionSegundos)) ? Number(duracionSegundos) : undefined
    );

    return res.status(200).json(data);
});


export const getPruebaDetalles = asyncHandler(async (req: Request, res: Response) => {
    const id  = Number(req.params.pruebaId); // puede ser RecursoID o PruebaID
    const isStudent = normalizeRole(req.user?.perfil || '') === normalizeRole('Estudiante');
    const prueba = await pruebaService.getPruebaDetalles(id, {
        includeAnswers: !isStudent,
        includeSecret: !isStudent,
        viewerMatriculaNo: isStudent ? Number(req.user?.codigo) : undefined,
    });
    if (!prueba) return res.status(404).json({ message: 'Prueba no encontrada.' });
    res.status(200).json(prueba);
});

// Actualizar el nombre de la competencia de la prueba
export const updatePruebaCompetencia = asyncHandler(async (req: Request, res: Response) => {
        const pruebaId = Number(req.params.pruebaId);
        const { nombreCompetencia } = req.body;
        await pruebaService.updatePruebaCompetencia(pruebaId, nombreCompetencia);
        res.status(200).json({ message: 'Nombre de competencia actualizado con éxito.' });
});

// Añadir una nueva pregunta a la prueba
export const addPregunta = asyncHandler(async (req: Request, res: Response) => {
        const pruebaId = Number(req.params.pruebaId);
        const preguntaData = req.body; // Debería contener texto, tipo, porcentaje, respuestas
        const newPreguntaId = await pruebaService.addPreguntaToPrueba(pruebaId, preguntaData);
        res.status(201).json({ message: 'Pregunta añadida con éxito.', preguntaId: newPreguntaId });
});

// Actualizar una pregunta existente
export const updatePregunta = asyncHandler(async (req: Request, res: Response) => {
        const preguntaId = Number(req.params.preguntaId);
        const preguntaData = req.body;
        await pruebaService.updatePregunta(preguntaId, preguntaData);
        res.status(200).json({ message: 'Pregunta actualizada con éxito.' });
});

export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
        const pruebaId = Number(req.params.pruebaId);
        await pruebaService.updatePruebaConfig(pruebaId, req.body);
        res.json({ message: 'Configuración actualizada correctamente.' });
});

// Eliminar una pregunta
export const deletePregunta = asyncHandler(async (req: Request, res: Response) => {
        const preguntaId = Number(req.params.preguntaId);
        await pruebaService.deletePregunta(preguntaId);
        res.status(200).json({ message: 'Pregunta eliminada con éxito.' });
});

export const getBancoPreguntas = asyncHandler(async (req: Request, res: Response) => {
        const banco = await pruebaService.getBancoPreguntas();
        res.status(200).json(banco);
});

export const addPreguntaToBanco = asyncHandler(async (req: Request, res: Response) => {
        const preguntaData = req.body;

        if (!preguntaData || typeof preguntaData !== 'object') {
            return res.status(400).json({ message: 'Payload inválido para guardar en banco.' });
        }

        try {
            const result = await pruebaService.addPreguntaToBanco(preguntaData, req.user ? {
                codigo: req.user.codigo,
                perfil: req.user.perfil,
            } : undefined);
            res.status(201).json({ message: 'Pregunta guardada en el banco con éxito.', ...result });
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            throw error;
        }
});

export const getEstudiantesParaPrueba = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getEstudiantesParaPrueba(pruebaId);
    res.json(data);

});

export const getResultadosSimulacro = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getResultadosSimulacro(pruebaId);
    res.json(data);
});

export const getResultadosReales = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getResultadosReales(pruebaId);
    res.json(data);
});

export const eliminarSimulacro = asyncHandler(async (req: Request, res: Response) => {

    const simulacroId = Number(req.params.simulacroId);
    await pruebaService.deleteSimulacroById(simulacroId);
    res.json({ message: 'Simulacro eliminado.' });
});

export const guardarCalificacion = asyncHandler(async (req: Request, res: Response) => {
    const resultadoId = Number(req.params.resultadoId);
    const { calificacionFinal, retroalimentacion } = req.body;

    if (!Number.isFinite(resultadoId)) {
        return res.status(400).json({ message: 'resultadoId inválido.' });
    }

    const nota = Number(calificacionFinal);
    if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
        return res.status(400).json({ message: 'La calificación debe estar entre 0 y 5.' });
    }

    await pruebaService.setResultadoCalificacion(resultadoId, nota, retroalimentacion);
    res.json({ message: 'Calificación guardada.' });
});

export const setPruebaPublicado = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const { publicado } = req.body as { publicado: boolean };

    const { recursoId, publicado: pubFinal } =
      await pruebaService.validateAndSetPublicadoReturningRecurso(pruebaId, publicado);

    return res.status(200).json({
      message: `Prueba ${pubFinal ? 'publicada' : 'despublicada'} con éxito.`,
      recursoId,
      publicado: pubFinal,
      success: true
    });
});


export const setPruebaFinalizada = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const { finalizada } = req.body as { finalizada: boolean };
    await pruebaService.setPruebaFinalizada(pruebaId, finalizada);
    res.status(200).json({ message: `Prueba marcada como ${finalizada ? 'finalizada' : 'editable'}.` });
});

export const crearSimulacro = asyncHandler(async (req: Request, res: Response) => {
    const pruebaId = Number(req.params.pruebaId);
    const body = req.body as { matriculaNo: number; calificacion?: number; duracionSegundos?: number };

    if (!Number.isFinite(pruebaId) || !Number.isFinite(body.matriculaNo)) {
      return res.status(400).json({ message: 'Parámetros inválidos.' });
    }

    if (typeof body.calificacion === 'number' && (body.calificacion < 0 || body.calificacion > 5)) {
      return res.status(400).json({ message: 'calificacion inválida. Debe estar entre 0 y 5.' });
    }

    if (typeof body.duracionSegundos === 'number' && body.duracionSegundos < 0) {
      return res.status(400).json({ message: 'duracionSegundos inválida.' });
    }

    const id = await pruebaService.createSimulacro(
      pruebaId,
      Number(body.matriculaNo),
      typeof body.calificacion === 'number' ? body.calificacion : undefined,
      typeof body.duracionSegundos === 'number' ? body.duracionSegundos : undefined
    );

    res.status(201).json({ simulacroId: id });
});

export const getPublicacionPorRecursoId = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) {
      return res.status(400).json({ message: 'recursoId inválido' });
    }
    const publicado = await pruebaService.getPublicacionByRecursoId(recursoId);
    if (publicado === null) {
      return res.status(404).json({ message: 'No hay prueba asociada a este recurso' });
    }
    return res.json({ recursoId, publicado });
});

// ✅ NUEVO: bulk por muchos RecursoID
export const getPublicacionesByRecursoIds = asyncHandler(async (req: Request, res: Response) => {
    const recursoIds: number[] = Array.isArray(req.body?.recursoIds)
      ? req.body.recursoIds.map(Number).filter(Number.isFinite)
      : [];
    if (!recursoIds.length) {
      return res.json({ items: [] });
    }
    const items = await pruebaService.getPublicacionesByRecursoIds(recursoIds);
    return res.json({ items });

});

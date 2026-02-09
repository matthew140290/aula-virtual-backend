// src/controllers/prueba.controller.ts
import { Request, Response } from 'express';
import * as pruebaService from '../services/prueba.service'; // Crearemos este servicio en un momento
import { notificarDocentePorInteraccion } from '../services/notificacion.service';



export const iniciarPrueba = async (req: Request, res: Response) => {
    try {
        const pruebaId = Number(req.params.pruebaId);
        const matriculaNo = req.user?.codigo;
        if (!matriculaNo) return res.status(401).json({ message: 'No autorizado' });

        const data = await pruebaService.iniciarPrueba(pruebaId, Number(matriculaNo));
        res.status(201).json(data);
    } catch (error: any) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

export const entregarPrueba = async (req: Request, res: Response) => {
    try {
        // Ahora esperamos recibir el resultadoId en el body o params
        const { resultadoId, respuestas, duracionSegundos } = req.body;
        
        if (!resultadoId) return res.status(400).json({ message: 'Falta resultadoId' });

        const resultado = await pruebaService.entregarPrueba(
            Number(resultadoId), 
            respuestas, 
            duracionSegundos
        );

        if (req.user && req.user.perfil === 'Estudiante' && resultado.recursoId) {
            notificarDocentePorInteraccion(
                resultado.recursoId,
                { codigo: req.user.codigo, nombreCompleto: req.user.nombreCompleto },
                'PRUEBA_FINALIZADA'
            ).catch(console.error);
        }

        res.status(200).json({ message: 'Prueba entregada con éxito.', data: resultado });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Obtener detalles completos de la prueba (incluyendo preguntas/respuestas)
export const getPruebaDetalles = async (req: Request, res: Response) => {
  try {
    const id  = Number(req.params.pruebaId); // puede ser RecursoID o PruebaID
    const prueba = await pruebaService.getPruebaDetalles(id);
    if (!prueba) return res.status(404).json({ message: 'Prueba no encontrada.' });
    res.status(200).json(prueba);
  } catch (error) {
    console.error('Error al obtener detalles de la prueba:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// Actualizar el nombre de la competencia de la prueba
export const updatePruebaCompetencia = async (req: Request, res: Response) => {
    try {
        const pruebaId = Number(req.params.pruebaId);
        const { nombreCompetencia } = req.body;
        await pruebaService.updatePruebaCompetencia(pruebaId, nombreCompetencia);
        res.status(200).json({ message: 'Nombre de competencia actualizado con éxito.' });
    } catch (error) {
        console.error('Error al actualizar nombre de competencia:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Añadir una nueva pregunta a la prueba
export const addPregunta = async (req: Request, res: Response) => {
    try {
        const pruebaId = Number(req.params.pruebaId);
        const preguntaData = req.body; // Debería contener texto, tipo, porcentaje, respuestas
        const newPreguntaId = await pruebaService.addPreguntaToPrueba(pruebaId, preguntaData);
        res.status(201).json({ message: 'Pregunta añadida con éxito.', preguntaId: newPreguntaId });
    } catch (error) {
        console.error('Error al añadir pregunta:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Actualizar una pregunta existente
export const updatePregunta = async (req: Request, res: Response) => {
    try {
        const preguntaId = Number(req.params.preguntaId);
        const preguntaData = req.body;
        await pruebaService.updatePregunta(preguntaId, preguntaData);
        res.status(200).json({ message: 'Pregunta actualizada con éxito.' });
    } catch (error) {
        console.error('Error al actualizar pregunta:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const updateConfig = async (req: Request, res: Response) => {
    try {
        const pruebaId = Number(req.params.pruebaId);
        await pruebaService.updatePruebaConfig(pruebaId, req.body);
        res.json({ message: 'Configuración actualizada correctamente.' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Eliminar una pregunta
export const deletePregunta = async (req: Request, res: Response) => {
    try {
        const preguntaId = Number(req.params.preguntaId);
        await pruebaService.deletePregunta(preguntaId);
        res.status(200).json({ message: 'Pregunta eliminada con éxito.' });
    } catch (error) {
        console.error('Error al eliminar pregunta:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Banco de Preguntas (Simulado por ahora)
export const getBancoPreguntas = async (req: Request, res: Response) => {
    try {
        // Implementación real leería de Virtual.BancoPreguntas
        res.status(200).json([
            {
                PreguntaBancoID: 1,
                TextoPregunta: '¿Cuál es la capital de Francia?',
                Respuestas: [
                    { RespuestaID: 1, TextoRespuesta: 'Berlín', EsCorrecta: false },
                    { RespuestaID: 2, TextoRespuesta: 'Madrid', EsCorrecta: false },
                    { RespuestaID: 3, TextoRespuesta: 'París', EsCorrecta: true },
                    { RespuestaID: 4, TextoRespuesta: 'Roma', EsCorrecta: false },
                ]
            },
            {
                PreguntaBancoID: 2,
                TextoPregunta: 'El ciclo del agua se compone de:',
                Respuestas: [
                    { RespuestaID: 5, TextoRespuesta: 'Evaporación, condensación, precipitación', EsCorrecta: true },
                    { RespuestaID: 6, TextoRespuesta: 'Erosión, sedimentación, transporte', EsCorrecta: false },
                ]
            }
        ]);
    } catch (error) {
        console.error('Error al obtener banco de preguntas:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const addPreguntaToBanco = async (req: Request, res: Response) => {
    try {
        const preguntaData = req.body; // Contiene texto, tipo, respuestas
        // Implementación real insertaría en Virtual.BancoPreguntas
        console.log('Guardando en banco:', preguntaData);
        res.status(201).json({ message: 'Pregunta guardada en el banco con éxito.' });
    } catch (error) {
        console.error('Error al guardar pregunta en banco:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const getEstudiantesParaPrueba = async (req: Request, res: Response) => {
  try {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getEstudiantesParaPrueba(pruebaId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: 'Error al obtener estudiantes', error: err.message });
  }
};

export const getResultadosSimulacro = async (req: Request, res: Response) => {
  try {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getResultadosSimulacro(pruebaId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: 'Error al obtener simulacros', error: err.message });
  }
};

export const getResultadosReales = async (req: Request, res: Response) => {
  try {
    const pruebaId = Number(req.params.pruebaId);
    const data = await pruebaService.getResultadosReales(pruebaId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: 'Error al obtener resultados', error: err.message });
  }
};

export const eliminarSimulacro = async (req: Request, res: Response) => {
  try {
    const simulacroId = Number(req.params.simulacroId);
    await pruebaService.deleteSimulacroById(simulacroId);
    res.json({ message: 'Simulacro eliminado.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Error al eliminar simulacro', error: err.message });
  }
};

export const guardarCalificacion = async (req: Request, res: Response) => {
  try {
    const resultadoId = Number(req.params.resultadoId);
    const { calificacionFinal, retroalimentacion } = req.body;
    await pruebaService.setResultadoCalificacion(resultadoId, Number(calificacionFinal), retroalimentacion);
    res.json({ message: 'Calificación guardada.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Error al guardar calificación', error: err.message });
  }
};

export const setPruebaPublicado = async (req: Request, res: Response) => {
  try {
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
  } catch (err: any) {
    console.error('❌ Error en setPruebaPublicado:', err);
    res.status(400).json({ message: err.message || 'No se pudo publicar' });
  }
};


export const setPruebaFinalizada = async (req: Request, res: Response) => {
  try {
    const pruebaId = Number(req.params.pruebaId);
    const { finalizada } = req.body as { finalizada: boolean };
    await pruebaService.setPruebaFinalizada(pruebaId, finalizada);
    res.status(200).json({ message: `Prueba marcada como ${finalizada ? 'finalizada' : 'editable'}.` });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo cambiar el estado de finalización' });
  }
};

export const crearSimulacro = async (req: Request, res: Response) => {
  try {
    const pruebaId = Number(req.params.pruebaId);
    const body = req.body as { matriculaNo: number; calificacion?: number; duracionSegundos?: number };

    if (!Number.isFinite(pruebaId) || !Number.isFinite(body.matriculaNo)) {
      return res.status(400).json({ message: 'Parámetros inválidos.' });
    }
    const id = await pruebaService.createSimulacro(
      pruebaId,
      Number(body.matriculaNo),
      typeof body.calificacion === 'number' ? body.calificacion : undefined,
      typeof body.duracionSegundos === 'number' ? body.duracionSegundos : undefined
    );

    res.status(201).json({ simulacroId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CTRL:crearSimulacro]', message);
    res.status(500).json({ message: 'Error al crear simulacro', error: message });
  }
};

export const getPublicacionPorRecursoId = async (req: Request, res: Response) => {
  try {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) {
      return res.status(400).json({ message: 'recursoId inválido' });
    }
    const publicado = await pruebaService.getPublicacionByRecursoId(recursoId);
    if (publicado === null) {
      return res.status(404).json({ message: 'No hay prueba asociada a este recurso' });
    }
    return res.json({ recursoId, publicado });
  } catch (e: any) {
    console.error('getPublicacionPorRecursoId', e);
    res.status(500).json({ message: 'Error al consultar publicación' });
  }
};

// ✅ NUEVO: bulk por muchos RecursoID
export const getPublicacionesByRecursoIds = async (req: Request, res: Response) => {
  try {
    const recursoIds: number[] = Array.isArray(req.body?.recursoIds)
      ? req.body.recursoIds.map(Number).filter(Number.isFinite)
      : [];
    if (!recursoIds.length) {
      return res.json({ items: [] });
    }
    const items = await pruebaService.getPublicacionesByRecursoIds(recursoIds);
    return res.json({ items });
  } catch (e: any) {
    console.error('getPublicacionesByRecursoIds', e);
    res.status(500).json({ message: 'Error al consultar publicaciones' });
  }
};

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as icfesGlobalService from '../services/icfesGlobal.service';

const getActor = (req: Request) => {
  const codigo = req.user?.codigo;
  const perfil = req.user?.perfil;

  if (!codigo || !perfil) return null;

  return { codigo, perfil };
};

export const createExamenGlobal = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (!actor) return res.status(401).json({ message: 'No autorizado.' });
  const data = await icfesGlobalService.createExamenGlobal(req.body, actor);
  res.status(201).json({ message: 'Examen global creado.', data });
});

export const listExamenesGlobales = asyncHandler(async (_req: Request, res: Response) => {
  const items = await icfesGlobalService.listExamenesGlobales();
  res.status(200).json(items);
});

export const getExamenGlobalDetalle = asyncHandler(async (req: Request, res: Response) => {
  const examenId = Number(req.params.examenId);
  const data = await icfesGlobalService.getExamenGlobalDetalle(examenId);
  if (!data) {
    return res.status(404).json({ message: 'Examen global no encontrado.' });
  }
  return res.status(200).json(data);
});

export const generarPreguntasIa = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (!actor) return res.status(401).json({ message: 'No autorizado.' });
  const examenId = Number(req.params.examenId);
  const data = await icfesGlobalService.generarPreguntasIa(examenId, req.body, actor);
  res.status(200).json({ message: 'Preguntas generadas y guardadas en borrador.', data });
});

export const updatePreguntaGlobal = asyncHandler(async (req: Request, res: Response) => {
  const preguntaId = Number(req.params.preguntaId);
  await icfesGlobalService.updatePreguntaGlobal(preguntaId, req.body);
  res.status(200).json({ message: 'Pregunta actualizada.' });
});

export const publicarExamenGlobal = asyncHandler(async (req: Request, res: Response) => {
  const examenId = Number(req.params.examenId);
  await icfesGlobalService.publicarExamenGlobal(examenId);
  res.status(200).json({ message: 'Examen global publicado.' });
});

export const despublicarExamenGlobal = asyncHandler(async (req: Request, res: Response) => {
  const examenId = Number(req.params.examenId);
  await icfesGlobalService.despublicarExamenGlobal(examenId);
  res.status(200).json({ message: 'Examen global despublicado.' });
});

export const listExamenesPublicados = asyncHandler(async (_req: Request, res: Response) => {
  const items = await icfesGlobalService.listExamenesGlobalesPublicados();
  res.status(200).json(items);
});

export const getExamenPublicadoDetalle = asyncHandler(async (req: Request, res: Response) => {
  const examenId = Number(req.params.examenId);
  const data = await icfesGlobalService.getExamenGlobalPublicadoDetalle(examenId);
  if (!data) return res.status(404).json({ message: 'Examen global no disponible.' });
  return res.status(200).json(data);
});

export const iniciarIntentoGlobal = asyncHandler(async (req: Request, res: Response) => {
  const examenId = Number(req.params.examenId);
  const matriculaNo = Number(req.user?.codigo);
  if (!Number.isFinite(matriculaNo)) {
    return res.status(401).json({ message: 'No autorizado.' });
  }
  const data = await icfesGlobalService.iniciarIntentoGlobal(examenId, matriculaNo);
  return res.status(201).json({ message: 'Intento iniciado.', data });
});

export const entregarIntentoGlobal = asyncHandler(async (req: Request, res: Response) => {
  const intentoId = Number(req.params.intentoId);
  const matriculaNo = Number(req.user?.codigo);
  if (!Number.isFinite(matriculaNo)) {
    return res.status(401).json({ message: 'No autorizado.' });
  }

  const { respuestas, duracionSegundos } = req.body;
  const data = await icfesGlobalService.entregarIntentoGlobal(intentoId, matriculaNo, respuestas, duracionSegundos);
  return res.status(200).json({ message: 'Intento entregado.', data });
});

export const getRevisionIntentoGlobal = asyncHandler(async (req: Request, res: Response) => {
  const intentoId = Number(req.params.intentoId);
  const matriculaNo = Number(req.user?.codigo);
  if (!Number.isFinite(matriculaNo)) {
    return res.status(401).json({ message: 'No autorizado.' });
  }

  const data = await icfesGlobalService.getRevisionIntentoGlobal(intentoId, matriculaNo);
  return res.status(200).json(data);
});

export const getExplicacionErrorIa = asyncHandler(async (req: Request, res: Response) => {
  const intentoId = Number(req.params.intentoId);
  const preguntaId = Number(req.params.preguntaId);
  const matriculaNo = Number(req.user?.codigo);
  if (!Number.isFinite(matriculaNo)) {
    return res.status(401).json({ message: 'No autorizado.' });
  }

  const data = await icfesGlobalService.generarExplicacionErrorIa(intentoId, preguntaId, matriculaNo);
  return res.status(200).json({ message: 'Explicacion generada.', data });
});

export const getMisIntentos = asyncHandler(async (req: Request, res: Response) => {
  const matriculaNo = Number(req.user?.codigo);
  if (!Number.isFinite(matriculaNo)) {
    return res.status(401).json({ message: 'No autorizado.' });
  }

  const data = await icfesGlobalService.getMisIntentosGlobales(matriculaNo);
  return res.status(200).json(data);
});

export const getDiagnosticoCompetencias = asyncHandler(async (req: Request, res: Response) => {
  const matriculaNo = Number(req.user?.codigo);
  if (!Number.isFinite(matriculaNo)) {
    return res.status(401).json({ message: 'No autorizado.' });
  }

  const data = await icfesGlobalService.getDiagnosticoCompetencias(matriculaNo);
  return res.status(200).json(data);
});

export const getResumenCoordinacion = asyncHandler(async (req: Request, res: Response) => {
  const numOrUndef = (value: unknown) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  const filtros = {
    anio: numOrUndef(req.query.anio),
    trimestre: numOrUndef(req.query.trimestre),
    gradoCodigo: numOrUndef(req.query.gradoCodigo),
    cursoCodigo: numOrUndef(req.query.cursoCodigo),
  };

  const data = await icfesGlobalService.getResumenCoordinacion(filtros);
  return res.status(200).json(data);
});

export const getOpcionesFiltroCoordinacion = asyncHandler(async (_req: Request, res: Response) => {
  const data = await icfesGlobalService.getOpcionesFiltroCoordinacion();
  return res.status(200).json(data);
});

export const deleteExamenGlobal = asyncHandler(async (req: Request, res: Response) => {
  const examenId = Number(req.params.examenId);
  await icfesGlobalService.deleteExamenGlobal(examenId);
  res.status(200).json({ message: 'Examen global eliminado.' });
});

export const deletePreguntaGlobal = asyncHandler(async (req: Request, res: Response) => {
  const preguntaId = Number(req.params.preguntaId);
  await icfesGlobalService.deletePreguntaGlobal(preguntaId);
  res.status(200).json({ message: 'Pregunta eliminada.' });
});

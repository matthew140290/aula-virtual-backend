// src/controllers/curso.controller.ts
import { Request, Response } from 'express';
import * as cursoService from '../services/curso.service';
import * as estudianteService from '../services/estudiante.service';
import { ROLES, type Role } from '../constants/roles';
import { asyncHandler } from '../utils/asyncHandler';

const ADMIN_ROLES: readonly string[] = [ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER];
const DOCENTE_ROLES: readonly string[] = [ROLES.DOCENTE, ROLES.DIRECTOR_GRUPO];

interface CursoResponse {
    codigoAsignatura: number;
    nombreAsignatura: string;
    nombreCurso: string;
    nombreGrado: string;
    codigoCurso: number | null;
    nombreDocente: string | null;
    codigoDocente: number | null;
    rolVista: string;
    esDirector: boolean;
}

export const getMisCursos = asyncHandler(async (req: Request, res: Response) => {
    const { perfil, codigo } = req.user!;

    if (ADMIN_ROLES.includes(perfil)) {
        const rows = await cursoService.findAllCursosInstitucionales();
        const data: CursoResponse[] = rows.map((r) => ({
            codigoAsignatura: r.CodigoAsignatura,
            nombreAsignatura: r.NombreAsignatura,
            nombreCurso: r.NombreCurso,
            nombreGrado: r.NombreGrado,
            codigoCurso: r.CodigoCurso ?? null,
            nombreDocente: r.NombreDocente || 'Sin asignar',
            codigoDocente: r.CodigoDocente ?? null,
            rolVista: r.RolVista,
            esDirector: false
        }));
        return res.status(200).json(data);
    }

    if (DOCENTE_ROLES.includes(perfil)) {
        const rows = await cursoService.findCursosByDocente(codigo);
        const data: CursoResponse[] = rows.map((r) => ({
            codigoAsignatura: r.CodigoAsignatura,
            nombreAsignatura: r.NombreAsignatura,
            nombreCurso: r.NombreCurso,
            nombreGrado: r.NombreGrado,
            codigoCurso: r.CodigoCurso ?? null,
            nombreDocente: null,
            codigoDocente: codigo,
            rolVista: r.RolVista,
            esDirector: r.RolVista === 'Director'
        }));
        return res.status(200).json(data);
    }

    if (perfil === ROLES.ESTUDIANTE) {
        const rows = await estudianteService.findAsignaturasByEstudiante(codigo);
        const data: CursoResponse[] = rows.map((r) => ({
            codigoAsignatura: r.CodigoAsignatura,
            nombreAsignatura: r.NombreAsignatura,
            nombreCurso: r.NombreCurso,
            nombreGrado: r.NombreGrado,
            codigoCurso: null,
            nombreDocente: r.NombreDocente ?? null,
            codigoDocente: null,
            rolVista: ROLES.ESTUDIANTE,
            esDirector: false
        }));
        return res.status(200).json(data);
    }

    return res.status(403).json({ message: 'Perfil sin acceso a esta vista.' });
});


// src/controllers/curso.controller.ts
import { Request, Response } from 'express';
import * as cursoService from '../services/curso.service';
import * as estudianteService from '../services/estudiante.service';

export const getMisCursos = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
    const { perfil, codigo } = req.user;

    if (perfil === 'Docente' || perfil === 'Director de grupo') {
      const rows = await cursoService.findCursosByDocente(codigo);
      // console.log('Datos crudos de cursos:', rows);
      const data = rows.map((r: any) => ({
        CodigoAsignatura: r.CodigoAsignatura,
        NombreAsignatura: r.NombreAsignatura,
        NombreCurso: r.NombreCurso,
        NombreGrado: r.NombreGrado,
        CodigoCurso: r.CodigoCurso ?? null,
        nombreDocente: null,
        rolVista: r.RolVista,
        esDirector: r.RolVista === 'Director'
      }));
      return res.status(200).json(data);
    }

    if (perfil === 'Estudiante') {
      const rows = await estudianteService.findAsignaturasByEstudiante(codigo);
      const data = rows.map((r: any) => ({
        codigoAsignatura: r.CodigoAsignatura,
        nombreAsignatura: r.NombreAsignatura,
        nombreCurso: r.NombreCurso,
        nombreGrado: r.NombreGrado,
        codigoCurso: r.CodigoCurso ?? null,
        nombreDocente: r.NombreDocente ?? null,
        rolVista: 'Estudiante',
      }));
      return res.status(200).json(data);
    }

    return res.status(403).json({ message: 'Perfil sin acceso a mis-cursos.' });
  } catch (error) {
    console.error('Error en getMisCursos:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};



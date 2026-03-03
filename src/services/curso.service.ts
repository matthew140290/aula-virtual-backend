// src/services/curso.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';

export interface CursoDocenteRow {
    CodigoAsignatura: number;
    NombreAsignatura: string;
    NombreCurso: string;
    CodigoCurso: number | null;
    NombreGrado: string;
    RolVista: string;
    CodigoDocente?: number | null;
    NombreDocente?: string | null;
}

export const findCursosByDocente = async (codigoDocente: number): Promise<CursoDocenteRow[]> => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('codigoDocente', sql.SmallInt, codigoDocente)
            .query<CursoDocenteRow>(`
                SELECT 
                    CAST(asig.Código AS INT) AS CodigoAsignatura,
                    asig.Descripción AS NombreAsignatura,
                    cur.Curso AS NombreCurso,
                    cur.Código AS CodigoCurso,
                    g.Descripción AS NombreGrado,
                    'Docente' AS RolVista,
                    @codigoDocente AS CodigoDocente,
                    NULL AS NombreDocente
                FROM dbo.AsignaciónAcadémica aa
                JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
                JOIN dbo.Cursos cur ON asig.CódigoCurso = cur.Código
                JOIN dbo.Grados g ON cur.CódigoGrado = g.Código 
                WHERE aa.CódigoDocente = @codigoDocente

                UNION ALL

                SELECT 
                    CAST((cur.Código * -1) AS INT) AS CodigoAsignatura, 
                    'Dirección de Grupo' AS NombreAsignatura,
                    cur.Curso AS NombreCurso,
                    cur.Código AS CodigoCurso,
                    g.Descripción AS NombreGrado,
                    'Director' AS RolVista,
                    @codigoDocente AS CodigoDocente,
                    NULL AS NombreDocente
                FROM dbo.DirectoresGrupo dg
                JOIN dbo.Cursos cur ON dg.CódigoCurso = cur.Código
                JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
                WHERE dg.CódigoDocente = @codigoDocente

                ORDER BY NombreGrado, NombreCurso;
            `);
        
        return result.recordset;
    } catch (error: unknown) {
        throw new Error('Error al acceder a la base de datos para obtener los cursos del docente.');
    }
};

export const findAllCursosInstitucionales = async (): Promise<CursoDocenteRow[]> => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query<CursoDocenteRow>(`
                SELECT 
                    CAST(asig.Código AS INT) AS CodigoAsignatura,
                    asig.Descripción AS NombreAsignatura,
                    cur.Curso AS NombreCurso,
                    cur.Código AS CodigoCurso,
                    g.Descripción AS NombreGrado,
                    'Institucional' AS RolVista,
                    doc.Código AS CodigoDocente,
                    LTRIM(RTRIM(ISNULL(doc.PrimerNombre, '') + ' ' + ISNULL(doc.PrimerApellido, ''))) AS NombreDocente
                FROM dbo.AsignaciónAcadémica aa
                JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
                JOIN dbo.Cursos cur ON asig.CódigoCurso = cur.Código
                JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
                LEFT JOIN dbo.Docentes doc ON aa.CódigoDocente = doc.Código
                ORDER BY g.Código, cur.Código, asig.Descripción;
            `);
        
        return result.recordset;
    } catch (error: unknown) {
        throw new Error('Error al acceder a la base de datos para el catálogo de cursos.');
    }
};
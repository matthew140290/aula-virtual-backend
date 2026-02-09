// src/services/curso.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';


export const findCursosByDocente = async (codigoDocente: number) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('codigoDocente', sql.SmallInt, codigoDocente)
      .query(`
        SELECT 
          CAST(asig.Código AS INT) AS CodigoAsignatura,
          asig.Descripción AS NombreAsignatura,
          cur.Curso AS NombreCurso,
          cur.Código AS CodigoCurso,
          g.Descripción AS NombreGrado,
          'Docente' AS RolVista
        FROM dbo.AsignaciónAcadémica aa
        JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
        JOIN dbo.Cursos cur ON asig.CódigoCurso = cur.Código
        JOIN dbo.Grados g ON cur.CódigoGrado = g.Código 
        WHERE aa.CódigoDocente = @codigoDocente

        UNION ALL

        /* 2. DIRECCIÓN DE GRUPO (Su "asignatura" administrativa) */
        /* Usamos el ID del curso en NEGATIVO para que sea único y no choque con asignaturas reales */
        SELECT 
          CAST((cur.Código * -1) AS INT) AS CodigoAsignatura, 
          'Dirección de Grupo' AS NombreAsignatura,
          cur.Curso AS NombreCurso,
          cur.Código AS CodigoCurso,
          g.Descripción AS NombreGrado,
          'Director' AS RolVista
        FROM dbo.DirectoresGrupo dg
        JOIN dbo.Cursos cur ON dg.CódigoCurso = cur.Código
        JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
        WHERE dg.CódigoDocente = @codigoDocente

        ORDER BY NombreGrado, NombreCurso;
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error al buscar cursos por docente:', error);
    throw new Error('Error al acceder a la base de datos para obtener los cursos.');
  }
};
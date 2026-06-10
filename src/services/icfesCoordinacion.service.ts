import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { ensureIcfesSchema } from './icfesSchema.service';
import type { FiltroCoordinacion } from './icfesTypes';

export const getResumenCoordinacion = async (filtros: FiltroCoordinacion) => {
  await ensureIcfesSchema();
  const pool = await poolPromise;

  const req = pool.request();
  req.input('anio', sql.Int, filtros.anio ?? null);
  req.input('trimestre', sql.Int, filtros.trimestre ?? null);
  req.input('gradoCodigo', sql.Int, filtros.gradoCodigo ?? null);
  req.input('cursoCodigo', sql.Int, filtros.cursoCodigo ?? null);

  const resumenRs = await req.query<{ TotalIntentos: number; PromedioCalificacion: number; EstudiantesUnicos: number; ExamenesUnicos: number }>(`
    SELECT COUNT(*) AS TotalIntentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion, COUNT(DISTINCT i.MatriculaNo) AS EstudiantesUnicos, COUNT(DISTINCT i.ExamenGlobalID) AS ExamenesUnicos
    FROM Virtual.ICFES_IntentosGlobales i
    INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID
    INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo
    INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código]
    INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo);
  `);

  const byCursoReq = pool.request();
  byCursoReq.input('anio', sql.Int, filtros.anio ?? null).input('trimestre', sql.Int, filtros.trimestre ?? null).input('gradoCodigo', sql.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', sql.Int, filtros.cursoCodigo ?? null);
  const byCursoRs = await byCursoReq.query<{ CodigoGrado: number; CodigoCurso: number; NombreGrado: string; NombreCurso: string; Intentos: number; PromedioCalificacion: number }>(`
    SELECT g.[Código] AS CodigoGrado, cur.[Código] AS CodigoCurso, g.[Descripción] AS NombreGrado, cur.[Curso] AS NombreCurso, COUNT(*) AS Intentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion
    FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo)
    GROUP BY g.[Código], cur.[Código], g.[Descripción], cur.[Curso] ORDER BY g.[Descripción], cur.[Curso];
  `);

  const byCompetenciaReq = pool.request();
  byCompetenciaReq.input('anio', sql.Int, filtros.anio ?? null).input('trimestre', sql.Int, filtros.trimestre ?? null).input('gradoCodigo', sql.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', sql.Int, filtros.cursoCodigo ?? null);
  const byCompetenciaRs = await byCompetenciaReq.query<{ Competencia: string; Total: number; Correctas: number }>(`
    SELECT ISNULL(c.NombreCompetencia, 'General') AS Competencia, COUNT(*) AS Total, SUM(CASE WHEN ri.EsCorrecta = 1 THEN 1 ELSE 0 END) AS Correctas
    FROM Virtual.ICFES_RespuestasIntento ri INNER JOIN Virtual.ICFES_IntentosGlobales i ON i.IntentoGlobalID = ri.IntentoGlobalID INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = ri.PreguntaGlobalID LEFT JOIN Virtual.ICFES_CompetenciasExamen c ON c.CompetenciaID = p.CompetenciaID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo)
    GROUP BY ISNULL(c.NombreCompetencia, 'General') ORDER BY Competencia;
  `);

  const rankingReq = pool.request();
  rankingReq.input('anio', sql.Int, filtros.anio ?? null).input('trimestre', sql.Int, filtros.trimestre ?? null).input('gradoCodigo', sql.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', sql.Int, filtros.cursoCodigo ?? null);
  const rankingRs = await rankingReq.query<{ MatriculaNo: number; NombreCompleto: string; NombreGrado: string; NombreCurso: string; Intentos: number; PromedioCalificacion: number }>(`
    SELECT TOP 10 i.MatriculaNo, LTRIM(RTRIM(CONCAT(ISNULL(est.PrimerNombre, ''), ' ', ISNULL(est.SegundoNombre, ''), ' ', ISNULL(est.PrimerApellido, ''), ' ', ISNULL(est.SegundoApellido, '')))) AS NombreCompleto, g.[Descripción] AS NombreGrado, cur.[Curso] AS NombreCurso, COUNT(*) AS Intentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion
    FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo) AND i.Estado = 'Calificado'
    GROUP BY i.MatriculaNo, est.PrimerNombre, est.SegundoNombre, est.PrimerApellido, est.SegundoApellido, g.[Descripción], cur.[Curso] ORDER BY PromedioCalificacion DESC, Intentos DESC;
  `);

  const evolucionReq = pool.request();
  evolucionReq.input('anio', sql.Int, filtros.anio ?? null).input('gradoCodigo', sql.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', sql.Int, filtros.cursoCodigo ?? null);
  const evolucionRs = await evolucionReq.query<{ Trimestre: number; Intentos: number; PromedioCalificacion: number }>(`
    SELECT ISNULL(NULLIF(e.Trimestre, 0), 0) AS Trimestre, COUNT(*) AS Intentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion
    FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo)
    GROUP BY ISNULL(NULLIF(e.Trimestre, 0), 0) ORDER BY Trimestre;
  `);

  return {
    resumen: { totalIntentos: Number(resumenRs.recordset[0]?.TotalIntentos ?? 0), promedioCalificacion: Number(resumenRs.recordset[0]?.PromedioCalificacion ?? 0), estudiantesUnicos: Number(resumenRs.recordset[0]?.EstudiantesUnicos ?? 0), examenesUnicos: Number(resumenRs.recordset[0]?.ExamenesUnicos ?? 0) },
    porCurso: byCursoRs.recordset.map(r => ({ codigoGrado: Number(r.CodigoGrado), codigoCurso: Number(r.CodigoCurso), nombreGrado: r.NombreGrado, nombreCurso: r.NombreCurso, intentos: Number(r.Intentos ?? 0), promedioCalificacion: Number(r.PromedioCalificacion ?? 0) })),
    porCompetencia: byCompetenciaRs.recordset.map(r => ({ competencia: r.Competencia, total: Number(r.Total ?? 0), correctas: Number(r.Correctas ?? 0), porcentajeAcierto: Number(r.Total ?? 0) > 0 ? Math.round((Number(r.Correctas ?? 0) / Number(r.Total ?? 1)) * 100) : 0 })),
    ranking: rankingRs.recordset.map(r => ({ matriculaNo: Number(r.MatriculaNo), nombreCompleto: r.NombreCompleto, nombreGrado: r.NombreGrado, nombreCurso: r.NombreCurso, intentos: Number(r.Intentos ?? 0), promedioCalificacion: Number(r.PromedioCalificacion ?? 0) })),
    evolucionTrimestral: evolucionRs.recordset.map(r => ({ trimestre: Number(r.Trimestre ?? 0), intentos: Number(r.Intentos ?? 0), promedioCalificacion: Number(r.PromedioCalificacion ?? 0) })),
  };
};

export const getOpcionesFiltroCoordinacion = async () => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  const gradosRs = await pool.request().query<{ CodigoGrado: number; NombreGrado: string }>("SELECT DISTINCT g.[Código] AS CodigoGrado, g.[Descripción] AS NombreGrado FROM dbo.Grados g INNER JOIN dbo.Cursos c ON c.[CódigoGrado] = g.[Código] ORDER BY g.[Descripción];");
  const cursosRs = await pool.request().query<{ CodigoCurso: number; CodigoGrado: number; NombreCurso: string }>("SELECT c.[Código] AS CodigoCurso, c.[CódigoGrado] AS CodigoGrado, c.[Curso] AS NombreCurso FROM dbo.Cursos c ORDER BY c.[Curso];");

  return {
    grados: gradosRs.recordset.map(g => ({ codigoGrado: Number(g.CodigoGrado), nombreGrado: g.NombreGrado })),
    cursos: cursosRs.recordset.map(c => ({ codigoCurso: Number(c.CodigoCurso), codigoGrado: Number(c.CodigoGrado), nombreCurso: c.NombreCurso })),
  };
};
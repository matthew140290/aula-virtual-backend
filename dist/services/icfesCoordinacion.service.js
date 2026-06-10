"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpcionesFiltroCoordinacion = exports.getResumenCoordinacion = void 0;
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const icfesSchema_service_1 = require("./icfesSchema.service");
const getResumenCoordinacion = async (filtros) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const req = pool.request();
    req.input('anio', mssql_1.default.Int, filtros.anio ?? null);
    req.input('trimestre', mssql_1.default.Int, filtros.trimestre ?? null);
    req.input('gradoCodigo', mssql_1.default.Int, filtros.gradoCodigo ?? null);
    req.input('cursoCodigo', mssql_1.default.Int, filtros.cursoCodigo ?? null);
    const resumenRs = await req.query(`
    SELECT COUNT(*) AS TotalIntentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion, COUNT(DISTINCT i.MatriculaNo) AS EstudiantesUnicos, COUNT(DISTINCT i.ExamenGlobalID) AS ExamenesUnicos
    FROM Virtual.ICFES_IntentosGlobales i
    INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID
    INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo
    INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código]
    INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo);
  `);
    const byCursoReq = pool.request();
    byCursoReq.input('anio', mssql_1.default.Int, filtros.anio ?? null).input('trimestre', mssql_1.default.Int, filtros.trimestre ?? null).input('gradoCodigo', mssql_1.default.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', mssql_1.default.Int, filtros.cursoCodigo ?? null);
    const byCursoRs = await byCursoReq.query(`
    SELECT g.[Código] AS CodigoGrado, cur.[Código] AS CodigoCurso, g.[Descripción] AS NombreGrado, cur.[Curso] AS NombreCurso, COUNT(*) AS Intentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion
    FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo)
    GROUP BY g.[Código], cur.[Código], g.[Descripción], cur.[Curso] ORDER BY g.[Descripción], cur.[Curso];
  `);
    const byCompetenciaReq = pool.request();
    byCompetenciaReq.input('anio', mssql_1.default.Int, filtros.anio ?? null).input('trimestre', mssql_1.default.Int, filtros.trimestre ?? null).input('gradoCodigo', mssql_1.default.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', mssql_1.default.Int, filtros.cursoCodigo ?? null);
    const byCompetenciaRs = await byCompetenciaReq.query(`
    SELECT ISNULL(c.NombreCompetencia, 'General') AS Competencia, COUNT(*) AS Total, SUM(CASE WHEN ri.EsCorrecta = 1 THEN 1 ELSE 0 END) AS Correctas
    FROM Virtual.ICFES_RespuestasIntento ri INNER JOIN Virtual.ICFES_IntentosGlobales i ON i.IntentoGlobalID = ri.IntentoGlobalID INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = ri.PreguntaGlobalID LEFT JOIN Virtual.ICFES_CompetenciasExamen c ON c.CompetenciaID = p.CompetenciaID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo)
    GROUP BY ISNULL(c.NombreCompetencia, 'General') ORDER BY Competencia;
  `);
    const rankingReq = pool.request();
    rankingReq.input('anio', mssql_1.default.Int, filtros.anio ?? null).input('trimestre', mssql_1.default.Int, filtros.trimestre ?? null).input('gradoCodigo', mssql_1.default.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', mssql_1.default.Int, filtros.cursoCodigo ?? null);
    const rankingRs = await rankingReq.query(`
    SELECT TOP 10 i.MatriculaNo, LTRIM(RTRIM(CONCAT(ISNULL(est.PrimerNombre, ''), ' ', ISNULL(est.SegundoNombre, ''), ' ', ISNULL(est.PrimerApellido, ''), ' ', ISNULL(est.SegundoApellido, '')))) AS NombreCompleto, g.[Descripción] AS NombreGrado, cur.[Curso] AS NombreCurso, COUNT(*) AS Intentos, AVG(CASE WHEN i.Estado = 'Calificado' THEN i.Calificacion END) AS PromedioCalificacion
    FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID INNER JOIN dbo.Estudiantes est ON est.[MatrículaNo] = i.MatriculaNo INNER JOIN dbo.Cursos cur ON est.[CódigoCurso] = cur.[Código] INNER JOIN dbo.Grados g ON cur.[CódigoGrado] = g.[Código]
    WHERE (@anio IS NULL OR e.Anio = @anio) AND (@trimestre IS NULL OR e.Trimestre = @trimestre) AND (@gradoCodigo IS NULL OR g.[Código] = @gradoCodigo) AND (@cursoCodigo IS NULL OR cur.[Código] = @cursoCodigo) AND i.Estado = 'Calificado'
    GROUP BY i.MatriculaNo, est.PrimerNombre, est.SegundoNombre, est.PrimerApellido, est.SegundoApellido, g.[Descripción], cur.[Curso] ORDER BY PromedioCalificacion DESC, Intentos DESC;
  `);
    const evolucionReq = pool.request();
    evolucionReq.input('anio', mssql_1.default.Int, filtros.anio ?? null).input('gradoCodigo', mssql_1.default.Int, filtros.gradoCodigo ?? null).input('cursoCodigo', mssql_1.default.Int, filtros.cursoCodigo ?? null);
    const evolucionRs = await evolucionReq.query(`
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
exports.getResumenCoordinacion = getResumenCoordinacion;
const getOpcionesFiltroCoordinacion = async () => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const gradosRs = await pool.request().query("SELECT DISTINCT g.[Código] AS CodigoGrado, g.[Descripción] AS NombreGrado FROM dbo.Grados g INNER JOIN dbo.Cursos c ON c.[CódigoGrado] = g.[Código] ORDER BY g.[Descripción];");
    const cursosRs = await pool.request().query("SELECT c.[Código] AS CodigoCurso, c.[CódigoGrado] AS CodigoGrado, c.[Curso] AS NombreCurso FROM dbo.Cursos c ORDER BY c.[Curso];");
    return {
        grados: gradosRs.recordset.map(g => ({ codigoGrado: Number(g.CodigoGrado), nombreGrado: g.NombreGrado })),
        cursos: cursosRs.recordset.map(c => ({ codigoCurso: Number(c.CodigoCurso), codigoGrado: Number(c.CodigoGrado), nombreCurso: c.NombreCurso })),
    };
};
exports.getOpcionesFiltroCoordinacion = getOpcionesFiltroCoordinacion;

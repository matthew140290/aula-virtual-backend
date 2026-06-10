"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPeriodosResumen = exports.getActividadReciente = exports.getEstudiantesSinConexion = exports.getDocentesSinCalificar = exports.getResumenGeneral = void 0;
// src/services/dashboard.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
// ==========================================
// QUERIES
// ==========================================
const getResumenGeneral = async () => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM dbo.Docentes d
             JOIN dbo.Usuarios u ON d.Código = u.Código
             WHERE u.Perfil IN ('Docente', 'Director de grupo')) as totalDocentes,
            (SELECT COUNT(*) FROM dbo.Estudiantes e
            WHERE ISNULL(e.Estado, '') NOT IN ('Retirado', 'Desertor')) as totalEstudiantes,
            (SELECT COUNT(*) FROM dbo.Asignaturas) as totalAsignaturas,
            (SELECT COUNT(*) FROM dbo.Cursos) as totalCursos
    `);
    return result.recordset[0] ?? { totalDocentes: 0, totalEstudiantes: 0, totalAsignaturas: 0, totalCursos: 0 };
};
exports.getResumenGeneral = getResumenGeneral;
const getDocentesSinCalificar = async () => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query(`
        -- Tareas con entregas sin calificar
        SELECT
            aa.CódigoDocente as codigoDocente,
            LTRIM(RTRIM(ISNULL(doc.PrimerNombre,'') + ' ' + ISNULL(doc.PrimerApellido,''))) as nombreDocente,
            asig.Descripción as nombreAsignatura,
            cur.Curso as nombreCurso,
            g.Descripción as nombreGrado,
            'Tarea' as tipoRecurso,
            r.Titulo as tituloRecurso,
            COUNT(et.EntregaID) as entregasPendientes
        FROM Virtual.EntregasTareas et
        JOIN Virtual.Tareas t ON et.TareaID = t.TareaID
        JOIN Virtual.Recursos r ON t.RecursoID = r.RecursoID
        JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
        JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
        JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
        JOIN dbo.AsignaciónAcadémica aa ON asig.Código = aa.CódigoAsignatura
        JOIN dbo.Docentes doc ON aa.CódigoDocente = doc.Código
        JOIN dbo.Cursos cur ON asig.CódigoCurso = cur.Código
        JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
        WHERE et.Calificacion IS NULL
          AND et.FechaEntrega IS NOT NULL
        GROUP BY aa.CódigoDocente, doc.PrimerNombre, doc.PrimerApellido,
                 asig.Descripción, cur.Curso, g.Descripción, r.Titulo

        UNION ALL

        -- Pruebas con resultados pendientes de calificacion manual
        SELECT
            aa.CódigoDocente as codigoDocente,
            LTRIM(RTRIM(ISNULL(doc.PrimerNombre,'') + ' ' + ISNULL(doc.PrimerApellido,''))) as nombreDocente,
            asig.Descripción as nombreAsignatura,
            cur.Curso as nombreCurso,
            g.Descripción as nombreGrado,
            'Prueba' as tipoRecurso,
            r.Titulo as tituloRecurso,
            COUNT(pr.ResultadoID) as entregasPendientes
        FROM Virtual.PruebasResultados pr
        JOIN Virtual.Pruebas p ON pr.PruebaID = p.PruebaID
        JOIN Virtual.Recursos r ON p.RecursoID = r.RecursoID
        JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
        JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
        JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
        JOIN dbo.AsignaciónAcadémica aa ON asig.Código = aa.CódigoAsignatura
        JOIN dbo.Docentes doc ON aa.CódigoDocente = doc.Código
        JOIN dbo.Cursos cur ON asig.CódigoCurso = cur.Código
        JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
        WHERE pr.RequiereCalificacionManual = 1
          AND pr.Estado = 'Pendiente'
        GROUP BY aa.CódigoDocente, doc.PrimerNombre, doc.PrimerApellido,
                 asig.Descripción, cur.Curso, g.Descripción, r.Titulo

        ORDER BY entregasPendientes DESC;
    `);
    return result.recordset;
};
exports.getDocentesSinCalificar = getDocentesSinCalificar;
/**
 * FIX CRÍTICO: Usuarios tiene PK compuesta (Código, Perfil).
 * Un docente y un estudiante pueden compartir el mismo Código numérico.
 * Sin filtrar por PerfilUsuario en RegistroOperacionesUsuarios, el OUTER APPLY
 * hacía match con logins de DOCENTES, mostrando erróneamente que el estudiante
 * "ya ingresó".
 *
 * Solución: JOIN a Usuarios para obtener el Perfil real del estudiante y filtrar
 * en RegistroOperacionesUsuarios por AMBAS columnas (CódigoUsuario + PerfilUsuario).
 */
const getEstudiantesSinConexion = async (diasMinimo = 7) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('diasMinimo', mssql_1.default.Int, diasMinimo)
        .query(`
            SET DATEFORMAT mdy;
            SELECT
                e.MatrículaNo as matriculaNo,
                LTRIM(RTRIM(CONCAT(
                    ISNULL(e.PrimerNombre, ''), ' ',
                    ISNULL(e.SegundoNombre, ''), ' ',
                    ISNULL(e.PrimerApellido, ''), ' ',
                    ISNULL(e.SegundoApellido, '')
                ))) as nombreCompleto,
                ISNULL(e.NúmeroDocumento, '') as documento,
                ISNULL(cur.Curso, '') as nombreCurso,
                ISNULL(g.Descripción, '') as nombreGrado,
                sub.ultimoIngreso,
                CASE
                    WHEN sub.ultimoIngreso IS NULL THEN 9999
                    ELSE DATEDIFF(DAY, sub.ultimoIngreso, GETDATE())
                END as diasSinConexion
            FROM dbo.Estudiantes e
            LEFT JOIN dbo.Usuarios u ON (e.MatrículaNo = u.Código OR e.MatrículaNo = (u.Código * -1))
            JOIN dbo.Cursos cur ON e.CódigoCurso = cur.Código
            JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
            OUTER APPLY (
                SELECT MAX(TRY_CAST(r.Fecha + ' ' + r.Hora AS DATETIME)) as ultimoIngreso
                FROM dbo.RegistroOperacionesUsuarios r
                WHERE (r.CódigoUsuario = u.Código OR r.CódigoUsuario = (u.Código * -1))
                AND r.PerfilUsuario = u.Perfil
                AND (r.Menú = 'Login' OR r.Opción = 'Login')
            ) sub
            WHERE ISNULL(e.Estado, '') NOT IN ('Retirado', 'Desertor')
              AND (sub.ultimoIngreso IS NULL OR DATEDIFF(DAY, sub.ultimoIngreso, GETDATE()) >= @diasMinimo)
            ORDER BY diasSinConexion DESC;
        `);
    return result.recordset;
};
exports.getEstudiantesSinConexion = getEstudiantesSinConexion;
const getActividadReciente = async (limite = 20) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('limite', mssql_1.default.Int, limite)
        .query(`
            SELECT TOP (@limite)
                r.RecursoID as recursoId,
                r.Titulo as titulo,
                r.TipoRecurso as tipoRecurso,
                asig.Descripción as nombreAsignatura,
                LTRIM(RTRIM(ISNULL(doc.PrimerNombre,'') + ' ' + ISNULL(doc.PrimerApellido,''))) as nombreDocente,
                r.FechaCreacion as fechaCreacion
            FROM Virtual.Recursos r
            JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
            JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
            JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
            JOIN dbo.AsignaciónAcadémica aa ON asig.Código = aa.CódigoAsignatura
            JOIN dbo.Docentes doc ON aa.CódigoDocente = doc.Código
            ORDER BY r.FechaCreacion DESC;
        `);
    return result.recordset;
};
exports.getActividadReciente = getActividadReciente;
const getPeriodosResumen = async () => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query(`
        SELECT
            p.Número as numero,
            p.Descripción as descripcion,
            CASE
                WHEN cp.BloqueadoManualmente = 1 THEN CAST(0 AS BIT)
                WHEN cp.FechaApertura IS NOT NULL AND cp.FechaCierre IS NOT NULL
                     AND GETDATE() BETWEEN cp.FechaApertura AND cp.FechaCierre THEN CAST(1 AS BIT)
                WHEN cp.FechaApertura IS NOT NULL AND cp.FechaCierre IS NOT NULL
                     AND GETDATE() NOT BETWEEN cp.FechaApertura AND cp.FechaCierre THEN CAST(0 AS BIT)
                WHEN cp.ControlPeriodoID IS NULL THEN CAST(1 AS BIT)
                ELSE CAST(1 AS BIT)
            END as abierto,
            ISNULL(cp.BloqueadoManualmente, 0) as bloqueado,
            (
                SELECT COUNT(*)
                FROM Virtual.ExcepcionesPeriodo ex
                WHERE ex.NumeroPeriodo = p.Número
                  AND ex.FechaLimiteExcepcion > GETDATE()
            ) as totalExcepciones
        FROM dbo.Períodos p
        LEFT JOIN Virtual.ControlPeriodos cp ON p.Número = cp.NumeroPeriodo
        WHERE p.Descripción != 'Final'
        ORDER BY p.Número;
    `);
    return result.recordset;
};
exports.getPeriodosResumen = getPeriodosResumen;

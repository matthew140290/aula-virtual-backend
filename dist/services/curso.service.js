"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllCursosInstitucionales = exports.findCursosByDocente = void 0;
// src/services/curso.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const findCursosByDocente = async (codigoDocente) => {
    try {
        const pool = await dbPool_1.poolPromise;
        const result = await pool.request()
            .input('codigoDocente', mssql_1.default.SmallInt, codigoDocente)
            .query(`
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
    }
    catch (error) {
        throw new Error('Error al acceder a la base de datos para obtener los cursos del docente.');
    }
};
exports.findCursosByDocente = findCursosByDocente;
const findAllCursosInstitucionales = async () => {
    try {
        const pool = await dbPool_1.poolPromise;
        const result = await pool.request()
            .query(`
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
    }
    catch (error) {
        throw new Error('Error al acceder a la base de datos para el catálogo de cursos.');
    }
};
exports.findAllCursosInstitucionales = findAllCursosInstitucionales;

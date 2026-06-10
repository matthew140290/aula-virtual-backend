"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eliminarRespuestaAnuncio = exports.crearRespuestaAnuncio = exports.getRespuestasAnuncio = void 0;
// src/services/anuncio.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const log_service_1 = require("./log.service");
const getRespuestasAnuncio = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    // Hacemos JOIN con Usuarios para obtener el nombre del autor
    const query = `
        SELECT 
            r.RespuestaID, 
            r.ContenidoHTML, 
            r.FechaCreacion, 
            r.UsuarioID, 
            r.PerfilUsuario,
            U.NombreCompleto AS NombreAutor
        FROM Virtual.AnuncioRespuestas r
        INNER JOIN dbo.Usuarios U ON r.UsuarioID = U.Código AND r.PerfilUsuario = U.Perfil
        WHERE r.RecursoID = @recursoId
        ORDER BY r.FechaCreacion ASC
    `;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(query);
    return result.recordset;
};
exports.getRespuestasAnuncio = getRespuestasAnuncio;
const crearRespuestaAnuncio = async (recursoId, usuarioId, perfil, contenido) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        await new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .input('usuarioId', mssql_1.default.Int, usuarioId)
            .input('perfil', mssql_1.default.NVarChar(96), perfil)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), contenido)
            .query(`
                INSERT INTO Virtual.AnuncioRespuestas (RecursoID, UsuarioID, PerfilUsuario, ContenidoHTML, FechaCreacion)
                VALUES (@recursoId, @usuarioId, @perfil, @contenido, GETUTCDATE());
            `);
        await tx.commit();
        // Log de auditoría
        (0, log_service_1.registrarAccion)(usuarioId, perfil, 'Aula Virtual', 'Anuncio', `Comentó en anuncio ${recursoId}`).catch(console.error);
        return true;
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.crearRespuestaAnuncio = crearRespuestaAnuncio;
const eliminarRespuestaAnuncio = async (respuestaId, usuarioId, perfil) => {
    const pool = await dbPool_1.poolPromise;
    const isDocente = perfil.includes('Docente') || perfil.includes('Director');
    let query = '';
    // Si es docente, borra sin preguntar dueño
    if (isDocente) {
        query = 'DELETE FROM Virtual.AnuncioRespuestas WHERE RespuestaID = @respuestaId';
    }
    else {
        // Si es estudiante, solo borra si es SU comentario
        query = `
            DELETE FROM Virtual.AnuncioRespuestas 
            WHERE RespuestaID = @respuestaId 
            AND UsuarioID = @usuarioId 
            AND PerfilUsuario = @perfil
        `;
    }
    const result = await pool.request()
        .input('respuestaId', mssql_1.default.Int, respuestaId)
        .input('usuarioId', mssql_1.default.Int, usuarioId)
        .input('perfil', mssql_1.default.NVarChar(96), perfil)
        .query(query);
    return result.rowsAffected[0] > 0;
};
exports.eliminarRespuestaAnuncio = eliminarRespuestaAnuncio;

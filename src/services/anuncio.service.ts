// src/services/anuncio.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { registrarAccion } from './log.service';

export const getRespuestasAnuncio = async (recursoId: number) => {
    const pool = await poolPromise;
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
        .input('recursoId', sql.Int, recursoId)
        .query(query);
        
    return result.recordset;
};

export const crearRespuestaAnuncio = async (recursoId: number, usuarioId: number, perfil: string, contenido: string) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    
    try {
        await tx.begin();
        
        await new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('usuarioId', sql.Int, usuarioId)
            .input('perfil', sql.NVarChar(96), perfil)
            .input('contenido', sql.NVarChar(sql.MAX), contenido)
            .query(`
                INSERT INTO Virtual.AnuncioRespuestas (RecursoID, UsuarioID, PerfilUsuario, ContenidoHTML, FechaCreacion)
                VALUES (@recursoId, @usuarioId, @perfil, @contenido, GETUTCDATE());
            `);

        await tx.commit();
        
        // Log de auditoría
        registrarAccion(usuarioId, perfil, 'Aula Virtual', 'Anuncio', `Comentó en anuncio ${recursoId}`).catch(console.error);
        
        return true;
    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const eliminarRespuestaAnuncio = async (respuestaId: number, usuarioId: number, perfil: string): Promise<boolean> => {
    const pool = await poolPromise;
    const isDocente = perfil.includes('Docente') || perfil.includes('Director');

    let query = '';
    
    // Si es docente, borra sin preguntar dueño
    if (isDocente) {
        query = 'DELETE FROM Virtual.AnuncioRespuestas WHERE RespuestaID = @respuestaId';
    } else {
        // Si es estudiante, solo borra si es SU comentario
        query = `
            DELETE FROM Virtual.AnuncioRespuestas 
            WHERE RespuestaID = @respuestaId 
            AND UsuarioID = @usuarioId 
            AND PerfilUsuario = @perfil
        `;
    }

    const result = await pool.request()
        .input('respuestaId', sql.Int, respuestaId)
        .input('usuarioId', sql.Int, usuarioId)
        .input('perfil', sql.NVarChar(96), perfil)
        .query(query);

    return result.rowsAffected[0] > 0;
};
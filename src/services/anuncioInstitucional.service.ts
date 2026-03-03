// src/services/anuncioInstitucional.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { registrarAccion } from './log.service';

export interface AnuncioInstitucionalRow {
    anuncioId: number;
    titulo: string;
    contenidoHTML: string;
    fechaPublicacion: Date;
    codigoUsuario: number;
    perfilUsuario: string;
    nombreUsuario: string;
    activo: boolean;
}

export const getAnunciosInstitucionales = async (): Promise<AnuncioInstitucionalRow[]> => {
    const pool = await poolPromise;
    const result = await pool.request().query<AnuncioInstitucionalRow>(`
        SELECT 
            a.AnuncioID as anuncioId,
            a.Titulo as titulo,
            a.ContenidoHTML as contenidoHTML,
            a.FechaPublicacion as fechaPublicacion,
            a.CodigoUsuario as codigoUsuario,
            a.PerfilUsuario as perfilUsuario,
            a.Activo as activo,
            u.NombreCompleto AS nombreUsuario
        FROM Virtual.AnunciosInstitucionales a
        LEFT JOIN dbo.Usuarios u ON a.CodigoUsuario = u.Código 
        ORDER BY a.FechaPublicacion DESC
    `);
    return result.recordset;
};

export const createAnuncioInstitucional = async (
    titulo: string, 
    contenido: string, 
    codigoUsuario: number, 
    perfilUsuario: string
): Promise<AnuncioInstitucionalRow> => {
    const pool = await poolPromise;
    
    const result = await pool.request()
        .input('titulo', sql.NVarChar(1024), titulo)
        .input('contenido', sql.NVarChar(sql.MAX), contenido)
        .input('codigoUsuario', sql.SmallInt, codigoUsuario)
        .input('perfilUsuario', sql.NVarChar(96), perfilUsuario)
        .query(`
            INSERT INTO Virtual.AnunciosInstitucionales (Titulo, ContenidoHTML, CodigoUsuario, PerfilUsuario, FechaPublicacion, Activo)
            OUTPUT INSERTED.AnuncioID
            VALUES (@titulo, @contenido, @codigoUsuario, @perfilUsuario, GETDATE(), 1);
        `);
    
    const insertedId = result.recordset[0].AnuncioID;

    await registrarAccion(codigoUsuario, perfilUsuario, 'Administración', 'Anuncios Institucionales', `Creó anuncio institucional: ${titulo}`);

    const newAnuncioResult = await pool.request()
        .input('id', sql.Int, insertedId)
        .query<AnuncioInstitucionalRow>(`
            SELECT 
                a.AnuncioID as anuncioId, a.Titulo as titulo, a.ContenidoHTML as contenidoHTML, 
                a.FechaPublicacion as fechaPublicacion, a.CodigoUsuario as codigoUsuario, 
                a.PerfilUsuario as perfilUsuario, a.Activo as activo, u.NombreCompleto AS nombreUsuario
            FROM Virtual.AnunciosInstitucionales a
            LEFT JOIN dbo.Usuarios u ON a.CodigoUsuario = u.Código
            WHERE a.AnuncioID = @id
        `);

    return newAnuncioResult.recordset[0];
};

export const updateAnuncioInstitucional = async (
    id: number, 
    titulo: string, 
    contenido: string,
    codigoUsuario: number,
    perfilUsuario: string
): Promise<AnuncioInstitucionalRow> => {
    const pool = await poolPromise;
    
    await pool.request()
        .input('id', sql.Int, id)
        .input('titulo', sql.NVarChar(1024), titulo)
        .input('contenido', sql.NVarChar(sql.MAX), contenido)
        .query(`
            UPDATE Virtual.AnunciosInstitucionales
            SET Titulo = @titulo, ContenidoHTML = @contenido
            WHERE AnuncioID = @id
        `);

    await registrarAccion(codigoUsuario, perfilUsuario, 'Administración', 'Anuncios Institucionales', `Editó anuncio institucional ID: ${id}`);

    const updatedAnuncioResult = await pool.request()
        .input('id', sql.Int, id)
        .query<AnuncioInstitucionalRow>(`
            SELECT 
                a.AnuncioID as anuncioId, a.Titulo as titulo, a.ContenidoHTML as contenidoHTML, 
                a.FechaPublicacion as fechaPublicacion, a.CodigoUsuario as codigoUsuario, 
                a.PerfilUsuario as perfilUsuario, a.Activo as activo, u.NombreCompleto AS nombreUsuario
            FROM Virtual.AnunciosInstitucionales a
            LEFT JOIN dbo.Usuarios u ON a.CodigoUsuario = u.Código
            WHERE a.AnuncioID = @id
        `);

    return updatedAnuncioResult.recordset[0];
};

export const deleteAnuncioInstitucional = async (id: number, codigoUsuario: number, perfilUsuario: string): Promise<void> => {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM Virtual.AnunciosInstitucionales WHERE AnuncioID = @id`);

    await registrarAccion(codigoUsuario, perfilUsuario, 'Administración', 'Anuncios Institucionales', `Eliminó anuncio institucional ID: ${id}`);
};

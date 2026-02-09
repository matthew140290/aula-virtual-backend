import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { registrarAccion } from './log.service';

// Interfaz para una entrada del foro, incluyendo posibles respuestas anidadas
export interface ForoEntrada {
    EntradaID: number;
    ContenidoHTML: string;
    FechaCreacion: string;
    Editado: boolean;
    FechaEdicion: string | null;
    UsuarioID: number;
    NombreCompletoAutor: string;
    PerfilAutor: string;
    EntradaPadreID: number | null;
    respuestas: ForoEntrada[]; // Para anidar las respuestas
}

// Interfaz para los datos de una nueva entrada
interface NuevaEntradaPayload {
    recursoId: number;
    usuarioId: number;
    perfilUsuario: string;
    contenidoHTML: string;
    entradaPadreId?: number;
    adjunto?: Express.Multer.File;
}

interface UserActor {
    codigo: number;
    perfil: string;
}

interface ArchivoAdjuntoPayload {
    nombreOriginal: string;
    mimetype: string;
    buffer: string; // Base64
    tamano: number;
}

export const getEntradasDelForo = async (recursoId: number): Promise<ForoEntrada[]> => {
    const pool = await poolPromise;

    const queryHilo = `
        ;WITH EntradasRecursivas AS (
            SELECT 
                EntradaID, RecursoID, UsuarioID, PerfilUsuario, ContenidoHTML, 
                FechaCreacion, EntradaPadreID, Editado, FechaEdicion
            FROM Virtual.ForoEntradas
            WHERE RecursoID = @recursoId AND EntradaPadreID IS NULL

            UNION ALL

            SELECT 
                e.EntradaID, e.RecursoID, e.UsuarioID, e.PerfilUsuario, e.ContenidoHTML, 
                e.FechaCreacion, e.EntradaPadreID, e.Editado, e.FechaEdicion
            FROM Virtual.ForoEntradas e
            INNER JOIN EntradasRecursivas er ON e.EntradaPadreID = er.EntradaID
            WHERE e.RecursoID = @recursoId
        )
        SELECT 
            er.*,
            U.NombreCompleto AS NombreCompletoAutor,
            er.PerfilUsuario AS PerfilAutor
        FROM EntradasRecursivas er
        INNER JOIN dbo.Usuarios U ON er.UsuarioID = U.Código AND er.PerfilUsuario = U.Perfil
        ORDER BY er.FechaCreacion ASC;
    `;


    const queryAdjuntos = `
        SELECT adj.EntradaID, adj.NombreArchivo
        FROM Virtual.ForoEntradaAdjuntos adj
        JOIN Virtual.ForoEntradas e ON adj.EntradaID = e.EntradaID
        WHERE e.RecursoID = @recursoId;
    `;

    const [resultHilo, resultAdjuntos] = await Promise.all([
        pool.request().input('recursoId', sql.Int, recursoId).query(queryHilo),
        pool.request().input('recursoId', sql.Int, recursoId).query(queryAdjuntos)
    ]);

    // Mapeamos los adjuntos para un acceso rápido
    const adjuntosMap = new Map<number, any>();
    resultAdjuntos.recordset.forEach(adj => {
        adjuntosMap.set(adj.EntradaID, {
            NombreArchivo: adj.NombreArchivo
        });
    });

    // Función para construir el árbol, ahora añadiendo el adjunto desde el mapa
    const construirArbol = (list: any[]): ForoEntrada[] => {
        const map = new Map<number, ForoEntrada>();
        const roots: ForoEntrada[] = [];

        list.forEach(item => {
            map.set(item.EntradaID, {
                ...item,
                adjunto: adjuntosMap.get(item.EntradaID) || null, // <-- Asignamos el adjunto
                respuestas: []
            });
        });

        list.forEach(item => {
            if (item.EntradaPadreID) {
                const parent = map.get(item.EntradaPadreID);
                if (parent) {
                    parent.respuestas.push(map.get(item.EntradaID)!);
                }
            } else {
                roots.push(map.get(item.EntradaID)!);
            }
        });

        // Ordenamos las respuestas de más nueva a más antigua en cada nivel
        const sortRecursive = (entradas: ForoEntrada[]) => {
            entradas.sort((a, b) => new Date(b.FechaCreacion).getTime() - new Date(a.FechaCreacion).getTime());
            entradas.forEach(e => {
                if (e.respuestas.length > 0) {
                    sortRecursive(e.respuestas);
                }
            });
        };
        sortRecursive(roots);

        return roots;
    };
    
    return construirArbol(resultHilo.recordset);
};


export const crearNuevaEntrada = async (data: NuevaEntradaPayload, actor?: UserActor): Promise<number> => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        const result = await request
            .input('recursoId', sql.Int, data.recursoId)
            .input('usuarioId', sql.SmallInt, data.usuarioId)
            .input('perfilUsuario', sql.NVarChar(96), data.perfilUsuario)
            .input('contenidoHTML', sql.NVarChar(sql.MAX), data.contenidoHTML)
            .input('entradaPadreId', sql.Int, data.entradaPadreId)
            .query(`
                INSERT INTO Virtual.ForoEntradas (RecursoID, UsuarioID, PerfilUsuario, ContenidoHTML, EntradaPadreID, FechaCreacion)
                OUTPUT INSERTED.EntradaID
                VALUES (@recursoId, @usuarioId, @perfilUsuario, @contenidoHTML, @entradaPadreId, GETUTCDATE());
            `);
        
        const newEntradaId = result.recordset[0].EntradaID;


        if (data.adjunto) {
            await new sql.Request(transaction)
                .input('entradaId', sql.Int, newEntradaId)
                .input('nombreArchivo', sql.NVarChar(1024), data.adjunto.originalname)
                .input('imagenData', sql.VarBinary(sql.MAX), data.adjunto.buffer) // Usamos el buffer
                .input('imagenMimeType', sql.VarChar(100), data.adjunto.mimetype)
                .query(`
                    INSERT INTO Virtual.ForoEntradaAdjuntos (EntradaID, NombreArchivo, ImagenData, ImagenMimeType)
                    VALUES (@entradaId, @nombreArchivo, @imagenData, @imagenMimeType);
                `);
        }

        await transaction.commit();
        if (actor) {
                    const operacion = `Creó una nueva entrada en el Foro titulado: "${data.recursoId}"`;
                    await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Foros', operacion);
                }
        return newEntradaId;
    } catch (error) {
        await transaction.rollback();
        console.error("Error en transacción de crear entrada:", error);
        throw error;
    }
};

export const actualizarEntrada = async (
    entradaId: number, 
    contenidoHTML: string, 
    usuarioId: number, 
    perfilUsuario: string,
    adjunto?: Express.Multer.File | null 
): Promise<boolean> => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        
        // Primero, actualizamos el texto de la entrada principal
        const result = await new sql.Request(transaction)
            .input('entradaId', sql.Int, entradaId)
            .input('contenidoHTML', sql.NVarChar(sql.MAX), contenidoHTML)
            .input('usuarioId', sql.SmallInt, usuarioId)
            .input('perfilUsuario', sql.NVarChar(96), perfilUsuario)
            .query(`
                UPDATE Virtual.ForoEntradas
                SET ContenidoHTML = @contenidoHTML, Editado = 1, FechaEdicion = GETUTCDATE()
                WHERE EntradaID = @entradaId 
                  AND UsuarioID = @usuarioId AND PerfilUsuario = @perfilUsuario;
            `);
        
        // Si el usuario no es el autor, no hacemos nada más y revertimos.
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return false;
        }

        // 💡 Ahora, manejamos el archivo adjunto
        if (adjunto === null) {
            // Si el adjunto es 'null', el usuario quiere borrar el existente.
            await new sql.Request(transaction)
                .input('entradaId', sql.Int, entradaId)
                .query('DELETE FROM Virtual.ForoEntradaAdjuntos WHERE EntradaID = @entradaId');
        } else if (adjunto) {
            // Si se proporciona un nuevo archivo, hacemos un "UPSERT" (actualizar o insertar).
            await new sql.Request(transaction)
                .input('entradaId', sql.Int, entradaId)
                .input('nombreArchivo', sql.NVarChar(1024), adjunto.originalname)
                .input('imagenData', sql.VarBinary(sql.MAX), adjunto.buffer)
                .input('imagenMimeType', sql.VarChar(100), adjunto.mimetype)
                .query(`
                    MERGE Virtual.ForoEntradaAdjuntos AS target
                    USING (SELECT @entradaId AS EntradaID) AS source
                    ON (target.EntradaID = source.EntradaID)
                    WHEN MATCHED THEN
                        UPDATE SET 
                            NombreArchivo = @nombreArchivo,
                            ImagenData = @imagenData,
                            ImagenMimeType = @imagenMimeType
                    WHEN NOT MATCHED THEN
                        INSERT (EntradaID, NombreArchivo, ImagenData, ImagenMimeType)
                        VALUES (@entradaId, @nombreArchivo, @imagenData, @imagenMimeType);
                `);
        }
        // Si 'adjunto' es 'undefined', no hacemos nada y el archivo existente se conserva.

        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error("Error en transacción de actualizar entrada:", error);
        throw error;
    }
};

export const eliminarEntrada = async (entradaId: number, usuarioId: number, perfilUsuario: string): Promise<boolean> => {
    const pool = await poolPromise;
    // Iniciamos una transacción para asegurar que ambas operaciones (update y delete) se completen
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const mensajeEliminado = perfilUsuario.includes('Docente') 
            ? '[Mensaje eliminado por un moderador]' 
            : '[Mensaje eliminado por el autor]';
        
        const request = new sql.Request(transaction); // Usamos la transacción para el request
        request
            .input('entradaId', sql.Int, entradaId)
            .input('contenidoHTML', sql.NVarChar(sql.MAX), `<p><i>${mensajeEliminado}</i></p>`)
            .input('usuarioId', sql.SmallInt, usuarioId)
            .input('perfilUsuario', sql.NVarChar(96), perfilUsuario);
        
        let updateQuery: string;

        // Si el usuario es docente, puede eliminar cualquier entrada.
        if (perfilUsuario.includes('Docente')) {
            updateQuery = `
                UPDATE Virtual.ForoEntradas
                SET ContenidoHTML = @contenidoHTML 
                WHERE EntradaID = @entradaId;
            `;
        } else {
            // Si es estudiante, solo puede eliminar las suyas.
            updateQuery = `
                UPDATE Virtual.ForoEntradas
                SET ContenidoHTML = @contenidoHTML 
                WHERE 
                    EntradaID = @entradaId 
                    AND UsuarioID = @usuarioId 
                    AND PerfilUsuario = @perfilUsuario;
            `;
        }
        
        // 1. Actualizamos el texto de la entrada (soft delete)
        const result = await request.query(updateQuery);

        // Si la actualización no afectó a ninguna fila (ej: un estudiante intentando borrar el post de otro)
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback(); // Deshacemos la transacción
            return false;
        }

        // 2. AHORA, eliminamos el adjunto asociado de la otra tabla
        await new sql.Request(transaction)
            .input('entradaIdForDelete', sql.Int, entradaId)
            .query('DELETE FROM Virtual.ForoEntradaAdjuntos WHERE EntradaID = @entradaIdForDelete');
        
        // Si todo salió bien, confirmamos los cambios en la base de datos
        await transaction.commit();
        
        return true;

    } catch (error) {
        // Si algo falla, deshacemos todos los cambios
        await transaction.rollback();
        console.error("Error en la transacción de eliminar entrada:", error);
        throw error; // Propagamos el error
    }
};

export const getCalificacionesForo = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(`
            WITH ConteoParticipaciones AS (
                SELECT 
                    UsuarioID, 
                    COUNT(EntradaID) as Total
                FROM Virtual.ForoEntradas
                WHERE RecursoID = @recursoId
                GROUP BY UsuarioID
            ),
            CalificacionesExistentes AS (
                SELECT 
                    MatriculaNo, 
                    Calificacion, 
                    ComentarioProfesor
                FROM Virtual.ForoCalificaciones
                WHERE RecursoID = @recursoId
            )
            SELECT 
                -- Si existe nota usamos esa matricula, si no, usamos el ID del usuario que participó
                COALESCE(c.MatriculaNo, p.UsuarioID) AS MatriculaNo,
                c.Calificacion,
                c.ComentarioProfesor,
                ISNULL(p.Total, 0) AS TotalParticipaciones
            FROM CalificacionesExistentes c
            FULL OUTER JOIN ConteoParticipaciones p ON c.MatriculaNo = p.UsuarioID
            WHERE c.MatriculaNo IS NOT NULL OR p.UsuarioID IS NOT NULL
        `);
    return result.recordset;
};

export const guardarCalificacion = async (recursoId: number, matriculaNo: number, calificacion: number, comentario: string) => {
    const pool = await poolPromise;
    await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .input('matriculaNo', sql.Int, matriculaNo)
        .input('calificacion', sql.Decimal(5, 2), calificacion)
        .input('comentario', sql.NVarChar(sql.MAX), comentario)
        .query(`
            MERGE Virtual.ForoCalificaciones AS target
            USING (SELECT @recursoId AS RecursoID, @matriculaNo AS MatriculaNo) AS source
            ON (target.RecursoID = source.RecursoID AND target.MatriculaNo = source.MatriculaNo)
            WHEN MATCHED THEN
                UPDATE SET Calificacion = @calificacion, ComentarioProfesor = @comentario, FechaCalificacion = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (RecursoID, MatriculaNo, Calificacion, ComentarioProfesor)
                VALUES (@recursoId, @matriculaNo, @calificacion, @comentario);
        `);
};

export const findAdjuntoDeEntrada = async (entradaId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('entradaId', sql.Int, entradaId)
        .query('SELECT ImagenData, ImagenMimeType FROM Virtual.ForoEntradaAdjuntos WHERE EntradaID = @entradaId');
    return result.recordset[0];
};
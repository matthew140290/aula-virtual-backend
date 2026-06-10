"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRecursoIdByEntradaId = exports.findAdjuntoDeEntrada = exports.guardarCalificacion = exports.getCalificacionesForo = exports.eliminarEntrada = exports.actualizarEntrada = exports.crearNuevaEntrada = exports.getEntradasDelForo = void 0;
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const log_service_1 = require("./log.service");
const getEntradasDelForo = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
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
        pool.request().input('recursoId', mssql_1.default.Int, recursoId).query(queryHilo),
        pool.request().input('recursoId', mssql_1.default.Int, recursoId).query(queryAdjuntos)
    ]);
    // Mapeamos los adjuntos para un acceso rápido
    const adjuntosMap = new Map();
    resultAdjuntos.recordset.forEach(adj => {
        adjuntosMap.set(adj.EntradaID, {
            NombreArchivo: adj.NombreArchivo
        });
    });
    // Función para construir el árbol, ahora añadiendo el adjunto desde el mapa
    const construirArbol = (list) => {
        const map = new Map();
        const roots = [];
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
                    parent.respuestas.push(map.get(item.EntradaID));
                }
            }
            else {
                roots.push(map.get(item.EntradaID));
            }
        });
        // Ordenamos las respuestas de más nueva a más antigua en cada nivel
        const sortRecursive = (entradas) => {
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
exports.getEntradasDelForo = getEntradasDelForo;
const crearNuevaEntrada = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        // Resolver el Código real en dbo.Usuarios (puede ser negativo para estudiantes)
        const idPositivo = Math.abs(data.usuarioId);
        const userLookup = await new mssql_1.default.Request(transaction)
            .input('idPos', mssql_1.default.Int, idPositivo)
            .input('perfil', mssql_1.default.NVarChar(96), data.perfilUsuario)
            .query(`
                SELECT TOP 1 Código 
                FROM dbo.Usuarios 
                WHERE (Código = @idPos OR Código = (@idPos * -1)) 
                  AND Perfil = @perfil
            `);
        const usuarioIdReal = userLookup.recordset.length > 0
            ? userLookup.recordset[0].Código
            : data.usuarioId;
        const request = new mssql_1.default.Request(transaction);
        const result = await request
            .input('recursoId', mssql_1.default.Int, data.recursoId)
            .input('usuarioId', mssql_1.default.SmallInt, usuarioIdReal)
            .input('perfilUsuario', mssql_1.default.NVarChar(96), data.perfilUsuario)
            .input('contenidoHTML', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenidoHTML)
            .input('entradaPadreId', mssql_1.default.Int, data.entradaPadreId)
            .query(`
                INSERT INTO Virtual.ForoEntradas (RecursoID, UsuarioID, PerfilUsuario, ContenidoHTML, EntradaPadreID, FechaCreacion)
                OUTPUT INSERTED.EntradaID
                VALUES (@recursoId, @usuarioId, @perfilUsuario, @contenidoHTML, @entradaPadreId, GETDATE());
            `);
        const newEntradaId = result.recordset[0].EntradaID;
        if (data.adjunto) {
            await new mssql_1.default.Request(transaction)
                .input('entradaId', mssql_1.default.Int, newEntradaId)
                .input('nombreArchivo', mssql_1.default.NVarChar(1024), data.adjunto.originalname)
                .input('imagenData', mssql_1.default.VarBinary(mssql_1.default.MAX), data.adjunto.buffer) // Usamos el buffer
                .input('imagenMimeType', mssql_1.default.VarChar(100), data.adjunto.mimetype)
                .query(`
                    INSERT INTO Virtual.ForoEntradaAdjuntos (EntradaID, NombreArchivo, ImagenData, ImagenMimeType)
                    VALUES (@entradaId, @nombreArchivo, @imagenData, @imagenMimeType);
                `);
        }
        await transaction.commit();
        if (actor) {
            const operacion = `Creó una nueva entrada en el Foro titulado: "${data.recursoId}"`;
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Foros', operacion);
        }
        return newEntradaId;
    }
    catch (error) {
        await transaction.rollback();
        console.error("Error en transacción de crear entrada:", error);
        throw error;
    }
};
exports.crearNuevaEntrada = crearNuevaEntrada;
const actualizarEntrada = async (entradaId, contenidoHTML, usuarioId, perfilUsuario, adjunto) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const idPositivo = Math.abs(usuarioId);
        const userLookup = await new mssql_1.default.Request(transaction)
            .input('idPos', mssql_1.default.Int, idPositivo)
            .input('perfil', mssql_1.default.NVarChar(96), perfilUsuario)
            .query(`
                SELECT TOP 1 Código FROM dbo.Usuarios 
                WHERE (Código = @idPos OR Código = (@idPos * -1)) AND Perfil = @perfil
            `);
        const usuarioIdReal = userLookup.recordset.length > 0 ? userLookup.recordset[0].Código : usuarioId;
        // Primero, actualizamos el texto de la entrada principal
        const result = await new mssql_1.default.Request(transaction)
            .input('entradaId', mssql_1.default.Int, entradaId)
            .input('contenidoHTML', mssql_1.default.NVarChar(mssql_1.default.MAX), contenidoHTML)
            .input('usuarioId', mssql_1.default.SmallInt, usuarioIdReal)
            .input('perfilUsuario', mssql_1.default.NVarChar(96), perfilUsuario)
            .query(`
                UPDATE Virtual.ForoEntradas
                SET ContenidoHTML = @contenidoHTML, Editado = 1, FechaEdicion = GETDATE()
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
            await new mssql_1.default.Request(transaction)
                .input('entradaId', mssql_1.default.Int, entradaId)
                .query('DELETE FROM Virtual.ForoEntradaAdjuntos WHERE EntradaID = @entradaId');
        }
        else if (adjunto) {
            // Si se proporciona un nuevo archivo, hacemos un "UPSERT" (actualizar o insertar).
            await new mssql_1.default.Request(transaction)
                .input('entradaId', mssql_1.default.Int, entradaId)
                .input('nombreArchivo', mssql_1.default.NVarChar(1024), adjunto.originalname)
                .input('imagenData', mssql_1.default.VarBinary(mssql_1.default.MAX), adjunto.buffer)
                .input('imagenMimeType', mssql_1.default.VarChar(100), adjunto.mimetype)
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
    }
    catch (error) {
        await transaction.rollback();
        console.error("Error en transacción de actualizar entrada:", error);
        throw error;
    }
};
exports.actualizarEntrada = actualizarEntrada;
const eliminarEntrada = async (entradaId, usuarioId, perfilUsuario) => {
    const pool = await dbPool_1.poolPromise;
    // Iniciamos una transacción para asegurar que ambas operaciones (update y delete) se completen
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const idPositivo = Math.abs(usuarioId);
        const userLookup = await new mssql_1.default.Request(transaction)
            .input('idPos', mssql_1.default.Int, idPositivo)
            .input('perfil', mssql_1.default.NVarChar(96), perfilUsuario)
            .query(`
                SELECT TOP 1 Código FROM dbo.Usuarios 
                WHERE (Código = @idPos OR Código = (@idPos * -1)) AND Perfil = @perfil
            `);
        const usuarioIdReal = userLookup.recordset.length > 0 ? userLookup.recordset[0].Código : usuarioId;
        const mensajeEliminado = perfilUsuario.includes('Docente')
            ? '[Mensaje eliminado por un moderador]'
            : '[Mensaje eliminado por el autor]';
        const request = new mssql_1.default.Request(transaction); // Usamos la transacción para el request
        request
            .input('entradaId', mssql_1.default.Int, entradaId)
            .input('contenidoHTML', mssql_1.default.NVarChar(mssql_1.default.MAX), `<p><i>${mensajeEliminado}</i></p>`)
            .input('usuarioId', mssql_1.default.SmallInt, usuarioIdReal)
            .input('perfilUsuario', mssql_1.default.NVarChar(96), perfilUsuario);
        let updateQuery;
        // Si el usuario es docente, puede eliminar cualquier entrada.
        if (perfilUsuario.includes('Docente')) {
            updateQuery = `
                UPDATE Virtual.ForoEntradas
                SET ContenidoHTML = @contenidoHTML 
                WHERE EntradaID = @entradaId;
            `;
        }
        else {
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
        await new mssql_1.default.Request(transaction)
            .input('entradaIdForDelete', mssql_1.default.Int, entradaId)
            .query('DELETE FROM Virtual.ForoEntradaAdjuntos WHERE EntradaID = @entradaIdForDelete');
        // Si todo salió bien, confirmamos los cambios en la base de datos
        await transaction.commit();
        return true;
    }
    catch (error) {
        // Si algo falla, deshacemos todos los cambios
        await transaction.rollback();
        console.error("Error en la transacción de eliminar entrada:", error);
        throw error; // Propagamos el error
    }
};
exports.eliminarEntrada = eliminarEntrada;
const getCalificacionesForo = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
            WITH AudienciaPersonalizada AS (
                SELECT DISTINCT ABS(MatriculaNo) AS MatriculaNo
                FROM Virtual.RecursosEstudiantes
                WHERE RecursoID = @recursoId
            ),
            RecursoScope AS (
                SELECT CASE WHEN EXISTS (SELECT 1 FROM AudienciaPersonalizada) THEN 1 ELSE 0 END AS EsPersonalizado
            ),
            ConteoParticipaciones AS (
                SELECT 
                    ABS(UsuarioID) AS UsuarioID,
                    COUNT(EntradaID) as Total
                FROM Virtual.ForoEntradas
                WHERE RecursoID = @recursoId
                  AND (
                    (SELECT EsPersonalizado FROM RecursoScope) = 0
                    OR EXISTS (
                        SELECT 1
                        FROM AudienciaPersonalizada ap
                        WHERE ap.MatriculaNo = ABS(UsuarioID)
                    )
                  )
                GROUP BY ABS(UsuarioID)
            ),
            CalificacionesExistentes AS (
                SELECT 
                    ABS(MatriculaNo) AS MatriculaNo,
                    Calificacion, 
                    ComentarioProfesor
                FROM Virtual.ForoCalificaciones
                WHERE RecursoID = @recursoId
                  AND (
                    (SELECT EsPersonalizado FROM RecursoScope) = 0
                    OR EXISTS (
                        SELECT 1
                        FROM AudienciaPersonalizada ap
                        WHERE ap.MatriculaNo = ABS(MatriculaNo)
                    )
                  )
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
exports.getCalificacionesForo = getCalificacionesForo;
const guardarCalificacion = async (recursoId, matriculaNo, calificacion, comentario) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
        .input('calificacion', mssql_1.default.Decimal(5, 2), calificacion)
        .input('comentario', mssql_1.default.NVarChar(mssql_1.default.MAX), comentario)
        .query(`
            IF EXISTS (
                SELECT 1
                FROM Virtual.RecursosEstudiantes re
                WHERE re.RecursoID = @recursoId
            )
            AND NOT EXISTS (
                SELECT 1
                FROM Virtual.RecursosEstudiantes re
                WHERE re.RecursoID = @recursoId
                  AND ABS(re.MatriculaNo) = @matriculaNo
            )
            BEGIN
                THROW 51000, 'El estudiante no pertenece a la audiencia personalizada de este foro.', 1;
            END;

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
exports.guardarCalificacion = guardarCalificacion;
const findAdjuntoDeEntrada = async (entradaId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('entradaId', mssql_1.default.Int, entradaId)
        .query(`
            SELECT a.ImagenData, a.ImagenMimeType, e.RecursoID
            FROM Virtual.ForoEntradaAdjuntos a
            INNER JOIN Virtual.ForoEntradas e ON e.EntradaID = a.EntradaID
            WHERE a.EntradaID = @entradaId
        `);
    return result.recordset[0];
};
exports.findAdjuntoDeEntrada = findAdjuntoDeEntrada;
const findRecursoIdByEntradaId = async (entradaId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('entradaId', mssql_1.default.Int, entradaId)
        .query('SELECT RecursoID FROM Virtual.ForoEntradas WHERE EntradaID = @entradaId');
    return result.recordset[0]?.RecursoID ?? null;
};
exports.findRecursoIdByEntradaId = findRecursoIdByEntradaId;

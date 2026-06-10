"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArchivoEntregaById = exports.guardarEntregaEstudiante = exports.upsertCalificacion = exports.findEntregasByRecursoId = void 0;
//src/service/tarea.service
const mssql_1 = __importDefault(require("mssql"));
const fs_1 = require("fs");
const dbPool_1 = require("../config/dbPool");
const findEntregasByRecursoId = async (recursoId) => {
    try {
        const pool = await dbPool_1.poolPromise;
        // EJECUTAMOS LAS 3 CONSULTAS EN UN SOLO STRING SEPARADAS POR PUNTO Y COMA
        // NOTA: Usamos una variable local @tareaId en SQL para no repetir subconsultas
        const result = await pool.request()
            .input('recursoId', mssql_1.default.Int, recursoId)
            .query(`
                -- 1. Declarar variable para reusar
                DECLARE @TareaID INT;
                SELECT @TareaID = TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId;

                -- QUERY [0]: Información de la Tarea
                SELECT 
                    TareaID, Titulo, PuntajeMaximo, FechaVencimiento, 
                    InstruccionesHTML, FechaPublicacion 
                FROM Virtual.Tareas 
                WHERE TareaID = @TareaID;

                -- QUERY [1]: Metadatos del Archivo Adjunto (Solo info, sin binario)
                SELECT TOP 1 
                    ArchivoTareaID, NombreOriginal, ArchivoMimeType
                FROM Virtual.ArchivosTarea 
                WHERE TareaID = @TareaID;

                -- QUERY [2]: Entregas de Estudiantes
                SELECT
                    e.MatrículaNo as matriculaNo,
                    LTRIM(RTRIM(CONCAT(e.PrimerApellido, ' ', e.SegundoApellido, ' ', e.PrimerNombre, ' ', e.SegundoNombre))) as nombreCompleto,
                    e.NúmeroDocumento as numeroDocumento,
                    et.FechaEntrega as fechaEntrega,
                    et.Calificacion as calificacion,
                    et.FechaCalificacion as fechaCalificacion,
                    et.ComentariosProfesor as comentariosProfesor,
                    et.ComentariosEstudiante as comentariosEstudiante,
                    (SELECT TOP 1 ar.UrlArchivo FROM Virtual.ArchivosEntrega ar WHERE ar.EntregaID = et.EntregaID) as urlArchivo
                FROM dbo.Asignaturas a
                JOIN Virtual.Tareas t ON t.CodigoAsignatura = a.Código
                JOIN dbo.Estudiantes e ON a.CódigoCurso = e.CódigoCurso
                LEFT JOIN Virtual.EntregasTareas et ON ABS(e.MatrículaNo) = ABS(et.MatriculaNo) AND et.TareaID = t.TareaID
                WHERE t.TareaID = @TareaID AND (e.Estado IS NULL OR e.Estado != 'Retirado')
                  AND (
                    NOT EXISTS (SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = t.RecursoID)
                    OR EXISTS (
                        SELECT 1
                        FROM Virtual.RecursosEstudiantes re
                        WHERE re.RecursoID = t.RecursoID
                          AND ABS(re.MatriculaNo) = ABS(e.MatrículaNo)
                    )
                  )
                ORDER BY nombreCompleto;
            `);
        const recordsets = result.recordsets;
        // El driver mssql devuelve 'recordsets' (un array de arrays)
        const tareaInfoRows = recordsets[0];
        const archivoRows = recordsets[1];
        const entregasRows = recordsets[2];
        if (!tareaInfoRows || tareaInfoRows.length === 0) {
            throw new Error('Tarea no encontrada para el RecursoID proporcionado.');
        }
        const tareaInfo = tareaInfoRows[0];
        // --- Procesar Archivo ---
        const archivoRow = archivoRows[0];
        const archivoAdjunto = archivoRow ? {
            id: archivoRow.ArchivoTareaID,
            nombre: archivoRow.NombreOriginal,
            mimeType: archivoRow.ArchivoMimeType
        } : null;
        // --- Procesar Entregas ---
        const entregas = entregasRows.map((row) => {
            let estadoEntrega = 'Sin entregar';
            if (row.fechaEntrega) {
                // Comparación de fechas simple
                const fechaEntrega = new Date(row.fechaEntrega);
                const fechaVencimiento = new Date(tareaInfo.FechaVencimiento);
                estadoEntrega = fechaEntrega > fechaVencimiento ? 'Tardía' : 'A tiempo';
            }
            return {
                matriculaNo: row.matriculaNo,
                nombreCompleto: row.nombreCompleto,
                numeroDocumento: row.numeroDocumento,
                fechaEntrega: row.fechaEntrega ? row.fechaEntrega.toISOString() : null,
                calificacion: row.calificacion,
                fechaCalificacion: row.fechaCalificacion ? row.fechaCalificacion.toISOString() : null,
                comentariosProfesor: row.comentariosProfesor,
                comentariosEstudiante: row.comentariosEstudiante,
                urlArchivo: row.urlArchivo,
                estadoEntrega
            };
        });
        return {
            tareaInfo: {
                id: recursoId,
                titulo: tareaInfo.Titulo,
                instruccionesHTML: tareaInfo.InstruccionesHTML,
                puntajeMaximo: tareaInfo.PuntajeMaximo,
                fechaVencimiento: tareaInfo.FechaVencimiento.toISOString(),
                fechaPublicacion: tareaInfo.FechaPublicacion.toISOString(),
                archivoAdjunto: archivoAdjunto
            },
            entregas,
        };
    }
    catch (error) {
        console.error(`[findEntregasByRecursoId] Error:`, error);
        throw error;
    }
};
exports.findEntregasByRecursoId = findEntregasByRecursoId;
const upsertCalificacion = async (data) => {
    const matriculaNo = Math.abs(data.matriculaNo);
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const request = new mssql_1.default.Request(transaction);
        const tareaResult = await request
            .input('recursoId', mssql_1.default.Int, data.recursoId)
            .query('SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId');
        if (tareaResult.recordset.length === 0) {
            throw new Error(`No se encontró una tarea asociada al recurso ID ${data.recursoId}`);
        }
        const tareaId = tareaResult.recordset[0].TareaID;
        const audienciaResult = await request
            .input('audienciaMatriculaNo', mssql_1.default.Int, matriculaNo)
            .query(`
                SELECT
                    CASE WHEN EXISTS (
                        SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = @recursoId
                    ) THEN 1 ELSE 0 END AS EsPersonalizado,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM Virtual.RecursosEstudiantes re
                        WHERE re.RecursoID = @recursoId
                          AND ABS(re.MatriculaNo) = @audienciaMatriculaNo
                    ) THEN 1 ELSE 0 END AS Permitido;
            `);
        if (audienciaResult.recordset[0]?.EsPersonalizado === 1 && audienciaResult.recordset[0]?.Permitido !== 1) {
            throw new Error('El estudiante no pertenece a la audiencia personalizada de esta tarea.');
        }
        // Primero, verificamos si ya existe una entrega para este estudiante y tarea.
        const existingEntrega = await request
            .input('tareaId', mssql_1.default.Int, tareaId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNo)
            .query('SELECT TOP 1 EntregaID FROM Virtual.EntregasTareas WHERE TareaID = @tareaId AND ABS(MatriculaNo) = @matriculaNo ORDER BY EntregaID DESC');
        if (existingEntrega.recordset.length > 0) {
            const entregaId = existingEntrega.recordset[0].EntregaID;
            await request
                .input('entregaId', mssql_1.default.Int, entregaId)
                .input('calificacion', mssql_1.default.Decimal(5, 2), data.calificacion)
                .input('comentariosProfesor', mssql_1.default.NVarChar(mssql_1.default.MAX), data.comentariosProfesor)
                .query(`
                    UPDATE Virtual.EntregasTareas 
                    SET Calificacion = @calificacion, ComentariosProfesor = @comentariosProfesor, FechaCalificacion = GETUTCDATE()
                    WHERE EntregaID = @entregaId;
                `);
        }
        else {
            // --- Si NO existe, la INSERTAMOS ---
            await request
                // Los inputs 'tareaId' y 'matriculaNo' ya están definidos
                .input('calificacion', mssql_1.default.Decimal(5, 2), data.calificacion)
                .input('comentariosProfesor', mssql_1.default.NVarChar(mssql_1.default.MAX), data.comentariosProfesor)
                .query(`
                    INSERT INTO Virtual.EntregasTareas 
                        (TareaID, MatriculaNo, Calificacion, ComentariosProfesor, FechaCalificacion)
                    VALUES 
                        (@tareaId, @matriculaNo, @calificacion, @comentariosProfesor, GETUTCDATE());
                `);
        }
        await transaction.commit();
    }
    catch (error) {
        await transaction.rollback();
        console.error('Error en transacción de upsertCalificacion:', error);
        throw new Error('Error de base de datos al guardar la calificación.');
    }
};
exports.upsertCalificacion = upsertCalificacion;
const guardarEntregaEstudiante = async (data) => {
    const matriculaNo = Math.abs(data.matriculaNo);
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        // 1. Obtener TareaID
        const tareaRes = await new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, data.recursoId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNo)
            .query(`
                SELECT TareaID, PermiteEntregasTardias, FechaVencimiento
                FROM Virtual.Tareas
                WHERE RecursoID = @recursoId
                  AND (
                    NOT EXISTS (SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = @recursoId)
                    OR EXISTS (
                        SELECT 1
                        FROM Virtual.RecursosEstudiantes re
                        WHERE re.RecursoID = @recursoId
                          AND ABS(re.MatriculaNo) = @matriculaNo
                    )
                  )
            `);
        if (!tareaRes.recordset.length)
            throw new Error('Tarea no encontrada o no disponible para este estudiante');
        const tareaInfo = tareaRes.recordset[0];
        const tareaId = tareaInfo.TareaID;
        // Validación de fecha
        const ahora = new Date();
        if (ahora > tareaInfo.FechaVencimiento && !tareaInfo.PermiteEntregasTardias) {
            throw new Error('La tarea ha vencido y no se permiten entregas tardías.');
        }
        // 2. Upsert Entrega
        const check = await new mssql_1.default.Request(tx)
            .input('tareaId', mssql_1.default.Int, tareaId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNo)
            .query('SELECT TOP 1 EntregaID FROM Virtual.EntregasTareas WHERE TareaID = @tareaId AND ABS(MatriculaNo) = @matriculaNo ORDER BY EntregaID DESC');
        let entregaId = 0;
        const comentariosEstudiante = data.contenidoHTML || null;
        if (check.recordset.length > 0) {
            // UPDATE: Eliminamos 'EstadoEntrega' de aquí
            entregaId = check.recordset[0].EntregaID;
            await new mssql_1.default.Request(tx)
                .input('id', mssql_1.default.Int, entregaId)
                .input('fecha', mssql_1.default.DateTime, new Date())
                .input('comentario', mssql_1.default.NVarChar(mssql_1.default.MAX), comentariosEstudiante)
                .query(`
                    UPDATE Virtual.EntregasTareas 
                    SET FechaEntrega = @fecha, ComentariosEstudiante = @comentario
                    WHERE EntregaID = @id
                `);
        }
        else {
            // INSERT: Eliminamos 'EstadoEntrega' de aquí también
            const ins = await new mssql_1.default.Request(tx)
                .input('tareaId', mssql_1.default.Int, tareaId)
                .input('matriculaNo', mssql_1.default.Int, matriculaNo)
                .input('fecha', mssql_1.default.DateTime, new Date())
                .input('comentario', mssql_1.default.NVarChar(mssql_1.default.MAX), comentariosEstudiante)
                .query(`
                    INSERT INTO Virtual.EntregasTareas (TareaID, MatriculaNo, FechaEntrega, ComentariosEstudiante)
                    OUTPUT INSERTED.EntregaID
                    VALUES (@tareaId, @matriculaNo, @fecha, @comentario);
                `);
            entregaId = ins.recordset[0].EntregaID;
        }
        // 3. Guardar Archivo (Igual que antes)
        if (data.archivo) {
            const archivoBuffer = data.archivo.buffer?.length
                ? data.archivo.buffer
                : data.archivo.path
                    ? await fs_1.promises.readFile(data.archivo.path)
                    : null;
            if (!archivoBuffer) {
                throw new Error('No se pudo leer el archivo adjunto.');
            }
            await new mssql_1.default.Request(tx).input('entregaId', mssql_1.default.Int, entregaId).query('DELETE FROM Virtual.ArchivosEntrega WHERE EntregaID = @entregaId');
            await new mssql_1.default.Request(tx)
                .input('entregaId', mssql_1.default.Int, entregaId)
                .input('nombre', mssql_1.default.NVarChar(255), data.archivo.originalname)
                .input('url', mssql_1.default.NVarChar(500), `/tareas/entregas/${entregaId}/archivo`)
                .input('tamanoKB', mssql_1.default.Int, Math.ceil(data.archivo.size / 1024))
                .input('data', mssql_1.default.VarBinary(mssql_1.default.MAX), archivoBuffer)
                .input('mime', mssql_1.default.VarChar(100), data.archivo.mimetype)
                .query(`
                    INSERT INTO Virtual.ArchivosEntrega 
                        (EntregaID, NombreArchivo, UrlArchivo, TamanoArchivoKB, FechaSubida, ArchivoData, ArchivoMimeType)
                    VALUES 
                        (@entregaId, @nombre, @url, @tamanoKB, GETDATE(), @data, @mime);
                `);
            if (data.archivo.path) {
                await fs_1.promises.unlink(data.archivo.path).catch(() => { });
            }
        }
        await tx.commit();
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.guardarEntregaEstudiante = guardarEntregaEstudiante;
const getArchivoEntregaById = async (entregaId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('entregaId', mssql_1.default.Int, entregaId)
        .query(`
            SELECT TOP 1 
                NombreArchivo, 
                ArchivoMimeType, 
                ArchivoData 
            FROM Virtual.ArchivosEntrega 
            WHERE EntregaID = @entregaId
        `);
    return result.recordset[0] || null;
};
exports.getArchivoEntregaById = getArchivoEntregaById;

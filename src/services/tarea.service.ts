//src/service/tarea.service
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';


export interface EntregaEstudiante {
  matriculaNo: number;
  nombreCompleto: string;
  numeroDocumento: string;
  estadoEntrega: 'A tiempo' | 'Tardía' | 'Sin entregar';
  fechaEntrega: string | null;
  urlArchivo: string | null;
  calificacion: number | null;
  comentariosProfesor: string | null;
  comentariosEstudiante: string | null;
}


export interface DatosCalificacion {
  tareaInfo: {
    id: number;
    instruccionesHTML: string;
    titulo: string;
    puntajeMaximo: number;
    fechaVencimiento: string;
    fechaPublicacion: string;
    archivoAdjunto?: {        
        id: number;
        nombre: string;
        mimeType: string;
    } | null;
  };
  entregas: EntregaEstudiante[];
}

interface UpsertPayload  {
    recursoId: number;
    matriculaNo: number;
    calificacion: number | null;
    comentariosProfesor: string | null;
}

export const findEntregasByRecursoId = async (recursoId: number): Promise<DatosCalificacion> => {
    try {
        const pool = await poolPromise;

        // EJECUTAMOS LAS 3 CONSULTAS EN UN SOLO STRING SEPARADAS POR PUNTO Y COMA
        // NOTA: Usamos una variable local @tareaId en SQL para no repetir subconsultas
        const result = await pool.request()
            .input('recursoId', sql.Int, recursoId)
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
                LEFT JOIN Virtual.EntregasTareas et ON e.MatrículaNo = et.MatriculaNo AND et.TareaID = t.TareaID
                WHERE t.TareaID = @TareaID AND (e.Estado IS NULL OR e.Estado != 'Retirado')
                ORDER BY nombreCompleto;
            `);

            const recordsets = result.recordsets as sql.IRecordSet<any>[];

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
        const entregas: EntregaEstudiante[] = entregasRows.map((row: any) => {
            let estadoEntrega: EntregaEstudiante['estadoEntrega'] = 'Sin entregar';
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
                fechaEntrega: row.fechaEntrega,
                calificacion: row.calificacion,
                fechaCalificacion: row.fechaCalificacion,
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
                fechaVencimiento: tareaInfo.FechaVencimiento,
                fechaPublicacion: tareaInfo.FechaPublicacion,
                archivoAdjunto: archivoAdjunto
            },
            entregas,
        };

    } catch (error) {
        console.error(`[findEntregasByRecursoId] Error:`, error);
        throw error;
    }
};

export const upsertCalificacion = async (data: UpsertPayload) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        const tareaResult = await request
            .input('recursoId', sql.Int, data.recursoId)
            .query('SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId');

        if (tareaResult.recordset.length === 0) {
            throw new Error(`No se encontró una tarea asociada al recurso ID ${data.recursoId}`);
        }
        const tareaId = tareaResult.recordset[0].TareaID;

        // Primero, verificamos si ya existe una entrega para este estudiante y tarea.
        const existingEntrega = await request
            .input('tareaId', sql.Int, tareaId)
            .input('matriculaNo', sql.Int, data.matriculaNo)
            .query('SELECT EntregaID FROM Virtual.EntregasTareas WHERE TareaID = @tareaId AND MatriculaNo = @matriculaNo');
        
        if (existingEntrega.recordset.length > 0) {
            const entregaId = existingEntrega.recordset[0].EntregaID;
            await request
                .input('entregaId', sql.Int, entregaId)
                .input('calificacion', sql.Decimal(5, 2), data.calificacion)
                .input('comentariosProfesor', sql.NVarChar(sql.MAX), data.comentariosProfesor)
                .query(`
                    UPDATE Virtual.EntregasTareas 
                    SET Calificacion = @calificacion, ComentariosProfesor = @comentariosProfesor, FechaCalificacion = GETUTCDATE()
                    WHERE EntregaID = @entregaId;
                `);
        } else {
            // --- Si NO existe, la INSERTAMOS ---
            await request
                // Los inputs 'tareaId' y 'matriculaNo' ya están definidos
                .input('calificacion', sql.Decimal(5, 2), data.calificacion)
                .input('comentariosProfesor', sql.NVarChar(sql.MAX), data.comentariosProfesor)
                .query(`
                    INSERT INTO Virtual.EntregasTareas 
                        (TareaID, MatriculaNo, Calificacion, ComentariosProfesor, FechaCalificacion)
                    VALUES 
                        (@tareaId, @matriculaNo, @calificacion, @comentariosProfesor, GETUTCDATE());
                `);
        }

        await transaction.commit();

    } catch (error) {
        await transaction.rollback();
        console.error('Error en transacción de upsertCalificacion:', error);
        throw new Error('Error de base de datos al guardar la calificación.');
    }
};

export const guardarEntregaEstudiante = async (data: { recursoId: number, matriculaNo: number, contenidoHTML: string, archivo?: Express.Multer.File }) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    
    try {
        await tx.begin();

        // 1. Obtener TareaID
        const tareaRes = await new sql.Request(tx)
            .input('recursoId', sql.Int, data.recursoId)
            .query('SELECT TareaID, PermiteEntregasTardias, FechaVencimiento FROM Virtual.Tareas WHERE RecursoID = @recursoId');
        
        if (!tareaRes.recordset.length) throw new Error('Tarea no encontrada');
        const tareaInfo = tareaRes.recordset[0];
        const tareaId = tareaInfo.TareaID;

        // Validación de fecha
        const ahora = new Date();
        if (ahora > tareaInfo.FechaVencimiento && !tareaInfo.PermiteEntregasTardias) {
            throw new Error('La tarea ha vencido y no se permiten entregas tardías.');
        }

        // 2. Upsert Entrega
        const check = await new sql.Request(tx)
            .input('tareaId', sql.Int, tareaId)
            .input('matriculaNo', sql.Int, data.matriculaNo)
            .query('SELECT EntregaID FROM Virtual.EntregasTareas WHERE TareaID = @tareaId AND MatriculaNo = @matriculaNo');

        let entregaId = 0;

        const comentariosEstudiante = data.contenidoHTML || null;

        if (check.recordset.length > 0) {
            // UPDATE: Eliminamos 'EstadoEntrega' de aquí
            entregaId = check.recordset[0].EntregaID;
            await new sql.Request(tx)
                .input('id', sql.Int, entregaId)
                .input('fecha', sql.DateTime, new Date())
                .input('comentario', sql.NVarChar(sql.MAX), comentariosEstudiante)
                .query(`
                    UPDATE Virtual.EntregasTareas 
                    SET FechaEntrega = @fecha, ComentariosEstudiante = @comentario
                    WHERE EntregaID = @id
                `);
        } else {
            // INSERT: Eliminamos 'EstadoEntrega' de aquí también
            const ins = await new sql.Request(tx)
                .input('tareaId', sql.Int, tareaId)
                .input('matriculaNo', sql.Int, data.matriculaNo)
                .input('fecha', sql.DateTime, new Date())
                .input('comentario', sql.NVarChar(sql.MAX), comentariosEstudiante)
                .query(`
                    INSERT INTO Virtual.EntregasTareas (TareaID, MatriculaNo, FechaEntrega, ComentariosEstudiante)
                    OUTPUT INSERTED.EntregaID
                    VALUES (@tareaId, @matriculaNo, @fecha, @comentario);
                `);
            entregaId = ins.recordset[0].EntregaID;
        }

        // 3. Guardar Archivo (Igual que antes)
        if (data.archivo) {
            await new sql.Request(tx).input('entregaId', sql.Int, entregaId).query('DELETE FROM Virtual.ArchivosEntrega WHERE EntregaID = @entregaId');

            await new sql.Request(tx)
                .input('entregaId', sql.Int, entregaId)
                .input('nombre', sql.NVarChar(255), data.archivo.originalname)
                .input('url', sql.NVarChar(500), `/tareas/entregas/${entregaId}/archivo`)
                .input('tamanoKB', sql.Int, Math.ceil(data.archivo.size / 1024))
                .input('data', sql.VarBinary(sql.MAX), data.archivo.buffer)
                .input('mime', sql.VarChar(100), data.archivo.mimetype)
                
                .query(`
                    INSERT INTO Virtual.ArchivosEntrega 
                        (EntregaID, NombreArchivo, UrlArchivo, TamanoArchivoKB, FechaSubida, ArchivoData, ArchivoMimeType)
                    VALUES 
                        (@entregaId, @nombre, @url, @tamanoKB, GETDATE(), @data, @mime);
                `);
        }

        await tx.commit();
    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const getArchivoEntregaById = async (entregaId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('entregaId', sql.Int, entregaId)
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
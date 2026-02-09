//src/service/recurso.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { registrarAccion } from './log.service';
import * as notificacionService from './notificacion.service';

interface SqlError extends Error {
    number: number;
    // otras propiedades que sql-client pueda tener
}

interface RecursoUrlPayload {
    apartadoId: number;
    titulo: string;
    contenido: string; // HTML del Rich Text Editor
    urlExterna: string;
    fechaPublicacion: Date;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}



interface RecursoAnuncioPayload {
    apartadoId: number;
    titulo: string;
    contenido: string; // HTML del Rich Text Editor
    fechaPublicacion: Date;
    fechaCierre?: Date | null;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    permiteRespuestas: boolean;
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

interface RecursoUpdatePayload {
    titulo: string;
    contenido: string;
    urlExterna?: string;
    esPersonalizado: boolean;
    estudiantesIds: number[];

    fechaInicio?: Date;
    fechaCierre?: Date; // O fechaVencimiento
    puntajeMaximo?: number;
    permiteEntregasTardias?: boolean;
    tiposArchivoPermitidos?: string;
    duracionMinutos?: number;
    numeroIntentos?: number;
    contrasena?: string;
    modoRevision?: string;
    esCalificable?: boolean;
    permitirPublicacionTardia?: boolean;
    modoForo?: string;
    permiteRespuestas?: boolean;
    videoconferencia?: {
        modo: 'jitsi' | 'externo';
        url?: string;
    };
}

export interface UserActor {
    codigo: number;
    perfil: string;
}

interface RecursoTareaPayload {
    apartadoId: number;
    codigoAsignatura: number;
    titulo: string;
    instruccionesHTML: string;
    puntajeMaximo: number;
    fechaPublicacion: Date;
    fechaInicio: Date;
    fechaVencimiento: Date;
    permiteEntregasTardias: boolean;
    esCalificada: boolean;
    tiposArchivoPermitidos: string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    archivos: ArchivoAdjuntoPayload[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

interface ArchivoAdjuntoPayload {
    nombreOriginal: string;
    mimetype: string;
    buffer: string; 
    tamano: number;
}

interface RecursoArchivoPayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    archivo: ArchivoAdjuntoPayload;
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

interface RecursoForoPayload {
    apartadoId: number;
    titulo: string;
    contenido: string; // Instrucciones del foro
    fechaPublicacion: Date;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    fechaInicio: string;
    fechaCierre: Date;
    esCalificable: boolean;
    puntajeMaximo?: number;
    modoForo: 'Normal' | 'PreguntaRespuesta';
    permitirPublicacionTardia: boolean;
    archivo?: ArchivoAdjuntoPayload;
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

interface PruebaResourcePayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    tipoPrueba: 'Examen' | 'Taller';
    tipoExamen: 'Diagnostico' | 'Cognitivo';
    duracionMinutos: number;
    contrasena?: string;
    modoRevision: 'NoPermitir' | 'VerSoloRespuestas' | 'VerSoloNotas' | 'VerAmbas';
    numeroIntentos: number;
    fechaInicio: Date | string;
    fechaCierre: Date | string;
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface VideoconfPayload {
  titulo: string;
  contenido: string; 
  apartadoId: number;
  fechaPublicacion: Date;
  fechaCierre?: Date | null;
  esPersonalizado: boolean;
  estudiantesIds: number[];
  modo: 'jitsi' | 'externo';
  urlExterna?: string | null;
  whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface VideoResourcePayload {
  titulo: string;
  urlVideo: string;
  contenido: string;
  apartadoId: number;
  fechaPublicacion: Date;
  esPersonalizado: boolean;
  estudiantesIds: number[];
  whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

interface RecursoCarpetaPayload {
  apartadoId: number;
  titulo: string;
  contenido: string;      // HTML del RTE
  fechaPublicacion: Date;
  esPersonalizado: boolean;
  estudiantesIds: number[];
  whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface ArchivoCarpetaRow {
  ArchivoCarpetaID: number;
  RecursoID: number;
  NombreOriginal: string;
  ArchivoMimeType: string;
  TamanoKB: number;
  FechaSubida: Date;
}

export interface SubCarpeta {
  SubCarpetaID: number;
  RecursoID: number;
  Nombre: string;
  CarpetaPadreID: number | null; // null indica que está en la raíz de la carpeta
  FechaCreacion: string;
}

export interface ArchivoCarpeta {
  ArchivoCarpetaID: number;
  RecursoID: number;
  SubCarpetaID: number | null;
  NombreOriginal: string;
  ArchivoMimeType: string;
  TamanoKB: number;
  FechaSubida: string;
}

export interface ContenidoCarpetaResponse {
  carpetas: SubCarpeta[];
  archivos: ArchivoCarpeta[];
}


type CreateImagenBinaryData = {
  apartadoId: number;
  titulo: string;
  contenido: string; // descripción
  fechaPublicacion: Date;
  fileName: string;
  mimeType: string;
  filePath: string;
  esPersonalizado?: boolean;
  estudiantesIds?: number[];
};

interface CreateImagenBinaryPayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date;
    fileName: string;
    mimeType: string;
    buffer: Buffer; // El dato crudo
    esPersonalizado?: boolean;
    estudiantesIds?: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

interface ArchivoTareaMetadata {
    id: number;
    nombre: string;
    mimeType: string;
}

function slugify(s: string) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export const createRecursoImagen = async (
    data: CreateImagenBinaryPayload,
    actor?: UserActor
) => {


    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        // 1. Obtener orden
        const maxOrd = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;

        // 2. Insertar Metadata en Virtual.Recursos
        // Nota: UrlExterna queda vacía o NULL porque está en BD
        const insRec = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Imagen')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, nextOrder)
            .input('fecha', sql.DateTime, data.fechaPublicacion)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, UrlExterna)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fecha, 1, NULL);
            `);

        const newRecursoId = Number(insRec.recordset[0].RecursoID);
        const byteLen = data.buffer.length;

        // 3. Insertar BINARIO en Virtual.RecursosImagenes (TABLA OPTIMIZADA)
        await new sql.Request(tx)
            .input('recursoId', sql.Int, newRecursoId)
            .input('fileName', sql.NVarChar(512), data.fileName)
            .input('mimeType', sql.NVarChar(128), data.mimeType)
            .input('byteLength', sql.BigInt, byteLen)
            .input('data', sql.VarBinary(sql.MAX), data.buffer) // Buffer directo a VARBINARY(MAX)
            .query(`
                INSERT INTO Virtual.RecursosImagenes (RecursoID, FileName, MimeType, ByteLength, Data, CreatedAt)
                VALUES (@recursoId, @fileName, @mimeType, @byteLength, @data, GETDATE());
            `);


        // 4. Personalización
        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new sql.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', sql.Int);
            t.columns.add('MatriculaNo', sql.Int);
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new sql.Request(tx).bulk(t);
        }

        await tx.commit();

        if (actor) {

            await registrarAccion(
                actor.codigo,
                actor.perfil,
                'Aula Virtual',
                'Gestión de Recursos',
                `Subió imagen a BD: "${data.titulo}" (${Math.round(byteLen/1024)} KB)`
            );

            const target = data.whatsappTarget || 'NONE';

            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'IMAGEN',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }

            
        }

        return { newRecursoId };
    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const createRecursoImagenExterna = async (
    data: { apartadoId: number; titulo: string; contenido: string; url: string; fechaPublicacion: Date; esPersonalizado: boolean; estudiantesIds: number[]; whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH'; }, 
    actor?: UserActor
) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const maxOrd = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;

        const insRec = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipo', sql.NVarChar(200), 'Imagen')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, nextOrder)
            .input('fecha', sql.DateTime, data.fechaPublicacion)
            .input('url', sql.NVarChar(sql.MAX), data.url)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, UrlExterna)
                OUTPUT INSERTED.RecursoID  -- <--- ESTO FALTABA
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, 1, @url);
            `);

        // Ahora sí existe recordset[0] porque agregamos el OUTPUT
        const newRecursoId = Number(insRec.recordset[0].RecursoID);   
            
        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new sql.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', sql.Int);
            t.columns.add('MatriculaNo', sql.Int);
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new sql.Request(tx).bulk(t);
        }

        await tx.commit();
        if (actor){

         await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Vinculó imagen externa: "${data.titulo}"`);
         const target = data.whatsappTarget || 'NONE';

            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'IMAGEN',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }

        
        return { newRecursoId }; // Es buena práctica retornar el objeto
    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const createRecursoUrl = async (data: RecursoUrlPayload, actor?: UserActor) => {
     const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(transaction);
        const result = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar, 'URL')
            .input('titulo', sql.NVarChar, data.titulo)
            .input('contenido', sql.NVarChar, data.contenido)
            .input('urlExterna', sql.NVarChar(sql.MAX), data.urlExterna)
            .input('orden', sql.Int, newOrder)
            .input('fechaPublicacion', sql.DateTime, data.fechaPublicacion)
            .query(`
                INSERT INTO Virtual.Recursos 
                    (ApartadoID, TipoRecurso, Titulo, Contenido, UrlExterna, Orden, FechaCreacion)
                OUTPUT INSERTED.RecursoID
                VALUES 
                    (@apartadoId, @tipoRecurso, @titulo, @contenido, @urlExterna, @orden, @fechaPublicacion);
            `);
        
        const newRecursoId = result.recordset[0].RecursoID;

    
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int);
            studentTable.columns.add('MatriculaNo', sql.Int);

            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            // Hacemos una inserción masiva (bulk insert) por rendimiento
            await new sql.Request(transaction).bulk(studentTable);
        }

        await transaction.commit();
        if (actor) {
            const operacion = `Creó un nuevo recurso URL titulado: "${data.titulo}"`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);

            const target = data.whatsappTarget || 'NONE';
            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, 
                    'URL',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }
    } catch (err) {
        await transaction.rollback();
        throw err; // Propagamos el error para que el controller lo maneje
    }
};

export const createRecursoAnuncio = async (data: RecursoAnuncioPayload, actor?: UserActor) => {
    console.log('[DEBUG BACK 6] Data en Servicio:', data);
    console.log('[DEBUG BACK 6] Target en data:', data.whatsappTarget);
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        
        // --- Petición 1: Obtener el orden máximo ---
        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        // --- Petición 2: Insertar el recurso principal ---
        const resourceRequest = new sql.Request(transaction);
        const result = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Anuncio')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaPublicacion', sql.DateTime, data.fechaPublicacion)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaPublicacion, 1);
            `);
        
        const newRecursoId = result.recordset[0].RecursoID;

        const anuncioRequest = new sql.Request(transaction);
        await anuncioRequest
            .input('recursoId', sql.Int, newRecursoId)
            .input('fechaCierre', sql.DateTime, data.fechaCierre || null)
            .input('permiteRespuestas', sql.Bit, data.permiteRespuestas === undefined ? true : data.permiteRespuestas)
            .query(`
                INSERT INTO Virtual.Anuncios (RecursoID, FechaCierre, PermiteRespuestas)
                VALUES (@recursoId, @fechaCierre, @permiteRespuestas); 
            `);

        // --- Petición 3 (Condicional): Inserción masiva de estudiantes ---
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            // Definimos las columnas explícitamente para máxima compatibilidad
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });

            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            
            // Usamos un request limpio solo para la operación masiva
            const bulkRequest = new sql.Request(transaction);
            await bulkRequest.bulk(studentTable);
        }

        await transaction.commit();
        
        if (actor) {
            const operacion = `Creó un nuevo Anuncio titulado: "${data.titulo}" (ID: ${newRecursoId})`;
            registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);

            const target = data.whatsappTarget || 'NONE';
            console.log('[DEBUG BACK 7] Target final calculado:', target);
            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'ANUNCIO',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }
    } catch (err) {
        // Si cualquier cosa falla, revertimos todos los cambios
        await transaction.rollback();
        console.error("Error en transacción de crear anuncio:", err);
        throw err; // Propagamos el error para que el controlador lo maneje
    }
};

export const findRecursoById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(`
            SELECT 
                -- =============================================
                -- 1. DATOS GENERALES (Virtual.Recursos)
                -- =============================================
                r.RecursoID as id,
                r.Titulo as titulo,
                r.Contenido as contenido,
                r.TipoRecurso as tipoRecurso,
                r.UrlExterna as urlExterna,
                r.FechaCreacion as fechaCreacion,
                r.Visible,
                r.Orden,
                
                -- =============================================
                -- 2. CONTEXTO ACADÉMICO (Jerarquía Completa)
                -- =============================================
                a.Nombre as apartadoNombre,
                s.Nombre as semanaNombre,
                
                -- Recuperamos Asignatura, Curso y Grado
                asig.Descripción AS nombreAsignatura,
                cur.Curso AS nombreCurso, 
                g.Descripción AS nombreGrado,

                -- =============================================
                -- 3. FLAGS DE ADJUNTOS
                -- =============================================
                CASE WHEN r.ArchivoData IS NOT NULL THEN 1 ELSE 0 END AS tieneArchivoGeneral,
                CASE WHEN f.AdjuntoData IS NOT NULL THEN 1 ELSE 0 END AS tieneAdjuntoForo,

                -- =============================================
                -- 4. DATOS ESPECÍFICOS POR TIPO
                -- =============================================

                -- ANUNCIOS
                an.PermiteRespuestas as permiteRespuestas,

                -- TAREAS
                t.PuntajeMaximo as puntajeMaximoTarea,
                t.PermiteEntregasTardias as permiteEntregasTardias,
                t.EsCalificada as esCalificadaTarea,
                t.TiposArchivoPermitidos as tiposArchivoPermitidos,
                t.FechaInicio as fechaInicioTarea,
                t.FechaVencimiento as fechaCierreTarea,

                -- FOROS
                f.FechaInicio as fechaInicioForo,
                f.FechaCierre as fechaCierreForo,
                f.EsCalificable as esCalificableForo,
                f.PuntajeMaximo as puntajeMaximoForo,
                f.PermitirPublicacionTardia as permitirPublicacionTardiaForo,
                f.ModoForo as modoForo,

                -- PRUEBAS
                p.FechaInicio as fechaInicioPrueba,
                p.FechaCierre as fechaCierrePrueba,
                p.DuracionMinutos as duracionMinutos,
                p.NumeroIntentos as numeroIntentos,
                p.Contrasena as contrasena,
                p.ModoRevision as modoRevision,
                p.TipoPrueba as tipoPrueba,
                p.TipoExamen as tipoExamen,
                COALESCE(p.Publicado, 0) as publicado,

                -- VIDEOCONFERENCIAS
                v.FechaInicio as fechaInicioVideo,
                v.FechaCierre as fechaCierreVideo,
                v.Proveedor as proveedorVideo,
                v.UrlSala as urlSala,

                -- =============================================
                -- 5. COLUMNAS UNIFICADAS (Para facilitar al Frontend)
                -- =============================================
                
                -- Fecha Inicio Unificada (Prioridad según tipo)
                COALESCE(t.FechaInicio, f.FechaInicio, p.FechaInicio, v.FechaInicio) as fechaInicio,
                
                -- Fecha Cierre Unificada
                COALESCE(t.FechaVencimiento, f.FechaCierre, p.FechaCierre, v.FechaCierre, an.FechaCierre) as fechaCierre,

                -- Puntaje Unificado
                COALESCE(t.PuntajeMaximo, f.PuntajeMaximo) as puntajeMaximo

            FROM Virtual.Recursos as r
            
            -- Joins Estructurales (Semana/Apartado)
            LEFT JOIN Virtual.Apartados as a ON r.ApartadoID = a.ApartadoID
            LEFT JOIN Virtual.Semanas as s ON a.SemanaID = s.SemanaID
            
            -- Joins Académicos (RESTAURADOS)
            LEFT JOIN dbo.Asignaturas as asig ON s.CodigoAsignatura = asig.Código
            LEFT JOIN dbo.Cursos as cur ON asig.CódigoCurso = cur.Código 
            LEFT JOIN dbo.Grados as g ON cur.CódigoGrado = g.Código
            
            -- Joins Específicos de Recurso
            LEFT JOIN Virtual.Anuncios as an ON r.RecursoID = an.RecursoID
            LEFT JOIN Virtual.Tareas as t ON r.RecursoID = t.RecursoID
            LEFT JOIN Virtual.Foros as f ON r.RecursoID = f.RecursoID
            LEFT JOIN Virtual.Pruebas as p ON r.RecursoID = p.RecursoID
            LEFT JOIN Virtual.Videoconferencias as v ON r.RecursoID = v.RecursoID

            WHERE r.RecursoID = @recursoId;
        `);
    
    if (result.recordset.length === 0) {
        throw new Error('Recurso no encontrado');
    }
    return result.recordset[0];
};

export const updateRecursoById = async (recursoId: number, data: RecursoUpdatePayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        
        // 1. Obtener el tipo de recurso actual para saber qué tabla hija actualizar
        const typeResult = await new sql.Request(transaction)
            .input('id', sql.Int, recursoId)
            .query('SELECT TipoRecurso FROM Virtual.Recursos WHERE RecursoID = @id');
            
        if (typeResult.recordset.length === 0) throw new Error('Recurso no encontrado');
        const tipoRecurso = typeResult.recordset[0].TipoRecurso;

        // 2. Actualizar la tabla MAESTRA (Virtual.Recursos)
        await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('urlExterna', sql.NVarChar(sql.MAX), data.urlExterna || null)
            .query(`
                UPDATE Virtual.Recursos
                SET Titulo = @titulo, Contenido = @contenido, UrlExterna = @urlExterna
                WHERE RecursoID = @recursoId;
            `);

        // 3. Actualizar la tabla ESPECÍFICA según el tipo
        const reqSpecific = new sql.Request(transaction).input('recursoId', sql.Int, recursoId);

        if (tipoRecurso === 'Tarea') {
            await reqSpecific
                .input('fechaVencimiento', sql.DateTime, data.fechaCierre) // En front mapeamos cierre -> vencimiento
                .input('puntaje', sql.Decimal(5, 2), data.puntajeMaximo)
                .input('tardias', sql.Bit, data.permiteEntregasTardias)
                .input('archivos', sql.NVarChar(1024), data.tiposArchivoPermitidos)
                .query(`
                    UPDATE Virtual.Tareas 
                    SET FechaVencimiento = @fechaVencimiento, 
                        PuntajeMaximo = @puntaje, 
                        PermiteEntregasTardias = @tardias,
                        TiposArchivoPermitidos = @archivos
                    WHERE RecursoID = @recursoId
                `);
        }
        else if (tipoRecurso === 'Anuncio') {
            await reqSpecific
                .input('fechaCierre', sql.DateTime, data.fechaCierre || null)
                .input('permiteRespuestas', sql.Bit, data.permiteRespuestas) // true/false
                .query(`
                    UPDATE Virtual.Anuncios
                    SET FechaCierre = @fechaCierre,
                    PermiteRespuestas = @permiteRespuestas
                    WHERE RecursoID = @recursoId
                `);
} 
        else if (tipoRecurso === 'Prueba') {
            await reqSpecific
                .input('inicio', sql.DateTime, data.fechaInicio)
                .input('cierre', sql.DateTime, data.fechaCierre)
                .input('duracion', sql.SmallInt, data.duracionMinutos)
                .input('intentos', sql.SmallInt, data.numeroIntentos)
                .input('revision', sql.NVarChar(50), data.modoRevision)
                .input('password', sql.NVarChar(50), data.contrasena || null)
                .query(`
                    UPDATE Virtual.Pruebas
                    SET FechaInicio = @inicio,
                        FechaCierre = @cierre,
                        DuracionMinutos = @duracion,
                        NumeroIntentos = @intentos,
                        ModoRevision = @revision,
                        Contrasena = @password
                    WHERE RecursoID = @recursoId
                `);
        }
        else if (tipoRecurso === 'Foro') {
            await reqSpecific
                .input('inicio', sql.DateTime, data.fechaInicio)
                .input('cierre', sql.DateTime, data.fechaCierre)
                .input('calificable', sql.Bit, data.esCalificable)
                .input('puntaje', sql.Decimal(5, 2), data.esCalificable ? data.puntajeMaximo : null)
                .input('tardia', sql.Bit, data.permitirPublicacionTardia)
                .query(`
                    UPDATE Virtual.Foros
                    SET FechaInicio = @inicio,
                        FechaCierre = @cierre,
                        EsCalificable = @calificable,
                        PuntajeMaximo = @puntaje,
                        PermitirPublicacionTardia = @tardia
                    WHERE RecursoID = @recursoId
                `);
        }
        else if (tipoRecurso === 'Videoconferencia') {
            const vidData = data.videoconferencia; 
            
            // 1. Obtener datos actuales de la BD para no perder la URL de Jitsi si no se envía una nueva
            const currentDataReq = await new sql.Request(transaction)
                .input('rid', sql.Int, recursoId)
                .query('SELECT UrlSala, Proveedor FROM Virtual.Videoconferencias WHERE RecursoID = @rid');
            
            const currentUrl = currentDataReq.recordset[0]?.UrlSala || '';
            
            let nuevaUrl = data.urlExterna; // Puede venir del payload general
            let nuevoProveedor = 'Externo';

            if (vidData) {
                if (vidData.modo === 'jitsi') {
                    nuevoProveedor = 'Jitsi';
                    // Si es Jitsi y no me mandan URL explícita, MANTENGO la que ya existía en BD
                    if (!vidData.url || vidData.url.trim() === '') {
                        nuevaUrl = currentUrl;
                        // Si por alguna razón la BD estaba vacía (error previo), generamos una nueva
                        if (!nuevaUrl) {
                             nuevaUrl = `https://meet.jit.si/${slugify(data.titulo)}-${Math.random().toString(36).slice(2,8)}`;
                        }
                    } else {
                        nuevaUrl = vidData.url;
                    }
                } else {
                    // Modo Externo
                    nuevoProveedor = 'Externo';
                    nuevaUrl = vidData.url || '';
                }
            } else {
                // Si no viene info de video (solo se editaron fechas), mantenemos la URL actual
                nuevaUrl = currentUrl;
            }

            // Validación final de seguridad para SQL
            if (!nuevaUrl) nuevaUrl = ''; 

            await reqSpecific
                .input('inicio', sql.DateTime2, data.fechaInicio)
                .input('cierre', sql.DateTime2, data.fechaCierre || null)
                .input('proveedor', sql.NVarChar(50), nuevoProveedor)
                .input('urlSala', sql.NVarChar(500), nuevaUrl) // <--- Ahora garantizamos que no es NULL
                .query(`
                    UPDATE Virtual.Videoconferencias
                    SET FechaInicio = @inicio, 
                        FechaCierre = @cierre,
                        Proveedor = @proveedor,
                        UrlSala = @urlSala
                    WHERE RecursoID = @recursoId
                `);
            
            // IMPORTANTE: Sincronizar también la tabla padre para que el frontend (ResourceItem) detecte la URL
            await new sql.Request(transaction)
                .input('recursoId', sql.Int, recursoId)
                .input('url', sql.NVarChar(sql.MAX), nuevaUrl)
                .query(`UPDATE Virtual.Recursos SET UrlExterna = @url WHERE RecursoID = @recursoId`);
        }

        // 4. Gestión de Estudiantes (Personalización)
        // Borra anteriores
        await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .query('DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');

        // Inserta nuevos
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(recursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }
        
        await transaction.commit();
        if (actor) {
            const operacion = `Actualizó configuración completa del recurso ${recursoId} (${tipoRecurso})`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
        }
    } catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de actualizar recurso:", err);
        throw err;
    }
};

// export const updateRecursoById = async (recursoId: number, data: RecursoUpdatePayload, actor?: UserActor) => {
//     const pool = await poolPromise;
//     const transaction = new sql.Transaction(pool);
//     try {
//         await transaction.begin();
        
//         // 1. Actualiza la tabla principal de Recursos
//         await new sql.Request(transaction)
//             .input('recursoId', sql.Int, recursoId)
//             .input('titulo', sql.NVarChar(1024), data.titulo)
//             .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
//             .input('urlExterna', sql.NVarChar(4096), data.urlExterna)
//             .query(`
//                 UPDATE Virtual.Recursos
//                 SET Titulo = @titulo, Contenido = @contenido, UrlExterna = @urlExterna
//                 WHERE RecursoID = @recursoId;
//             `);

//         // 2. Borra las asignaciones de estudiantes existentes para este recurso
//         await new sql.Request(transaction)
//             .input('recursoId', sql.Int, recursoId)
//             .query('DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');

//         // 3. Si es personalizado, inserta las nuevas asignaciones
//         if (data.esPersonalizado && data.estudiantesIds.length > 0) {
//             const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
//             studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
//             studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
//             for (const studentId of data.estudiantesIds) {
//                 studentTable.rows.add(recursoId, studentId);
//             }
//             await new sql.Request(transaction).bulk(studentTable);
//         }
        
//         await transaction.commit();
//         if (actor) {
//             const operacion = `Se actualizó el recurso ${recursoId}`;
//             await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
//         }
//     } catch (err) {
//         await transaction.rollback();
//         console.error("Error en transacción de actualizar recurso:", err);
//         throw err;
//     }
// };

export const toggleRecursoVisibilityById = async (recursoId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(`
            UPDATE Virtual.Recursos
            SET Visible = CASE WHEN Visible = 1 THEN 0 ELSE 1 END
            OUTPUT INSERTED.Visible
            WHERE RecursoID = @recursoId;
        `);
    
    if (result.recordset.length === 0) {
        throw new Error('Recurso no encontrado para cambiar visibilidad.');
    }
    const { Visible: nuevoEstado, Titulo } = result.recordset[0];
    if (actor) {
        const operacion = `Cambió visibilidad del recurso '${Titulo}' a ${nuevoEstado ? 'Visible' : 'Oculto'}`;
        await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
    }
    
    return { nuevoEstado };
};

export const deleteRecursoById = async (recursoId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        // 1. Obtener información básica para el Log (antes de borrar)
        const resourceInfo = await request
            .input('recursoIdInfo', sql.Int, recursoId)
            .query('SELECT Titulo, TipoRecurso FROM Virtual.Recursos WHERE RecursoID = @recursoIdInfo');
        
        const titulo = resourceInfo.recordset[0]?.Titulo || `ID ${recursoId}`;
        const tipo = resourceInfo.recordset[0]?.TipoRecurso || 'Desconocido';

        // ==============================================================================
        // LIMPIEZA DE DEPENDENCIAS ESPECÍFICAS (Según el Tipo)
        // ==============================================================================
        
        // Configurar el input global para las queries de limpieza
        request.input('recursoId', sql.Int, recursoId);

        // --- A. LIMPIEZA DE CARPETAS (Solución a tu error actual) ---
        // Orden crítico: Archivos/Enlaces -> Desvincular Subcarpetas -> Borrar Subcarpetas
        await request.query(`
            DELETE FROM Virtual.ArchivosCarpeta WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.EnlacesCarpeta WHERE RecursoID = @recursoId;
            
            -- Importante: Romper la auto-referencia (Padre-Hijo) antes de borrar para evitar error FK cíclico
            UPDATE Virtual.SubCarpetas SET CarpetaPadreID = NULL WHERE RecursoID = @recursoId;
            
            DELETE FROM Virtual.SubCarpetas WHERE RecursoID = @recursoId;
        `);

        // --- B. LIMPIEZA DE TAREAS ---
        await request.query(`
            -- Borrar archivos adjuntos a entregas (si la tabla existe y tiene relación indirecta)
            DELETE FROM Virtual.ArchivosEntrega 
            WHERE EntregaID IN (
                SELECT EntregaID FROM Virtual.EntregasTareas 
                WHERE TareaID IN (SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId)
            );

            DELETE FROM Virtual.EntregasTareas 
            WHERE TareaID IN (SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId);

            DELETE FROM Virtual.ArchivosTarea 
            WHERE TareaID IN (SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId);

            DELETE FROM Virtual.Tareas WHERE RecursoID = @recursoId;
        `);

        // --- C. LIMPIEZA DE FOROS ---
        await request.query(`
            -- Borrar adjuntos de entradas
            DELETE FROM Virtual.ForoEntradaAdjuntos
            WHERE EntradaID IN (SELECT EntradaID FROM Virtual.ForoEntradas WHERE RecursoID = @recursoId);

            -- Romper auto-referencia de respuestas en el foro
            UPDATE Virtual.ForoEntradas SET EntradaPadreID = NULL WHERE RecursoID = @recursoId;
            
            DELETE FROM Virtual.ForoEntradas WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.ForoCalificaciones WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.Foros WHERE RecursoID = @recursoId;
        `);

        // --- D. LIMPIEZA DE PRUEBAS ---
        await request.query(`
            DELETE FROM Virtual.PruebasResultados WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId);
            DELETE FROM Virtual.PruebasSimulacros WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId);
            
            -- Borrar respuestas de las preguntas de la prueba
            DELETE FROM Virtual.Pruebas_Respuestas 
            WHERE PreguntaID IN (
                SELECT PreguntaID FROM Virtual.Pruebas_Preguntas 
                WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId)
            );

            DELETE FROM Virtual.Pruebas_Preguntas 
            WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId);

            DELETE FROM Virtual.Pruebas WHERE RecursoID = @recursoId;
        `);

        // --- E. LIMPIEZA DE OTROS TIPOS (Anuncios, Videos, etc.) ---
        await request.query(`
            DELETE FROM Virtual.AnuncioRespuestas WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.Anuncios WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.Videoconferencias WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.RecursosImagenes WHERE RecursoID = @recursoId;
        `);

        // ==============================================================================
        // LIMPIEZA DE DEPENDENCIAS COMUNES (Tablas Transversales)
        // ==============================================================================
        await request.query(`
            DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.VistasRecursos WHERE RecursoID = @recursoId;
            
            -- Para notificaciones, es mejor desvincularlas (SET NULL) para mantener el historial
            -- o borrarlas si prefieres limpieza total. Aquí optamos por desvincular para evitar errores FK.
            UPDATE Virtual.Notificaciones SET RecursoID = NULL WHERE RecursoID = @recursoId;
        `);

        // ==============================================================================
        // 3. ELIMINACIÓN DEL RECURSO PADRE
        // ==============================================================================
        const result = await request.query(`
            DELETE FROM Virtual.Recursos WHERE RecursoID = @recursoId;
        `);

        if (result.rowsAffected[0] === 0) {
            // Si llegamos aquí y no se borró nada, puede que el ID no existiera, 
            // pero no lanzamos error para ser idempotentes, solo logueamos warning.
            console.warn(`[deleteRecursoById] ID ${recursoId} no encontrado o ya eliminado.`);
        }

        await transaction.commit();

        // 4. Registro de Auditoría
        if (actor) {
            const operacion = `Eliminó el recurso '${titulo}' (Tipo: ${tipo}, ID: ${recursoId}) y todo su contenido asociado.`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
        }

    } catch (err: any) {
        await transaction.rollback();
        console.error("Error crítico en transacción de eliminar recurso:", err);
        
        // Mejorar el mensaje de error para el frontend si sigue siendo un conflicto de FK
        if (err.number === 547) {
            throw new Error(`No se pudo eliminar el recurso debido a una dependencia de datos no controlada. Detalle técnico: ${err.message}`);
        }
        throw err;
    }
};

export const cloneRecursoById = async (recursoId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // 1. Obtener los datos del recurso original
        const originalResult = await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .query('SELECT * FROM Virtual.Recursos WHERE RecursoID = @recursoId;');
        
        if (originalResult.recordset.length === 0) throw new Error('Recurso original no encontrado.');
        const original = originalResult.recordset[0];

        // 2. Obtener los estudiantes asociados al recurso original
        const studentsResult = await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .query('SELECT MatriculaNo FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');
        const studentIds = studentsResult.recordset.map(r => r.MatriculaNo);

        // 3. Determinar el nuevo orden para el recurso clonado
        const orderResult = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, original.ApartadoID)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId;');
        const newOrder = (orderResult.recordset[0].maxOrden || 0) + 1;

        // 4. Insertar el nuevo recurso (la copia) y obtener su nuevo ID
        const cloneResult = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, original.ApartadoID)
            .input('tipoRecurso', sql.NVarChar(200), original.TipoRecurso)
            .input('titulo', sql.NVarChar(1024), `${original.Titulo} (Copia)`)
            .input('contenido', sql.NVarChar(sql.MAX), original.Contenido)
            .input('urlExterna', sql.NVarChar(4096), original.UrlExterna)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date())
            .input('visible', sql.Bit, original.Visible) // Clonamos también el estado de visibilidad
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, UrlExterna, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @urlExterna, @orden, @fechaCreacion, @visible);
            `);
        const newRecursoId = cloneResult.recordset[0].RecursoID;

        // 5. Si había estudiantes, asociarlos al nuevo recurso clonado
        if (studentIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of studentIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }

        const originalTitulo = original.Titulo;

        await transaction.commit();
        if (actor) {
            const operacion = `Clonó el recurso '${originalTitulo}' (ID: ${recursoId}). Nuevo recurso creado con ID: ${newRecursoId}`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
        }
        return { newRecursoId };
    } catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de clonar recurso:", err);
        throw err;
    }
};

export const registrarVista = async (recursoId: number, matriculaNo: number) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    
    try {
        await tx.begin();

        // 1. Verificamos si YA existe el registro (Tu lógica actual es correcta)
        const check = await new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('matriculaNo', sql.Int, matriculaNo)
            .query('SELECT 1 FROM Virtual.VistasRecursos WHERE RecursoID = @recursoId AND MatriculaNo = @matriculaNo');

        // Solo si NO existe, procedemos (Esto cumple tu requerimiento de "única vez")
        if (check.recordset.length === 0) {
            
            // A. Insertar en log de vistas (Historial detallado)
            await new sql.Request(tx)
                .input('recursoId', sql.Int, recursoId)
                .input('matriculaNo', sql.Int, matriculaNo)
                .query(`
                    INSERT INTO Virtual.VistasRecursos (RecursoID, MatriculaNo, FechaVista)
                    VALUES (@recursoId, @matriculaNo, GETDATE());
                `);

            // B. Aumentar el contador caché en la tabla padre
            // IMPORTANTE: Esta query es la que fallaba porque faltaba la columna 'vistas' en la BD
            await new sql.Request(tx)
                .input('recursoId', sql.Int, recursoId)
                .query(`
                    UPDATE Virtual.Recursos 
                    SET vistas = ISNULL(vistas, 0) + 1 
                    WHERE RecursoID = @recursoId;
                `);
        }

        await tx.commit();
    } catch (error: any) {
        await tx.rollback();
        
        // Ignoramos el error de llave duplicada (2627) por si hubo una condición de carrera
        // (dos clicks muy rápidos), pero reportamos otros errores.
        if (error.number !== 2627) {
            console.error('[Error Crítico] al registrar vista:', error);
            throw error; 
        }
    }
};

export const createRecursoTarea = async (data: RecursoTareaPayload, archivos: Express.Multer.File[], actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // --- 1. Crear el registro genérico en Virtual.Recursos ---
        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(transaction);
        const recursoResult = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Tarea')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.instruccionesHTML)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, data.fechaPublicacion)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;

        // --- 2. Crear el registro específico en Virtual.Tareas ---
        const tareaRequest = new sql.Request(transaction);
        const tareaResult = await tareaRequest
            .input('codigoAsignatura', sql.SmallInt, data.codigoAsignatura)
            .input('titulo', sql.NVarChar(510), data.titulo)
            .input('instruccionesHTML', sql.NVarChar(sql.MAX), data.instruccionesHTML)
            .input('puntajeMaximo', sql.Decimal(5, 2), data.puntajeMaximo)
            .input('fechaPublicacion', sql.DateTime, data.fechaPublicacion)
            .input('fechaInicio', sql.DateTime, data.fechaInicio)
            .input('fechaVencimiento', sql.DateTime, data.fechaVencimiento)
            .input('permiteEntregasTardias', sql.Bit, data.permiteEntregasTardias)
            .input('recursoId', sql.Int, newRecursoId)
            .input('esCalificada', sql.Bit, data.esCalificada)
            .input('tiposArchivoPermitidos', sql.NVarChar(1024), data.tiposArchivoPermitidos)
            .query(`
                INSERT INTO Virtual.Tareas 
                    (CodigoAsignatura, Titulo, InstruccionesHTML, PuntajeMaximo, FechaPublicacion, FechaInicio, FechaVencimiento, PermiteEntregasTardias, RecursoID, EsCalificada, TiposArchivoPermitidos)
                OUTPUT INSERTED.TareaID
                VALUES 
                    (@codigoAsignatura, @titulo, @instruccionesHTML, @puntajeMaximo, @fechaPublicacion, @fechaInicio, @fechaVencimiento, @permiteEntregasTardias, @recursoId, @esCalificada, @tiposArchivoPermitidos);
            `);

            const newTareaId = tareaResult.recordset[0].TareaID;

            if (archivos && archivos.length > 0) {
            for (const archivo of archivos) {
                await new sql.Request(transaction)
                    .input('tareaId', sql.Int, newTareaId)
                    .input('nombreArchivo', sql.NVarChar(1024), archivo.originalname)
                    .input('nombreOriginal', sql.NVarChar(1024), archivo.originalname)
                    .input('archivoData', sql.VarBinary(sql.MAX), archivo.buffer) // <-- Se usa el buffer
                    .input('archivoMimeType', sql.VarChar(100), archivo.mimetype)
                    .input('tamanoKB', sql.Int, Math.round(archivo.size / 1024))
                    .query(`
                        INSERT INTO Virtual.ArchivosTarea 
                            (TareaID, nombreArchivo, NombreOriginal, ArchivoData, ArchivoMimeType, TamanoKB, FechaSubida)
                        VALUES 
                            (@tareaId, @nombreArchivo, @nombreOriginal, @archivoData, @archivoMimeType, @tamanoKB, GETDATE());
                    `);
            }
        }

        // --- 3. (Opcional) Asignar a estudiantes específicos ---
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }
        
        await transaction.commit();
        
        if (actor) {
            const operacion = `Creó una nueva Tarea titulada: "${data.titulo}" (ID Recurso: ${newRecursoId})`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);

            const target = data.whatsappTarget || 'NONE';

            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'TAREA',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }

    } catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de crear tarea:", err);
        throw err;
    }
};

export const createRecursoArchivo = async (data: RecursoArchivoPayload, archivo: Express.Multer.File, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(transaction);
        const recursoResult = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Archivo')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, data.fechaPublicacion)
            .input('archivoData', sql.VarBinary(sql.MAX), archivo.buffer) // Buffer desde RAM
            .input('archivoMimeType', sql.VarChar(100), archivo.mimetype)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, ArchivoData, ArchivoMimeType)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1, @archivoData, @archivoMimeType);
            `);
        
        const newRecursoId = recursoResult.recordset[0].RecursoID;
        
        // 2. Asignar a estudiantes específicos (si aplica)
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }
        
        await transaction.commit();
        
        if (actor) {
            const operacion = `Creó un nuevo Archivo titulado: "${data.titulo}"`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
            
            const target = data.whatsappTarget || 'NONE';

            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'ARCHIVO',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }
    } catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de crear archivo:", err);
        throw err;
    }
};

export const createRecursoForo = async (data: RecursoForoPayload, archivo: Express.Multer.File | undefined, actor?: UserActor) => {
    console.log('--- PASO 2 (Servicio): Archivo recibido ---', archivo ? `Archivo: ${archivo.originalname}` : 'Archivo es undefined');
    
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // --- 1. Crear el registro genérico en Virtual.Recursos ---
        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(transaction);
        const recursoResult = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Foro')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, data.fechaPublicacion)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;

        // --- 2. Crear el registro específico en Virtual.Foros ---
        await new sql.Request(transaction)
            .input('recursoId', sql.Int, newRecursoId)
            .input('fechaInicio', sql.DateTime, data.fechaInicio)
            .input('fechaCierre', sql.DateTime, data.fechaCierre)
            .input('permitirPublicacionTardia', sql.Bit, data.permitirPublicacionTardia)
            .input('esCalificable', sql.Bit, data.esCalificable)
            .input('puntajeMaximo', sql.Decimal(5, 2), data.esCalificable ? data.puntajeMaximo : null)
            .input('modoForo', sql.VarChar(50), data.modoForo)
            .input('adjuntoData', sql.VarBinary(sql.MAX), archivo ? archivo.buffer : null) // <-- Se usa el buffer
            .input('adjuntoMimeType', sql.VarChar(100), archivo ? archivo.mimetype : null)
            .query(`
                INSERT INTO Virtual.Foros (RecursoID, FechaInicio, FechaCierre, PermitirPublicacionTardia, EsCalificable, PuntajeMaximo, ModoForo, AdjuntoData, AdjuntoMimeType)
                VALUES (@recursoId, @fechaInicio, @fechaCierre, @permitirPublicacionTardia, @esCalificable, @puntajeMaximo, @modoForo, @adjuntoData, @adjuntoMimeType);
            `);


        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int);
            studentTable.columns.add('MatriculaNo', sql.Int);
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }
        
        await transaction.commit();
        
        if (actor) {
            const operacion = `Creó un nuevo Foro titulado: "${data.titulo}"`;
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
            
            const target = data.whatsappTarget || 'NONE';

            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'FORO',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }
    } catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de crear foro:", err);
        throw err;
    }
};

export const findAdjuntoTareaById = async (archivoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('archivoId', sql.Int, archivoId)
        .query('SELECT ArchivoData, ArchivoMimeType FROM Virtual.ArchivosTarea WHERE ArchivoTareaID = @archivoId');
    return result.recordset[0];
};

export const findArchivoMetadataByTareaId = async (recursoId: number): Promise<ArchivoTareaMetadata | null> => {
    const pool = await poolPromise;
    // Hacemos JOIN con Tareas para llegar desde RecursoID
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(`
            SELECT TOP 1 
                at.ArchivoTareaID as id, 
                at.NombreOriginal as nombre,
                at.ArchivoMimeType as mimeType
            FROM Virtual.ArchivosTarea at
            INNER JOIN Virtual.Tareas t ON at.TareaID = t.TareaID
            WHERE t.RecursoID = @recursoId
        `);
    
    return result.recordset[0] || null;
};

export const findAdjuntoForoById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query('SELECT AdjuntoData, AdjuntoMimeType FROM Virtual.Foros WHERE RecursoID = @recursoId');
    return result.recordset[0];
};

export const findRecursoArchivoDataById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query('SELECT ArchivoData, ArchivoMimeType FROM Virtual.Recursos WHERE RecursoID = @recursoId');
    return result.recordset[0];
};

export const createRecursoPrueba = async (data: PruebaResourcePayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // --- Parte A: Insertar en la tabla genérica de Recursos ---
        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(transaction);
        const recursoResult = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Prueba')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            // Usamos la fecha de publicación que viene del front, o la actual
            .input('fechaCreacion', sql.DateTime, data.fechaPublicacion || new Date())
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;

        // --- Parte B: Insertar en la tabla específica de Pruebas (CORREGIDO) ---
        const pruebaRequest = new sql.Request(transaction);
        
        // Validación de seguridad básica para fechas
        const fechaInicio = data.fechaInicio ? new Date(data.fechaInicio) : new Date();
        
        let fechaCierre: Date;
        if (data.fechaCierre) {
            fechaCierre = new Date(data.fechaCierre);
            // Validación extra: Si Cierre es menor o igual a Inicio (error de usuario), forzamos +7 días o +1 hora
            if (fechaCierre.getTime() <= fechaInicio.getTime()) {
                console.warn('Fecha cierre era menor/igual a inicio. Ajustando automáticamente.');
                fechaCierre = new Date(fechaInicio.getTime() + 60 * 60 * 1000); // Mínimo 1 hora después
            }
        } else {
            // Default 7 días
            fechaCierre = new Date(fechaInicio.getTime() + 7 * 24 * 60 * 60 * 1000); 
        } 

        const pruebaResult = await pruebaRequest
            .input('recursoId', sql.Int, newRecursoId)
            .input('tipoPrueba', sql.NVarChar(50), data.tipoPrueba)
            .input('tipoExamen', sql.NVarChar(50), data.tipoExamen)
            .input('duracionMinutos', sql.SmallInt, data.duracionMinutos)
            .input('contrasena', sql.NVarChar(50), data.contrasena || null)
            .input('modoRevision', sql.NVarChar(50), data.modoRevision)
            .input('numeroIntentos', sql.SmallInt, data.numeroIntentos)
            .input('fechaInicio', sql.DateTime, fechaInicio)
            .input('fechaCierre', sql.DateTime, fechaCierre)
            .query(`
                INSERT INTO Virtual.Pruebas 
                (RecursoID, TipoPrueba, TipoExamen, DuracionMinutos, Contrasena, ModoRevision, NumeroIntentos, FechaInicio, FechaCierre, Publicado)
                OUTPUT INSERTED.PruebaID
                VALUES 
                (@recursoId, @tipoPrueba, @tipoExamen, @duracionMinutos, @contrasena, @modoRevision, @numeroIntentos, @fechaInicio, @fechaCierre, 0);
            `);
            // Nota: Puse 'Publicado' en 0 por defecto al crear, para que el profe la configure antes de lanzar.
            
        const newPruebaId = pruebaResult.recordset[0].PruebaID;
        
        // --- Parte C: Asignar a estudiantes específicos ---
        if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int);
            studentTable.columns.add('MatriculaNo', sql.Int);
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }

        await transaction.commit();
        
        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Pruebas', `Creó una nueva prueba titulada: "${data.titulo}"`);

            const target = data.whatsappTarget || 'NONE';
            try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'PRUEBA',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
        }

        return { newPruebaId, newRecursoId };

    } catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de crear prueba:", err);
        throw err;
    }
};


export const createRecursoVideoconferencia = async (data: VideoconfPayload, actor?: UserActor) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // A) Orden dentro del apartado
    const orderReq = new sql.Request(transaction);
    const maxOrderResult = await orderReq
      .input('apartadoId', sql.Int, data.apartadoId)
      .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
    const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

    // B) Preparar URL de sala
    const proveedor = data.modo === 'jitsi' ? 'Jitsi' : 'Externo';
    const urlSala =
      data.modo === 'jitsi'
        ? `https://meet.jit.si/${slugify(data.titulo)}-${Math.random().toString(36).slice(2,8)}`
        : (data.urlExterna || '');

    // C) Insertar en Recursos (igual que haces con Prueba; guardamos también UrlExterna para simplificar el front)
    const recursoReq = new sql.Request(transaction);
    const recursoRes = await recursoReq
      .input('apartadoId', sql.Int, data.apartadoId)
      .input('tipoRecurso', sql.NVarChar(200), 'Videoconferencia')
      .input('titulo', sql.NVarChar(1024), data.titulo)
      .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
      .input('orden', sql.Int, newOrder)
      .input('fechaCreacion', sql.DateTime, data.fechaPublicacion)
      .input('urlExterna', sql.NVarChar(500), urlSala) // <- para que el front pueda abrir directo
      .query(`
        INSERT INTO Virtual.Recursos
          (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, UrlExterna, Visible)
        OUTPUT INSERTED.RecursoID
        VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, @urlExterna, 1);
      `);

    const newRecursoId = recursoRes.recordset[0].RecursoID as number;

    // D) Insertar metadata específica
    await new sql.Request(transaction)
      .input('recursoId', sql.Int, newRecursoId)
      .input('prov', sql.NVarChar(50), proveedor)
      .input('url', sql.NVarChar(500), urlSala)
      .input('ini', sql.DateTime2, data.fechaPublicacion)
      .input('fin', sql.DateTime2, data.fechaCierre ?? null)
      .query(`
        INSERT INTO Virtual.Videoconferencias
          (RecursoID, Proveedor, UrlSala, FechaInicio, FechaCierre)
        VALUES (@recursoId, @prov, @url, @ini, @fin);
      `);

    // E) Personalización
    if (data.esPersonalizado && data.estudiantesIds?.length > 0) {
      const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
      studentTable.columns.add('RecursoID', sql.Int);
      studentTable.columns.add('MatriculaNo', sql.Int);
      for (const id of data.estudiantesIds) {
        studentTable.rows.add(newRecursoId, id);
      }
      await new sql.Request(transaction).bulk(studentTable);
    }

    await transaction.commit();

    if (actor) {
      await registrarAccion(
        actor.codigo,
        actor.perfil,
        'Aula Virtual',
        'Gestión de Videoconferencias',
        `Creó una videoconferencia: "${data.titulo}" (${proveedor})`
      );

      const target = data.whatsappTarget || 'NONE';
      try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, 
                    'VIDEOCONFERENCIA',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes (Videoconf):', notifError);
            }
    }

    return { newRecursoId };
  } catch (err) {
    await transaction.rollback();
    console.error('Error en transacción de crear videoconferencia:', err);
    throw err;
  }
};

export const createRecursoVideo = async (data: VideoResourcePayload, actor?: { codigo: number; perfil: string }) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    // A) Orden
    const r1 = await new sql.Request(tx)
      .input('apartadoId', sql.Int, data.apartadoId)
      .query(`SELECT ISNULL(MAX(Orden),0) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID=@apartadoId`);
    const newOrden = Number(r1.recordset[0].maxOrden) + 1;

    // B) Insert en Recursos (guardamos UrlExterna con la URL del video)
    const r2 = await new sql.Request(tx)
      .input('apartadoId', sql.Int, data.apartadoId)
      .input('tipo', sql.NVarChar(200), 'Video')
      .input('titulo', sql.NVarChar(1024), data.titulo)
      .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
      .input('orden', sql.Int, newOrden)
      .input('fecha', sql.DateTime, data.fechaPublicacion)
      .input('url', sql.NVarChar(500), data.urlVideo)
      .query(`
        INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, UrlExterna, Visible)
        OUTPUT INSERTED.RecursoID
        VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, @url, 1);
      `);

    const newRecursoId: number = r2.recordset[0].RecursoID;

    // C) Personalización (opcional)
    if (data.esPersonalizado && data.estudiantesIds?.length) {
      const t = new sql.Table('Virtual.RecursosEstudiantes');
      t.columns.add('RecursoID', sql.Int);
      t.columns.add('MatriculaNo', sql.Int);
      data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
      await new sql.Request(tx).bulk(t);
    }

    await tx.commit();

    if (actor) {
      await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Videos', `Creó un video: "${data.titulo}"`);
      const target = data.whatsappTarget || 'NONE';
      try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'VIDEO',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes (Video):', notifError);
            }
    }

    return { newRecursoId };
  } catch (e) {
    await tx.rollback();
    console.error('[createRecursoVideo]', e);
    throw e;
  }
};

// export const createRecursoImagenBinary = async (
//   data: CreateImagenBinaryData,
//   actor?: UserActor
// ) => {
//   const pool = await poolPromise;
//   const tx = new sql.Transaction(pool);

//   try {
//     await tx.begin();

//     // 1) Resolver next orden
//     const maxOrd = await new sql.Request(tx)
//       .input('apartadoId', sql.Int, data.apartadoId)
//       .query<{ maxOrden: number }>(`
//         SELECT MAX(Orden) AS maxOrden 
//         FROM Virtual.Recursos 
//         WHERE ApartadoID = @apartadoId;
//       `);
//     const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;

//     // 2) Insert recurso
//     const insRec = await new sql.Request(tx)
//       .input('apartadoId', sql.Int, data.apartadoId)
//       .input('tipoRecurso', sql.NVarChar(200), 'Imagen')
//       .input('titulo', sql.NVarChar(1024), data.titulo)
//       .input('contenido', sql.NVarChar(sql.MAX), data.contenido ?? '')
//       .input('orden', sql.Int, nextOrder)
//       .input('fecha', sql.DateTime, data.fechaPublicacion)
//       .query<{ RecursoID: number }>(`
//         INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
//         OUTPUT INSERTED.RecursoID
//         VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fecha, 1);
//       `);

//     const newRecursoId = Number(insRec.recordset[0].RecursoID);

//     const byteLen = data.buffer?.length ?? 0;

//     // 3) Insert binario
//     await new sql.Request(tx)
//       .input('recursoId', sql.Int, newRecursoId)
//       .input('fileName', sql.NVarChar(512), data.fileName)
//       .input('mimeType', sql.NVarChar(128), data.mimeType)
//       .input('byteLength', sql.BigInt, byteLen) 
//       .input('data', sql.VarBinary(sql.MAX), data.buffer)
//       .query(`
//         INSERT INTO Virtual.RecursosImagenes (RecursoID, FileName, MimeType, ByteLength, Data, CreatedAt)
//         VALUES (@recursoId, @fileName, @mimeType, @byteLength, @data, GETDATE());
//       `);

//     // 4) Personalización
//     if (data.esPersonalizado && data.estudiantesIds?.length) {
//       const t = new sql.Table('Virtual.RecursosEstudiantes');
//       t.columns.add('RecursoID', sql.Int);
//       t.columns.add('MatriculaNo', sql.Int);
//       data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
//       await new sql.Request(tx).bulk(t);
//     }

//     await tx.commit();

//     // ✅ LOG EN SERVICE
//     if (actor) {
//       await registrarAccion(
//         actor.codigo,
//         actor.perfil,
//         'Aula Virtual',
//         'Gestión de Recursos - Imagen',
//         `Creó imagen "${data.titulo}" en apartado ${data.apartadoId}. RecursoID=${newRecursoId}`
//       );
//     }

//     return { newRecursoId };
//   } catch (e) {
//     await tx.rollback();
//     throw e;
//   }
// };

export const getImagenBinaryByRecursoId = async (recursoId: number) => {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input('recursoId', sql.Int, recursoId)
    .query(`
      SELECT RecursoID, FileName, MimeType, ByteLength, Data
      FROM Virtual.RecursosImagenes
      WHERE RecursoID = @recursoId;
    `);

  if (!rs.recordset.length) return null;
  const row = rs.recordset[0];
  const buffer: Buffer = row.Data; // mssql driver entrega Buffer
  return { buffer, mimeType: row.MimeType, byteLength: buffer?.length || 0 };
};


export const createRecursoCarpeta = async (data: RecursoCarpetaPayload, actor?: UserActor) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    // Orden
    const r1 = await new sql.Request(tx)
      .input('apartadoId', sql.Int, data.apartadoId)
      .query(`SELECT ISNULL(MAX(Orden),0) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID=@apartadoId`);
    const newOrden = Number(r1.recordset[0].maxOrden) + 1;

    // Insert en Recursos
    const r2 = await new sql.Request(tx)
      .input('apartadoId', sql.Int, data.apartadoId)
      .input('tipo', sql.NVarChar(200), 'Carpeta')
      .input('titulo', sql.NVarChar(1024), data.titulo)
      .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
      .input('orden', sql.Int, newOrden)
      .input('fecha', sql.DateTime, data.fechaPublicacion)
      .query(`
        INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
        OUTPUT INSERTED.RecursoID
        VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, 1);
      `);
    const newRecursoId: number = r2.recordset[0].RecursoID;

    // Personalización
    if (data.esPersonalizado && data.estudiantesIds?.length) {
      const t = new sql.Table('Virtual.RecursosEstudiantes');
      t.columns.add('RecursoID', sql.Int);
      t.columns.add('MatriculaNo', sql.Int);
      data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
      await new sql.Request(tx).bulk(t);
    }

    await tx.commit();

    if (actor) {
      await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Creó la carpeta: "${data.titulo}"`);
      const target = data.whatsappTarget || 'NONE';
      try {
                await notificacionService.notificarEstudiantesDeCurso(
                    data.apartadoId,
                    newRecursoId, // ID del recurso PADRE, no de la tarea específica, para que el link funcione
                    'REUNIÓN',
                    data.titulo,
                    actor,
                    target
                );
            } catch (notifError) {
                console.error('Fallo al notificar estudiantes:', notifError);
            }
    }
    return { newRecursoId };
  } catch (e) {
    await tx.rollback();
    console.error('[createRecursoCarpeta]', e);
    throw e;
  }
};

export const createSubCarpeta = async (
    recursoId: number, 
    nombre: string, 
    carpetaPadreId: number | null, 
    actor?: UserActor
) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        // 1. Validación: Nombre duplicado en el mismo nivel
        // Usamos una query dinámica para manejar la comparación de NULL en CarpetaPadreID
        let checkQuery = `
            SELECT 1 FROM Virtual.SubCarpetas 
            WHERE RecursoID = @recursoId 
            AND Nombre = @nombre
        `;
        
        if (carpetaPadreId) {
            checkQuery += ` AND CarpetaPadreID = @padreId`;
        } else {
            checkQuery += ` AND CarpetaPadreID IS NULL`;
        }

        const checkReq = new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('nombre', sql.NVarChar(255), nombre);
        
        if (carpetaPadreId) checkReq.input('padreId', sql.Int, carpetaPadreId);

        const exists = await checkReq.query(checkQuery);

        if (exists.recordset.length > 0) {
            throw new Error(`Ya existe una carpeta llamada "${nombre}" en esta ubicación.`);
        }

        // 2. Validación: Si hay padre, verificar que el padre pertenezca al mismo recurso (Seguridad)
        if (carpetaPadreId) {
            const parentCheck = await new sql.Request(tx)
                .input('padreId', sql.Int, carpetaPadreId)
                .query('SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @padreId');
            
            if (parentCheck.recordset.length === 0) throw new Error("La carpeta padre no existe.");
            if (parentCheck.recordset[0].RecursoID !== recursoId) throw new Error("Incoherencia de datos: La carpeta padre no pertenece a este recurso.");
        }

        // 3. Insertar
        const request = new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('nombre', sql.NVarChar(255), nombre)
            .input('padreId', sql.Int, carpetaPadreId); // Si es null, SQL lo maneja bien si el input acepta null, o usamos logica condicional

        await request.query(`
            INSERT INTO Virtual.SubCarpetas (RecursoID, Nombre, CarpetaPadreID, FechaCreacion)
            VALUES (@recursoId, @nombre, @padreId, GETDATE());
        `);

        await tx.commit();

        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Creó carpeta "${nombre}" en recurso ${recursoId}`);
        }

    } catch (e) {
        await tx.rollback();
        console.error("[createSubCarpeta] Error:", e);
        throw e;
    }
};

export const createEnlaceCarpeta = async (
    recursoId: number, 
    subCarpetaId: number | null, 
    titulo: string, 
    url: string, 
    actor?: UserActor
) => {
    const pool = await poolPromise;
    
    // Validación básica de URL
    if (!url.startsWith('http')) {
        throw new Error("La URL debe comenzar con http:// o https://");
    }

    await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .input('subCarpetaId', sql.Int, subCarpetaId)
        .input('titulo', sql.NVarChar(255), titulo)
        .input('url', sql.NVarChar(2048), url)
        .query(`
            INSERT INTO Virtual.EnlacesCarpeta (RecursoID, SubCarpetaID, Titulo, Url, FechaCreacion)
            VALUES (@recursoId, @subCarpetaId, @titulo, @url, GETUTCDATE());
        `);

    if (actor) {
        await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Agregó enlace "${titulo}" en carpeta.`);
    }
};

// --- NUEVO: listar archivos de una Carpeta ---
export const listArchivosCarpeta = async (recursoId: number): Promise<ArchivoCarpetaRow[]> => {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input('recursoId', sql.Int, recursoId)
    .query(`
      SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoMimeType, TamanoKB, FechaSubida
      FROM Virtual.ArchivosCarpeta
      WHERE RecursoID = @recursoId
      ORDER BY FechaSubida DESC, ArchivoCarpetaID DESC;
    `);
  return rs.recordset as ArchivoCarpetaRow[];
};

// --- NUEVO: adjuntar archivos (bulk) ---
export const addArchivosToCarpeta = async (
    recursoId: number, 
    archivos: Express.Multer.File[],
    subCarpetaId: number | null,
    actor?: UserActor
) => {
  if (!archivos || archivos.length === 0) return;

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    if (subCarpetaId) {
            const check = await new sql.Request(tx)
                .input('id', sql.Int, subCarpetaId)
                .query("SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @id");
            
            if (check.recordset.length === 0) throw new Error("La carpeta destino no existe.");
            if (check.recordset[0].RecursoID !== recursoId) throw new Error("La carpeta destino no pertenece al recurso actual.");
        }

    for (const file of archivos) {
      await new sql.Request(tx)
        .input('recursoId', sql.Int, recursoId)
        .input('subCarpetaId', sql.Int, subCarpetaId)
        .input('nombre', sql.NVarChar(1024), file.originalname)
        .input('data', sql.VarBinary(sql.MAX), file.buffer)
        .input('mime', sql.VarChar(100), file.mimetype)
        .input('kb', sql.Int, Math.max(1, Math.round(file.size / 1024)))
        .query(`
          INSERT INTO Virtual.ArchivosCarpeta
            (RecursoID, SubCarpetaID, NombreOriginal, ArchivoData, ArchivoMimeType, TamanoKB, FechaSubida)
          VALUES
            (@recursoId, @subCarpetaId, @nombre, @data, @mime, @kb, GETUTCDATE());
        `);
    }

    await tx.commit();

    if (actor) {
      const ubicacion = subCarpetaId ? `en subcarpeta ID ${subCarpetaId}` : "en raíz";
      await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Subió ${archivos.length} archivos ${ubicacion}.`);
    }
  } catch (e) {
    await tx.rollback();
    console.error('[addArchivosToCarpeta]', e);
    throw e;
  }
};

export const getRecursoArchivoDataById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query('SELECT ArchivoData, ArchivoMimeType FROM Virtual.Recursos WHERE RecursoID = @recursoId');
    return result.recordset[0];
};

// --- NUEVO: obtener un archivo (para descargar) ---
export const getArchivoCarpetaById = async (archivoCarpetaId: number) => {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input('id', sql.Int, archivoCarpetaId)
    .query(`
      SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoData, ArchivoMimeType, TamanoKB, FechaSubida
      FROM Virtual.ArchivosCarpeta
      WHERE ArchivoCarpetaID = @id;
    `);
  return rs.recordset[0] || null;
};

export const getContenidoCarpeta = async (recursoId: number, carpetaPadreId: number | null) => {
    const pool = await poolPromise;
    
    // Validamos inputs básicos
    if (!recursoId) throw new Error("RecursoID es requerido");

    const request = pool.request()
        .input('recursoId', sql.Int, recursoId)
        .input('padreId', sql.Int, carpetaPadreId);

    // Lógica para SQL: Si carpetaPadreId es NULL, usamos 'IS NULL', si tiene valor, usamos '='
    const condicionPadreCarpetas = carpetaPadreId ? "CarpetaPadreID = @padreId" : "CarpetaPadreID IS NULL";
    const condicionPadreArchivos = carpetaPadreId ? "SubCarpetaID = @padreId" : "SubCarpetaID IS NULL";
    const condicionPadre = carpetaPadreId ? "= @padreId" : "IS NULL";

    try {
        const queryCarpetas = `
            SELECT SubCarpetaID, Nombre, FechaCreacion 
            FROM Virtual.SubCarpetas 
            WHERE RecursoID = @recursoId AND ${condicionPadreCarpetas}
            ORDER BY Nombre ASC;
        `;

        const queryArchivos = `
            SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoMimeType, TamanoKB, FechaSubida
            FROM Virtual.ArchivosCarpeta
            WHERE RecursoID = @recursoId AND ${condicionPadreArchivos}
            ORDER BY FechaSubida DESC;
        `;

        const qEnlaces = `
        SELECT EnlaceID, Titulo, Url, FechaCreacion
        FROM Virtual.EnlacesCarpeta
        WHERE RecursoID = @recursoId AND SubCarpetaID ${condicionPadre}
        ORDER BY FechaCreacion DESC;
    `;

        const [resCarpetas, resArchivos, resEnlaces] = await Promise.all([
            request.query(queryCarpetas),
            pool.request().input('recursoId', sql.Int, recursoId).input('padreId', sql.Int, carpetaPadreId).query(queryArchivos),
            pool.request().input('recursoId', sql.Int, recursoId).input('padreId', sql.Int, carpetaPadreId).query(qEnlaces)
        ]);

        return {
            carpetas: resCarpetas.recordset,
            archivos: resArchivos.recordset,
            enlaces: resEnlaces.recordset
        };
    } catch (error) {
        console.error("[getContenidoCarpeta] Error:", error);
        throw new Error("Error al obtener contenido de la carpeta.");
    }
};

// --- NUEVO: eliminar un archivo ---
export const deleteArchivoCarpeta = async (archivoCarpetaId: number, actor?: UserActor) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    const rs = await new sql.Request(tx)
      .input('id', sql.Int, archivoCarpetaId)
      .query(`
        SELECT TOP 1 ac.ArchivoCarpetaID, ac.RecursoID, ac.NombreOriginal, r.Titulo
        FROM Virtual.ArchivosCarpeta ac
        INNER JOIN Virtual.Recursos r ON r.RecursoID = ac.RecursoID
        WHERE ac.ArchivoCarpetaID = @id;
      `);

    if (!rs.recordset.length) {
      await tx.rollback();
      throw new Error('Archivo no encontrado');
    }

    const row = rs.recordset[0];

    await new sql.Request(tx)
      .input('id', sql.Int, archivoCarpetaId)
      .query(`DELETE FROM Virtual.ArchivosCarpeta WHERE ArchivoCarpetaID = @id;`);

    await tx.commit();

    if (actor) {
      await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Eliminó archivo "${row.NombreOriginal}" de la carpeta "${row.Titulo}"`);
    }
  } catch (e) {
    await tx.rollback();
    console.error('[deleteArchivoCarpeta]', e);
    throw e;
  }
};

export const deleteSubCarpeta = async (subCarpetaId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        // 1. Obtener nombre para el log antes de borrar
        const info = await new sql.Request(tx)
            .input('id', sql.Int, subCarpetaId)
            .query("SELECT Nombre FROM Virtual.SubCarpetas WHERE SubCarpetaID = @id");
        const nombreCarpeta = info.recordset[0]?.Nombre || 'Desconocida';

        // 2. CTE Recursiva para identificar TODOS los IDs de carpetas a eliminar (la carpeta target + descendientes)
        // Esto crea una tabla temporal en memoria con toda la jerarquía hacia abajo.
        const recursiveQuery = `
            WITH CarpetaTree AS (
                -- Caso base: La carpeta que queremos borrar
                SELECT SubCarpetaID 
                FROM Virtual.SubCarpetas 
                WHERE SubCarpetaID = @targetId
                
                UNION ALL
                
                -- Caso recursivo: Hijos de las carpetas encontradas
                SELECT child.SubCarpetaID 
                FROM Virtual.SubCarpetas child
                INNER JOIN CarpetaTree parent ON child.CarpetaPadreID = parent.SubCarpetaID
            )
            SELECT SubCarpetaID FROM CarpetaTree;
        `;

        // Ejecutamos para obtener los IDs
        const treeResult = await new sql.Request(tx)
            .input('targetId', sql.Int, subCarpetaId)
            .query(recursiveQuery);

        const idsToDelete = treeResult.recordset.map((r: any) => r.SubCarpetaID);

        if (idsToDelete.length > 0) {
            const idsCsv = idsToDelete.join(',');

            // 3. Eliminar TODOS los archivos que estén en cualquiera de estas carpetas
            await new sql.Request(tx).query(`
                DELETE FROM Virtual.ArchivosCarpeta 
                WHERE SubCarpetaID IN (${idsCsv})
            `);

            await new sql.Request(tx).query(`DELETE FROM Virtual.EnlacesCarpeta WHERE SubCarpetaID IN (${idsCsv})`);
            
            await new sql.Request(tx).query(`
                DELETE FROM Virtual.SubCarpetas 
                WHERE SubCarpetaID IN (${idsCsv})
            `);
        }

        await tx.commit();

        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Eliminó carpeta "${nombreCarpeta}" y todo su contenido.`);
        }

    } catch (e) {
        await tx.rollback();
        console.error("[deleteSubCarpeta] Error:", e);
        // Mejorar mensaje de error si es por FK
        if ((e as any).number === 547) { // Error FK constraint
            throw new Error("No se pudo eliminar la carpeta debido a restricciones de integridad. Contacte al administrador.");
        }
        throw e;
    }
};

export const deleteEnlaceCarpeta = async (enlaceId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.Int, enlaceId)
        .query('DELETE FROM Virtual.EnlacesCarpeta WHERE EnlaceID = @id');
    
    if (actor) await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Eliminó un enlace de carpeta.`);
};

export const moverElementoCarpeta = async (
    recursoId: number,
    tipo: 'archivo' | 'enlace',
    itemId: number,
    targetFolderId: number | null, // null = raíz
    actor?: UserActor
) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        // 1. Validar que la carpeta destino exista y pertenezca al mismo recurso (si no es raíz)
        if (targetFolderId !== null) {
            const checkFolder = await new sql.Request(tx)
                .input('fid', sql.Int, targetFolderId)
                .query('SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @fid');
            
            if (checkFolder.recordset.length === 0) throw new Error("La carpeta destino no existe.");
            if (checkFolder.recordset[0].RecursoID !== recursoId) throw new Error("No puedes mover elementos a una carpeta de otro recurso.");
        }

        // 2. Mover el elemento según el tipo
        const request = new sql.Request(tx)
            .input('itemId', sql.Int, itemId)
            .input('targetId', sql.Int, targetFolderId);

        if (tipo === 'archivo') {
            await request.query(`
                UPDATE Virtual.ArchivosCarpeta 
                SET SubCarpetaID = @targetId 
                WHERE ArchivoCarpetaID = @itemId
            `);
        } else {
            await request.query(`
                UPDATE Virtual.EnlacesCarpeta 
                SET SubCarpetaID = @targetId 
                WHERE EnlaceID = @itemId
            `);
        }

        await tx.commit();

        if (actor) {
            await registrarAccion(
                actor.codigo, 
                actor.perfil, 
                'Aula Virtual', 
                'Gestión de Carpetas', 
                `Movió un ${tipo} a la carpeta ID ${targetFolderId ?? 'Raíz'}`
            );
        }

    } catch (e) {
        await tx.rollback();
        throw e;
    }
};
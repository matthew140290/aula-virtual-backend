// src/services/recurso.service.ts
import sql from 'mssql';
import fs from 'fs/promises'; // Importación crítica para manejar los archivos en disco
import { poolPromise } from '../config/dbPool';
import { registrarAccion } from './log.service';
import * as notificacionService from './notificacion.service';

// ==========================================
// INTERFACES Y CONTRATOS ESTRICTOS
// ==========================================

export interface UserActor {
    codigo: number;
    perfil: string;
}

export interface RecursoUrlPayload {
    apartadoId: number;
    titulo: string;
    contenido: string; 
    urlExterna: string;
    fechaPublicacion: Date | string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface RecursoAnuncioPayload {
    apartadoId: number;
    titulo: string;
    contenido: string; 
    fechaPublicacion: Date | string;
    fechaCierre?: Date | string | null;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    permiteRespuestas: boolean;
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface RecursoUpdatePayload {
    titulo: string;
    contenido: string;
    urlExterna?: string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    fechaInicio?: Date | string;
    fechaCierre?: Date | string; 
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

export interface RecursoTareaPayload {
    apartadoId: number;
    codigoAsignatura: number;
    titulo: string;
    instruccionesHTML: string;
    puntajeMaximo: number;
    fechaPublicacion: Date | string;
    fechaInicio: Date | string;
    fechaVencimiento: Date | string;
    permiteEntregasTardias: boolean;
    esCalificada: boolean;
    tiposArchivoPermitidos: string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface RecursoArchivoPayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date | string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface RecursoForoPayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date | string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    fechaInicio: Date | string;
    fechaCierre: Date | string;
    esCalificable: boolean;
    puntajeMaximo?: number;
    modoForo: 'Normal' | 'PreguntaRespuesta';
    permitirPublicacionTardia: boolean;
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface PruebaResourcePayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date | string;
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
    fechaPublicacion: Date | string;
    fechaCierre?: Date | string | null;
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
    fechaPublicacion: Date | string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface RecursoCarpetaPayload {
    apartadoId: number;
    titulo: string;
    contenido: string;      
    fechaPublicacion: Date | string;
    esPersonalizado: boolean;
    estudiantesIds: number[];
    whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
}

export interface CreateImagenBinaryPayload {
    apartadoId: number;
    titulo: string;
    contenido: string;
    fechaPublicacion: Date | string;
    fileName: string;
    mimeType: string;
    path: string; // <-- AHORA ES PATH, SOLUCIONA TU ERROR ACTUAL
    esPersonalizado?: boolean;
    estudiantesIds?: number[];
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

export interface ArchivoTareaMetadata {
    id: number;
    nombre: string;
    mimeType: string;
}

// ==========================================
// UTILS
// ==========================================

function slugify(s: string): string {
    return s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

/**
 * Helper crítico: Elimina archivos temporales del disco duro.
 * Se debe llamar SIEMPRE en un bloque `finally` para evitar fugas de espacio en disco.
 */
const cleanUpFiles = async (files: Express.Multer.File | Express.Multer.File[] | undefined | null): Promise<void> => {
    if (!files) return;
    const fileArray = Array.isArray(files) ? files : [files];
    for (const f of fileArray) {
        if (f.path) {
            await fs.unlink(f.path).catch(err => console.error(`[Error de Limpieza] No se pudo borrar el temp file ${f.path}:`, err));
        }
    }
};

// ==========================================
// SERVICIOS CORE
// ==========================================

export const createRecursoImagen = async (data: CreateImagenBinaryPayload, actor?: UserActor): Promise<{ newRecursoId: number }> => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        const maxOrd = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;

        const insRec = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Imagen')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, nextOrder)
            .input('fecha', sql.DateTime, new Date(data.fechaPublicacion))
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, UrlExterna)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fecha, 1, NULL);
            `);

        const newRecursoId = Number(insRec.recordset[0].RecursoID);

        // 💡 LECTURA DESDE DISCO A BUFFER
        const fileBuffer = await fs.readFile(data.path);
        const byteLen = fileBuffer.length;

        await new sql.Request(tx)
            .input('recursoId', sql.Int, newRecursoId)
            .input('fileName', sql.NVarChar(512), data.fileName)
            .input('mimeType', sql.NVarChar(128), data.mimeType)
            .input('byteLength', sql.BigInt, byteLen)
            .input('data', sql.VarBinary(sql.MAX), fileBuffer) 
            .query(`
                INSERT INTO Virtual.RecursosImagenes (RecursoID, FileName, MimeType, ByteLength, Data, CreatedAt)
                VALUES (@recursoId, @fileName, @mimeType, @byteLength, @data, GETDATE());
            `);

        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new sql.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', sql.Int);
            t.columns.add('MatriculaNo', sql.Int);
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new sql.Request(tx).bulk(t);
        }

        await tx.commit();

        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Subió imagen a BD: "${data.titulo}" (${Math.round(byteLen/1024)} KB)`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {

                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                 console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio General. Notificando a todos los estudiantes del curso.`);   
                notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }

        return { newRecursoId };
    } catch (e) {
        await tx.rollback();
        throw e;
    } finally {
        // 🚨 LIMPIEZA GARANTIZADA DEL DISCO
        await fs.unlink(data.path).catch(() => {});
    }
};

export const createRecursoTarea = async (data: RecursoTareaPayload, archivos: Express.Multer.File[], actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const orderRequest = new sql.Request(tx);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(tx);
        const recursoResult = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Tarea')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.instruccionesHTML)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date(data.fechaPublicacion))
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;

        const tareaResult = await new sql.Request(tx)
            .input('codigoAsignatura', sql.SmallInt, data.codigoAsignatura)
            .input('titulo', sql.NVarChar(510), data.titulo)
            .input('instruccionesHTML', sql.NVarChar(sql.MAX), data.instruccionesHTML)
            .input('puntajeMaximo', sql.Decimal(5, 2), data.puntajeMaximo)
            .input('fechaPublicacion', sql.DateTime, new Date(data.fechaPublicacion))
            .input('fechaInicio', sql.DateTime, new Date(data.fechaInicio))
            .input('fechaVencimiento', sql.DateTime, new Date(data.fechaVencimiento))
            .input('permiteEntregasTardias', sql.Bit, data.permiteEntregasTardias)
            .input('recursoId', sql.Int, newRecursoId)
            .input('esCalificada', sql.Bit, data.esCalificada)
            .input('tiposArchivoPermitidos', sql.NVarChar(1024), data.tiposArchivoPermitidos)
            .query<{ TareaID: number }>(`
                INSERT INTO Virtual.Tareas 
                    (CodigoAsignatura, Titulo, InstruccionesHTML, PuntajeMaximo, FechaPublicacion, FechaInicio, FechaVencimiento, PermiteEntregasTardias, RecursoID, EsCalificada, TiposArchivoPermitidos)
                OUTPUT INSERTED.TareaID
                VALUES 
                    (@codigoAsignatura, @titulo, @instruccionesHTML, @puntajeMaximo, @fechaPublicacion, @fechaInicio, @fechaVencimiento, @permiteEntregasTardias, @recursoId, @esCalificada, @tiposArchivoPermitidos);
            `);

        const newTareaId = tareaResult.recordset[0].TareaID;

        // 💡 ARCHIVOS DE DISCO A BD
        if (archivos && archivos.length > 0) {
            for (const archivo of archivos) {
                const fileBuffer = await fs.readFile(archivo.path);
                
                await new sql.Request(tx)
                    .input('tareaId', sql.Int, newTareaId)
                    .input('nombreArchivo', sql.NVarChar(1024), archivo.originalname)
                    .input('nombreOriginal', sql.NVarChar(1024), archivo.originalname)
                    .input('archivoData', sql.VarBinary(sql.MAX), fileBuffer) 
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

        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(tx).bulk(studentTable);
        }
        
        await tx.commit();
        
        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó una nueva Tarea titulada: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'TAREA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'TAREA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }
    } catch (err) {
        await tx.rollback();
        throw err;
    } finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivos);
    }
};

export const createRecursoArchivo = async (data: RecursoArchivoPayload, archivo: Express.Multer.File, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const maxOrderResult = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        // 💡 LECTURA DE DISCO
        const fileBuffer = await fs.readFile(archivo.path);

        const recursoResult = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Archivo')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date(data.fechaPublicacion))
            .input('archivoData', sql.VarBinary(sql.MAX), fileBuffer) 
            .input('archivoMimeType', sql.VarChar(100), archivo.mimetype)
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, ArchivoData, ArchivoMimeType)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1, @archivoData, @archivoMimeType);
            `);
        
        const newRecursoId = recursoResult.recordset[0].RecursoID;
        
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(tx).bulk(studentTable);
        }
        
        await tx.commit();
        
        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo Archivo titulado: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'ARCHIVO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'ARCHIVO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }
    } catch (err) {
        await tx.rollback();
        throw err;
    } finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivo);
    }
};

export const createRecursoForo = async (data: RecursoForoPayload, archivo: Express.Multer.File | undefined, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const maxOrderResult = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        const recursoResult = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Foro')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date(data.fechaPublicacion))
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;

        // 💡 LECTURA DE DISCO (Si existe adjunto)
        let fileBuffer: Buffer | null = null;
        if (archivo) {
            fileBuffer = await fs.readFile(archivo.path);
        }

        await new sql.Request(tx)
            .input('recursoId', sql.Int, newRecursoId)
            .input('fechaInicio', sql.DateTime, new Date(data.fechaInicio))
            .input('fechaCierre', sql.DateTime, new Date(data.fechaCierre))
            .input('permitirPublicacionTardia', sql.Bit, data.permitirPublicacionTardia)
            .input('esCalificable', sql.Bit, data.esCalificable)
            .input('puntajeMaximo', sql.Decimal(5, 2), data.esCalificable ? data.puntajeMaximo : null)
            .input('modoForo', sql.VarChar(50), data.modoForo)
            .input('adjuntoData', sql.VarBinary(sql.MAX), fileBuffer) 
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
            await new sql.Request(tx).bulk(studentTable);
        }
        
        await tx.commit();
        
        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo Foro titulado: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'FORO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'FORO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }
    } catch (err) {
        await tx.rollback();
        throw err;
    } finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivo);
    }
};

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
            .query<{ RecursoID: number }>("SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @id");
        
        if (check.recordset.length === 0) throw new Error("La carpeta destino no existe.");
        if (check.recordset[0].RecursoID !== recursoId) throw new Error("La carpeta destino no pertenece al recurso actual.");
    }

    for (const file of archivos) {
        // 💡 LECTURA DE DISCO
        const fileBuffer = await fs.readFile(file.path);

        await new sql.Request(tx)
        .input('recursoId', sql.Int, recursoId)
        .input('subCarpetaId', sql.Int, subCarpetaId)
        .input('nombre', sql.NVarChar(1024), file.originalname)
        .input('data', sql.VarBinary(sql.MAX), fileBuffer)
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
    throw e;
  } finally {
      // 🚨 LIMPIEZA
      await cleanUpFiles(archivos);
  }
};


// ==========================================
// MÉTODOS DE DATOS (SIN ARCHIVOS NUEVOS)
// ==========================================

export const createRecursoImagenExterna = async (
    data: { apartadoId: number; titulo: string; contenido: string; url: string; fechaPublicacion: Date | string; esPersonalizado: boolean; estudiantesIds: number[]; whatsappTarget?: 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH'; }, 
    actor?: UserActor
) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const maxOrd = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;

        const insRec = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipo', sql.NVarChar(200), 'Imagen')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, nextOrder)
            .input('fecha', sql.DateTime, new Date(data.fechaPublicacion))
            .input('url', sql.NVarChar(sql.MAX), data.url)
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, UrlExterna)
                OUTPUT INSERTED.RecursoID 
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, 1, @url);
            `);

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
         if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }

        return { newRecursoId }; 
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

        const maxOrderResult = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        const result = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar, 'URL')
            .input('titulo', sql.NVarChar, data.titulo)
            .input('contenido', sql.NVarChar, data.contenido)
            .input('urlExterna', sql.NVarChar(sql.MAX), data.urlExterna)
            .input('orden', sql.Int, newOrder)
            .input('fechaPublicacion', sql.DateTime, new Date(data.fechaPublicacion))
            .query<{ RecursoID: number }>(`
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
            await new sql.Request(transaction).bulk(studentTable);
        }

        await transaction.commit();
        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo recurso URL titulado: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'URL', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'URL', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }
    } catch (err) {
        await transaction.rollback();
        throw err; 
    }
};

export const createRecursoAnuncio = async (data: RecursoAnuncioPayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        
        const maxOrderResult = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        const result = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Anuncio')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaPublicacion', sql.DateTime, new Date(data.fechaPublicacion))
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaPublicacion, 1);
            `);
        
        const newRecursoId = result.recordset[0].RecursoID;

        await new sql.Request(transaction)
            .input('recursoId', sql.Int, newRecursoId)
            .input('fechaCierre', sql.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
            .input('permiteRespuestas', sql.Bit, data.permiteRespuestas === undefined ? true : data.permiteRespuestas)
            .query(`
                INSERT INTO Virtual.Anuncios (RecursoID, FechaCierre, PermiteRespuestas)
                VALUES (@recursoId, @fechaCierre, @permiteRespuestas); 
            `);

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
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo Anuncio titulado: "${data.titulo}" (ID: ${newRecursoId})`);
            
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'ANUNCIO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'ANUNCIO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }
    } catch (err) {
        await transaction.rollback();
        throw err; 
    }
};

export const findRecursoById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(`
            SELECT 
                r.RecursoID as id,
                r.Titulo as titulo,
                r.Contenido as contenido,
                r.TipoRecurso as tipoRecurso,
                r.UrlExterna as urlExterna,
                r.FechaCreacion as fechaCreacion,
                r.Visible,
                r.Orden,
                
                a.Nombre as apartadoNombre,
                s.Nombre as semanaNombre,
                
                asig.Descripción AS nombreAsignatura,
                cur.Curso AS nombreCurso, 
                g.Descripción AS nombreGrado,

                CASE WHEN r.ArchivoData IS NOT NULL THEN 1 ELSE 0 END AS tieneArchivoGeneral,
                CASE WHEN f.AdjuntoData IS NOT NULL THEN 1 ELSE 0 END AS tieneAdjuntoForo,

                an.PermiteRespuestas as permiteRespuestas,

                t.PuntajeMaximo as puntajeMaximoTarea,
                t.PermiteEntregasTardias as permiteEntregasTardias,
                t.EsCalificada as esCalificadaTarea,
                t.TiposArchivoPermitidos as tiposArchivoPermitidos,
                t.FechaInicio as fechaInicioTarea,
                t.FechaVencimiento as fechaCierreTarea,

                f.FechaInicio as fechaInicioForo,
                f.FechaCierre as fechaCierreForo,
                f.EsCalificable as esCalificableForo,
                f.PuntajeMaximo as puntajeMaximoForo,
                f.PermitirPublicacionTardia as permitirPublicacionTardiaForo,
                f.ModoForo as modoForo,

                p.FechaInicio as fechaInicioPrueba,
                p.FechaCierre as fechaCierrePrueba,
                p.DuracionMinutos as duracionMinutos,
                p.NumeroIntentos as numeroIntentos,
                p.Contrasena as contrasena,
                p.ModoRevision as modoRevision,
                p.TipoPrueba as tipoPrueba,
                p.TipoExamen as tipoExamen,
                COALESCE(p.Publicado, 0) as publicado,

                v.FechaInicio as fechaInicioVideo,
                v.FechaCierre as fechaCierreVideo,
                v.Proveedor as proveedorVideo,
                v.UrlSala as urlSala,

                COALESCE(t.FechaInicio, f.FechaInicio, p.FechaInicio, v.FechaInicio) as fechaInicio,
                COALESCE(t.FechaVencimiento, f.FechaCierre, p.FechaCierre, v.FechaCierre, an.FechaCierre) as fechaCierre,
                COALESCE(t.PuntajeMaximo, f.PuntajeMaximo) as puntajeMaximo
            FROM Virtual.Recursos as r
            LEFT JOIN Virtual.Apartados as a ON r.ApartadoID = a.ApartadoID
            LEFT JOIN Virtual.Semanas as s ON a.SemanaID = s.SemanaID
            LEFT JOIN dbo.Asignaturas as asig ON s.CodigoAsignatura = asig.Código
            LEFT JOIN dbo.Cursos as cur ON asig.CódigoCurso = cur.Código 
            LEFT JOIN dbo.Grados as g ON cur.CódigoGrado = g.Código
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
        
        const typeResult = await new sql.Request(transaction)
            .input('id', sql.Int, recursoId)
            .query<{ TipoRecurso: string }>('SELECT TipoRecurso FROM Virtual.Recursos WHERE RecursoID = @id');
            
        if (typeResult.recordset.length === 0) throw new Error('Recurso no encontrado');
        const tipoRecurso = typeResult.recordset[0].TipoRecurso;

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

        const reqSpecific = new sql.Request(transaction).input('recursoId', sql.Int, recursoId);

        if (tipoRecurso === 'Tarea') {
            await reqSpecific
                .input('fechaVencimiento', sql.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null) 
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
                .input('fechaCierre', sql.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('permiteRespuestas', sql.Bit, data.permiteRespuestas) 
                .query(`
                    UPDATE Virtual.Anuncios
                    SET FechaCierre = @fechaCierre,
                    PermiteRespuestas = @permiteRespuestas
                    WHERE RecursoID = @recursoId
                `);
        } 
        else if (tipoRecurso === 'Prueba') {
            await reqSpecific
                .input('inicio', sql.DateTime, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('cierre', sql.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
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
                .input('inicio', sql.DateTime, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('cierre', sql.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
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
            
            const currentDataReq = await new sql.Request(transaction)
                .input('rid', sql.Int, recursoId)
                .query<{ UrlSala: string }>('SELECT UrlSala, Proveedor FROM Virtual.Videoconferencias WHERE RecursoID = @rid');
            
            const currentUrl = currentDataReq.recordset[0]?.UrlSala || '';
            
            let nuevaUrl = data.urlExterna; 
            let nuevoProveedor = 'Externo';

            if (vidData) {
                if (vidData.modo === 'jitsi') {
                    nuevoProveedor = 'Jitsi';
                    if (!vidData.url || vidData.url.trim() === '') {
                        nuevaUrl = currentUrl;
                        if (!nuevaUrl) {
                             nuevaUrl = `https://meet.jit.si/${slugify(data.titulo)}-${Math.random().toString(36).slice(2,8)}`;
                        }
                    } else {
                        nuevaUrl = vidData.url;
                    }
                } else {
                    nuevoProveedor = 'Externo';
                    nuevaUrl = vidData.url || '';
                }
            } else {
                nuevaUrl = currentUrl;
            }

            if (!nuevaUrl) nuevaUrl = ''; 

            await reqSpecific
                .input('inicio', sql.DateTime2, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('cierre', sql.DateTime2, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('proveedor', sql.NVarChar(50), nuevoProveedor)
                .input('urlSala', sql.NVarChar(500), nuevaUrl) 
                .query(`
                    UPDATE Virtual.Videoconferencias
                    SET FechaInicio = @inicio, 
                        FechaCierre = @cierre,
                        Proveedor = @proveedor,
                        UrlSala = @urlSala
                    WHERE RecursoID = @recursoId
                `);
            
            await new sql.Request(transaction)
                .input('recursoId', sql.Int, recursoId)
                .input('url', sql.NVarChar(sql.MAX), nuevaUrl)
                .query(`UPDATE Virtual.Recursos SET UrlExterna = @url WHERE RecursoID = @recursoId`);
        }

        await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .query('DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');

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
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Actualizó configuración completa del recurso ${recursoId} (${tipoRecurso})`);
        }
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

export const toggleRecursoVisibilityById = async (recursoId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query<{ Visible: boolean, Titulo: string }>(`
            UPDATE Virtual.Recursos
            SET Visible = CASE WHEN Visible = 1 THEN 0 ELSE 1 END
            OUTPUT INSERTED.Visible, INSERTED.Titulo
            WHERE RecursoID = @recursoId;
        `);
    
    if (result.recordset.length === 0) {
        throw new Error('Recurso no encontrado para cambiar visibilidad.');
    }
    const { Visible: nuevoEstado, Titulo } = result.recordset[0];
    if (actor) {
        await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Cambió visibilidad del recurso '${Titulo}' a ${nuevoEstado ? 'Visible' : 'Oculto'}`);
    }
    
    return { nuevoEstado };
};

export const deleteRecursoById = async (recursoId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        const resourceInfo = await request
            .input('recursoIdInfo', sql.Int, recursoId)
            .query<{ Titulo: string, TipoRecurso: string }>('SELECT Titulo, TipoRecurso FROM Virtual.Recursos WHERE RecursoID = @recursoIdInfo');
        
        const titulo = resourceInfo.recordset[0]?.Titulo || `ID ${recursoId}`;
        const tipo = resourceInfo.recordset[0]?.TipoRecurso || 'Desconocido';

        request.input('recursoId', sql.Int, recursoId);

        await request.query(`
            DELETE FROM Virtual.ArchivosCarpeta WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.EnlacesCarpeta WHERE RecursoID = @recursoId;
            UPDATE Virtual.SubCarpetas SET CarpetaPadreID = NULL WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.SubCarpetas WHERE RecursoID = @recursoId;
            
            DELETE FROM Virtual.ArchivosEntrega 
            WHERE EntregaID IN (SELECT EntregaID FROM Virtual.EntregasTareas WHERE TareaID IN (SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId));
            DELETE FROM Virtual.EntregasTareas WHERE TareaID IN (SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId);
            DELETE FROM Virtual.ArchivosTarea WHERE TareaID IN (SELECT TareaID FROM Virtual.Tareas WHERE RecursoID = @recursoId);
            DELETE FROM Virtual.Tareas WHERE RecursoID = @recursoId;

            DELETE FROM Virtual.ForoEntradaAdjuntos WHERE EntradaID IN (SELECT EntradaID FROM Virtual.ForoEntradas WHERE RecursoID = @recursoId);
            UPDATE Virtual.ForoEntradas SET EntradaPadreID = NULL WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.ForoEntradas WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.ForoCalificaciones WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.Foros WHERE RecursoID = @recursoId;

            DELETE FROM Virtual.PruebasResultados WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId);
            DELETE FROM Virtual.PruebasSimulacros WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId);
            DELETE FROM Virtual.Pruebas_Respuestas WHERE PreguntaID IN (SELECT PreguntaID FROM Virtual.Pruebas_Preguntas WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId));
            DELETE FROM Virtual.Pruebas_Preguntas WHERE PruebaID IN (SELECT PruebaID FROM Virtual.Pruebas WHERE RecursoID = @recursoId);
            DELETE FROM Virtual.Pruebas WHERE RecursoID = @recursoId;

            DELETE FROM Virtual.AnuncioRespuestas WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.Anuncios WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.Videoconferencias WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.RecursosImagenes WHERE RecursoID = @recursoId;

            DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;
            DELETE FROM Virtual.VistasRecursos WHERE RecursoID = @recursoId;
            UPDATE Virtual.Notificaciones SET RecursoID = NULL WHERE RecursoID = @recursoId;
        `);

        await request.query(`DELETE FROM Virtual.Recursos WHERE RecursoID = @recursoId;`);
        await transaction.commit();

        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Eliminó el recurso '${titulo}' (Tipo: ${tipo}, ID: ${recursoId}) y todo su contenido asociado.`);
        }
    } catch (err: any) {
        await transaction.rollback();
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

        const originalResult = await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .query('SELECT * FROM Virtual.Recursos WHERE RecursoID = @recursoId;');
        
        if (originalResult.recordset.length === 0) throw new Error('Recurso original no encontrado.');
        const original = originalResult.recordset[0];

        const studentsResult = await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .query<{ MatriculaNo: number }>('SELECT MatriculaNo FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');
        const studentIds = studentsResult.recordset.map(r => r.MatriculaNo);

        const orderResult = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, original.ApartadoID)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId;');
        const newOrder = (orderResult.recordset[0]?.maxOrden || 0) + 1;

        const cloneResult = await new sql.Request(transaction)
            .input('apartadoId', sql.Int, original.ApartadoID)
            .input('tipoRecurso', sql.NVarChar(200), original.TipoRecurso)
            .input('titulo', sql.NVarChar(1024), `${original.Titulo} (Copia)`)
            .input('contenido', sql.NVarChar(sql.MAX), original.Contenido)
            .input('urlExterna', sql.NVarChar(4096), original.UrlExterna)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date())
            .input('visible', sql.Bit, original.Visible) 
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, UrlExterna, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @urlExterna, @orden, @fechaCreacion, @visible);
            `);
        const newRecursoId = cloneResult.recordset[0].RecursoID;

        if (studentIds.length > 0) {
            const studentTable = new sql.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', sql.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', sql.Int, { nullable: false });
            for (const studentId of studentIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new sql.Request(transaction).bulk(studentTable);
        }

        await transaction.commit();
        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Clonó el recurso '${original.Titulo}' (ID: ${recursoId}). Nuevo ID: ${newRecursoId}`);
        }
        return { newRecursoId };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

export const registrarVista = async (recursoId: number, matriculaNo: number) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    
    try {
        await tx.begin();

        const check = await new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('matriculaNo', sql.Int, matriculaNo)
            .query('SELECT 1 FROM Virtual.VistasRecursos WHERE RecursoID = @recursoId AND MatriculaNo = @matriculaNo');

        if (check.recordset.length === 0) {
            await new sql.Request(tx)
                .input('recursoId', sql.Int, recursoId)
                .input('matriculaNo', sql.Int, matriculaNo)
                .query(`
                    INSERT INTO Virtual.VistasRecursos (RecursoID, MatriculaNo, FechaVista)
                    VALUES (@recursoId, @matriculaNo, GETDATE());
                `);

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
        if (error.number !== 2627) {
            console.error('[Error Crítico] al registrar vista:', error);
            throw error; 
        }
    }
};

// ... OTROS RECURSOS ESPECÍFICOS ...

export const getImagenBinaryByRecursoId = async (recursoId: number) => {
    const pool = await poolPromise;
    const rs = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query<{ MimeType: string, ByteLength: number, Data: Buffer }>(`
        SELECT MimeType, ByteLength, Data
        FROM Virtual.RecursosImagenes
        WHERE RecursoID = @recursoId;
        `);

    if (!rs.recordset.length) return null;
    const row = rs.recordset[0];
    return { buffer: row.Data, mimeType: row.MimeType, byteLength: row.Data?.length || 0 };
};

export const findAdjuntoTareaById = async (archivoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('archivoId', sql.Int, archivoId)
        .query<{ ArchivoData: Buffer, ArchivoMimeType: string, NombreOriginal: string }>('SELECT ArchivoData, ArchivoMimeType, NombreOriginal FROM Virtual.ArchivosTarea WHERE ArchivoTareaID = @archivoId');
    return result.recordset[0];
};

export const findAdjuntoForoById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query<{ AdjuntoData: Buffer, AdjuntoMimeType: string }>('SELECT AdjuntoData, AdjuntoMimeType FROM Virtual.Foros WHERE RecursoID = @recursoId');
    return result.recordset[0];
};

export const findRecursoArchivoDataById = async (recursoId: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query<{ ArchivoData: Buffer, ArchivoMimeType: string }>('SELECT ArchivoData, ArchivoMimeType FROM Virtual.Recursos WHERE RecursoID = @recursoId');
    return result.recordset[0];
};

export const createRecursoPrueba = async (data: PruebaResourcePayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const orderRequest = new sql.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        const resourceRequest = new sql.Request(transaction);
        const recursoResult = await resourceRequest
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Prueba')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date(data.fechaPublicacion || new Date()))
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;

        const pruebaRequest = new sql.Request(transaction);
        
        const fechaInicio = data.fechaInicio ? new Date(data.fechaInicio) : new Date();
        let fechaCierre: Date;
        if (data.fechaCierre) {
            fechaCierre = new Date(data.fechaCierre);
            if (fechaCierre.getTime() <= fechaInicio.getTime()) {
                fechaCierre = new Date(fechaInicio.getTime() + 60 * 60 * 1000); 
            }
        } else {
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
            .query<{ PruebaID: number }>(`
                INSERT INTO Virtual.Pruebas 
                (RecursoID, TipoPrueba, TipoExamen, DuracionMinutos, Contrasena, ModoRevision, NumeroIntentos, FechaInicio, FechaCierre, Publicado)
                OUTPUT INSERTED.PruebaID
                VALUES 
                (@recursoId, @tipoPrueba, @tipoExamen, @duracionMinutos, @contrasena, @modoRevision, @numeroIntentos, @fechaInicio, @fechaCierre, 0);
            `);
            
        const newPruebaId = pruebaResult.recordset[0].PruebaID;
        
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
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'PREUBA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'PREUBA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }

        return { newPruebaId, newRecursoId };

    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

export const createRecursoVideoconferencia = async (data: VideoconfPayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const orderReq = new sql.Request(transaction);
        const maxOrderResult = await orderReq
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;

        const proveedor = data.modo === 'jitsi' ? 'Jitsi' : 'Externo';
        const urlSala = data.modo === 'jitsi'
            ? `https://meet.jit.si/${slugify(data.titulo)}-${Math.random().toString(36).slice(2,8)}`
            : (data.urlExterna || '');

        const recursoReq = new sql.Request(transaction);
        const recursoRes = await recursoReq
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipoRecurso', sql.NVarChar(200), 'Videoconferencia')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrder)
            .input('fechaCreacion', sql.DateTime, new Date(data.fechaPublicacion))
            .input('urlExterna', sql.NVarChar(500), urlSala) 
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos
                (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, UrlExterna, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, @urlExterna, 1);
            `);

        const newRecursoId = recursoRes.recordset[0].RecursoID;

        await new sql.Request(transaction)
            .input('recursoId', sql.Int, newRecursoId)
            .input('prov', sql.NVarChar(50), proveedor)
            .input('url', sql.NVarChar(500), urlSala)
            .input('ini', sql.DateTime2, new Date(data.fechaPublicacion))
            .input('fin', sql.DateTime2, data.fechaCierre ? new Date(data.fechaCierre) : null)
            .query(`
                INSERT INTO Virtual.Videoconferencias
                (RecursoID, Proveedor, UrlSala, FechaInicio, FechaCierre)
                VALUES (@recursoId, @prov, @url, @ini, @fin);
            `);

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
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Videoconferencias', `Creó una videoconferencia: "${data.titulo}" (${proveedor})`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'VIDEOCONFERENCIA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'VIDEOCONFERENCIA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }

        return { newRecursoId };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

export const createRecursoVideo = async (data: VideoResourcePayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const r1 = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>(`SELECT ISNULL(MAX(Orden),0) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID=@apartadoId`);
        const newOrden = Number(r1.recordset[0].maxOrden) + 1;

        const r2 = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipo', sql.NVarChar(200), 'Video')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrden)
            .input('fecha', sql.DateTime, new Date(data.fechaPublicacion))
            .input('url', sql.NVarChar(500), data.urlVideo)
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, UrlExterna, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, @url, 1);
            `);

        const newRecursoId = r2.recordset[0].RecursoID;

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
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'VIDEO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'VIDEO', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }

        return { newRecursoId };
    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const createRecursoCarpeta = async (data: RecursoCarpetaPayload, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const r1 = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .query<{ maxOrden: number }>(`SELECT ISNULL(MAX(Orden),0) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID=@apartadoId`);
        const newOrden = Number(r1.recordset[0].maxOrden) + 1;

        const r2 = await new sql.Request(tx)
            .input('apartadoId', sql.Int, data.apartadoId)
            .input('tipo', sql.NVarChar(200), 'Carpeta')
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
            .input('orden', sql.Int, newOrden)
            .input('fecha', sql.DateTime, new Date(data.fechaPublicacion))
            .query<{ RecursoID: number }>(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, 1);
            `);
        const newRecursoId = r2.recordset[0].RecursoID;

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
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(
                        data.estudiantesIds, newRecursoId, 'CARPETA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                } else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(
                        data.apartadoId, newRecursoId, 'CARPETA', data.titulo, actor, data.whatsappTarget
                    ).catch(console.error);
                }
            }
        }
        return { newRecursoId };
    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const createSubCarpeta = async (recursoId: number, nombre: string, carpetaPadreId: number | null, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        let checkQuery = `SELECT 1 FROM Virtual.SubCarpetas WHERE RecursoID = @recursoId AND Nombre = @nombre`;
        checkQuery += carpetaPadreId ? ` AND CarpetaPadreID = @padreId` : ` AND CarpetaPadreID IS NULL`;

        const checkReq = new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('nombre', sql.NVarChar(255), nombre);
        
        if (carpetaPadreId) checkReq.input('padreId', sql.Int, carpetaPadreId);

        const exists = await checkReq.query(checkQuery);

        if (exists.recordset.length > 0) {
            throw new Error(`Ya existe una carpeta llamada "${nombre}" en esta ubicación.`);
        }

        if (carpetaPadreId) {
            const parentCheck = await new sql.Request(tx)
                .input('padreId', sql.Int, carpetaPadreId)
                .query<{ RecursoID: number }>('SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @padreId');
            
            if (parentCheck.recordset.length === 0) throw new Error("La carpeta padre no existe.");
            if (parentCheck.recordset[0].RecursoID !== recursoId) throw new Error("Incoherencia de datos: La carpeta padre no pertenece a este recurso.");
        }

        const request = new sql.Request(tx)
            .input('recursoId', sql.Int, recursoId)
            .input('nombre', sql.NVarChar(255), nombre)
            .input('padreId', sql.Int, carpetaPadreId); 

        await request.query(`
            INSERT INTO Virtual.SubCarpetas (RecursoID, Nombre, CarpetaPadreID, FechaCreacion)
            VALUES (@recursoId, @nombre, @padreId, GETDATE());
        `);

        await tx.commit();

        if (actor) {
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Creó subcarpeta "${nombre}" en recurso ${recursoId}`);
        }

    } catch (e) {
        await tx.rollback();
        throw e;
    }
};

export const createEnlaceCarpeta = async (recursoId: number, subCarpetaId: number | null, titulo: string, url: string, actor?: UserActor) => {
    const pool = await poolPromise;
    
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

export const listArchivosCarpeta = async (recursoId: number): Promise<ArchivoCarpetaRow[]> => {
    const pool = await poolPromise;
    const rs = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query<ArchivoCarpetaRow>(`
        SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoMimeType, TamanoKB, FechaSubida
        FROM Virtual.ArchivosCarpeta
        WHERE RecursoID = @recursoId
        ORDER BY FechaSubida DESC, ArchivoCarpetaID DESC;
        `);
    return rs.recordset;
};

export const getArchivoCarpetaById = async (archivoCarpetaId: number) => {
    const pool = await poolPromise;
    const rs = await pool.request()
        .input('id', sql.Int, archivoCarpetaId)
        .query<{ ArchivoData: Buffer, ArchivoMimeType: string, NombreOriginal: string }>(`
        SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoData, ArchivoMimeType, TamanoKB, FechaSubida
        FROM Virtual.ArchivosCarpeta
        WHERE ArchivoCarpetaID = @id;
        `);
    return rs.recordset[0] || null;
};

export const getContenidoCarpeta = async (recursoId: number, carpetaPadreId: number | null) => {
    const pool = await poolPromise;
    
    if (!recursoId) throw new Error("RecursoID es requerido");

    const request = pool.request()
        .input('recursoId', sql.Int, recursoId)
        .input('padreId', sql.Int, carpetaPadreId);

    const condicionPadreCarpetas = carpetaPadreId ? "CarpetaPadreID = @padreId" : "CarpetaPadreID IS NULL";
    const condicionPadreArchivos = carpetaPadreId ? "SubCarpetaID = @padreId" : "SubCarpetaID IS NULL";
    const condicionPadre = carpetaPadreId ? "= @padreId" : "IS NULL";

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
};

export const deleteArchivoCarpeta = async (archivoCarpetaId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        const rs = await new sql.Request(tx)
            .input('id', sql.Int, archivoCarpetaId)
            .query<{ NombreOriginal: string, Titulo: string }>(`
                SELECT TOP 1 ac.ArchivoCarpetaID, ac.RecursoID, ac.NombreOriginal, r.Titulo
                FROM Virtual.ArchivosCarpeta ac
                INNER JOIN Virtual.Recursos r ON r.RecursoID = ac.RecursoID
                WHERE ac.ArchivoCarpetaID = @id;
            `);

        if (!rs.recordset.length) {
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
        throw e;
    }
};

export const deleteSubCarpeta = async (subCarpetaId: number, actor?: UserActor) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        const info = await new sql.Request(tx)
            .input('id', sql.Int, subCarpetaId)
            .query<{ Nombre: string }>("SELECT Nombre FROM Virtual.SubCarpetas WHERE SubCarpetaID = @id");
        const nombreCarpeta = info.recordset[0]?.Nombre || 'Desconocida';

        const recursiveQuery = `
            WITH CarpetaTree AS (
                SELECT SubCarpetaID 
                FROM Virtual.SubCarpetas 
                WHERE SubCarpetaID = @targetId
                
                UNION ALL
                
                SELECT child.SubCarpetaID 
                FROM Virtual.SubCarpetas child
                INNER JOIN CarpetaTree parent ON child.CarpetaPadreID = parent.SubCarpetaID
            )
            SELECT SubCarpetaID FROM CarpetaTree;
        `;

        const treeResult = await new sql.Request(tx)
            .input('targetId', sql.Int, subCarpetaId)
            .query<{ SubCarpetaID: number }>(recursiveQuery);

        const idsToDelete = treeResult.recordset.map(r => r.SubCarpetaID);

        if (idsToDelete.length > 0) {
            const idsCsv = idsToDelete.join(',');

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
            await registrarAccion(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Eliminó subcarpeta "${nombreCarpeta}" y su contenido.`);
        }

    } catch (e: any) {
        await tx.rollback();
        if (e.number === 547) { 
            throw new Error("No se pudo eliminar la carpeta debido a restricciones de integridad.");
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
    targetFolderId: number | null, 
    actor?: UserActor
) => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        if (targetFolderId !== null) {
            const checkFolder = await new sql.Request(tx)
                .input('fid', sql.Int, targetFolderId)
                .query<{ RecursoID: number }>('SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @fid');
            
            if (checkFolder.recordset.length === 0) throw new Error("La carpeta destino no existe.");
            if (checkFolder.recordset[0].RecursoID !== recursoId) throw new Error("No puedes mover elementos a una carpeta de otro recurso.");
        }

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
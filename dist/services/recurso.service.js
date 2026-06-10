"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moverElementoCarpeta = exports.deleteEnlaceCarpeta = exports.deleteSubCarpeta = exports.deleteArchivoCarpeta = exports.getContenidoCarpeta = exports.getArchivoCarpetaById = exports.listArchivosCarpeta = exports.createEnlaceCarpeta = exports.createSubCarpeta = exports.createRecursoCarpeta = exports.createRecursoVideo = exports.createRecursoVideoconferencia = exports.createRecursoPrueba = exports.findRecursoArchivoDataById = exports.findAdjuntoForoById = exports.findAdjuntoTareaById = exports.getImagenBinaryByRecursoId = exports.findVistasByRecursoId = exports.registrarVista = exports.cloneRecursoById = exports.deleteRecursoById = exports.toggleRecursoVisibilityById = exports.updateRecursoById = exports.findRecursoById = exports.createRecursoAnuncio = exports.createRecursoUrl = exports.createRecursoImagenExterna = exports.addArchivosToCarpeta = exports.createRecursoForo = exports.createRecursoArchivo = exports.createRecursoTarea = exports.createRecursoImagen = exports.estudiantePuedeAccederRecurso = void 0;
// src/services/recurso.service.ts
const mssql_1 = __importDefault(require("mssql"));
const promises_1 = __importDefault(require("fs/promises")); // Importación crítica para manejar los archivos en disco
const dbPool_1 = require("../config/dbPool");
const log_service_1 = require("./log.service");
const errors_1 = require("../utils/errors");
const notificacionService = __importStar(require("./notificacion.service"));
// ==========================================
// UTILS
// ==========================================
function slugify(s) {
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
const cleanUpFiles = async (files) => {
    if (!files)
        return;
    const fileArray = Array.isArray(files) ? files : [files];
    for (const f of fileArray) {
        if (f.path) {
            await promises_1.default.unlink(f.path).catch(err => console.error(`[Error de Limpieza] No se pudo borrar el temp file ${f.path}:`, err));
        }
    }
};
const estudiantePuedeAccederRecurso = async (recursoId, matriculaNo) => {
    if (!Number.isFinite(recursoId) || !Number.isFinite(matriculaNo))
        return false;
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
        .query(`
            SELECT
                CASE WHEN EXISTS (
                    SELECT 1 FROM Virtual.Recursos r WHERE r.RecursoID = @recursoId
                ) THEN 1 ELSE 0 END AS recursoExiste,
                CASE WHEN EXISTS (
                    SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = @recursoId
                ) THEN 1 ELSE 0 END AS esPersonalizado,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM Virtual.RecursosEstudiantes re
                    WHERE re.RecursoID = @recursoId
                      AND ABS(re.MatriculaNo) = @matriculaNo
                ) THEN 1 ELSE 0 END AS permitido;
        `);
    const row = result.recordset[0];
    if (!row || row.recursoExiste !== 1)
        return false;
    return row.esPersonalizado !== 1 || row.permitido === 1;
};
exports.estudiantePuedeAccederRecurso = estudiantePuedeAccederRecurso;
// ==========================================
// SERVICIOS CORE
// ==========================================
const createRecursoImagen = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const maxOrd = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;
        const insRec = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Imagen')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, nextOrder)
            .input('fecha', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, UrlExterna)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fecha, 1, NULL);
            `);
        const newRecursoId = Number(insRec.recordset[0].RecursoID);
        // 💡 LECTURA DESDE DISCO A BUFFER
        const fileBuffer = await promises_1.default.readFile(data.path);
        const byteLen = fileBuffer.length;
        await new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, newRecursoId)
            .input('fileName', mssql_1.default.NVarChar(512), data.fileName)
            .input('mimeType', mssql_1.default.NVarChar(128), data.mimeType)
            .input('byteLength', mssql_1.default.BigInt, byteLen)
            .input('data', mssql_1.default.VarBinary(mssql_1.default.MAX), fileBuffer)
            .query(`
                INSERT INTO Virtual.RecursosImagenes (RecursoID, FileName, MimeType, ByteLength, Data, CreatedAt)
                VALUES (@recursoId, @fileName, @mimeType, @byteLength, @data, GETDATE());
            `);
        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            t.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new mssql_1.default.Request(tx).bulk(t);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Subió imagen a BD: "${data.titulo}" (${Math.round(byteLen / 1024)} KB)`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio General. Notificando a todos los estudiantes del curso.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
        return { newRecursoId };
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
    finally {
        // 🚨 LIMPIEZA GARANTIZADA DEL DISCO
        await promises_1.default.unlink(data.path).catch(() => { });
    }
};
exports.createRecursoImagen = createRecursoImagen;
const createRecursoTarea = async (data, archivos, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const orderRequest = new mssql_1.default.Request(tx);
        const maxOrderResult = await orderRequest
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        const resourceRequest = new mssql_1.default.Request(tx);
        const recursoResult = await resourceRequest
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Tarea')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.instruccionesHTML)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaCreacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;
        const tareaResult = await new mssql_1.default.Request(tx)
            .input('codigoAsignatura', mssql_1.default.SmallInt, data.codigoAsignatura)
            .input('titulo', mssql_1.default.NVarChar(510), data.titulo)
            .input('instruccionesHTML', mssql_1.default.NVarChar(mssql_1.default.MAX), data.instruccionesHTML)
            .input('puntajeMaximo', mssql_1.default.Decimal(5, 2), data.puntajeMaximo)
            .input('fechaPublicacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .input('fechaInicio', mssql_1.default.DateTime, new Date(data.fechaInicio))
            .input('fechaVencimiento', mssql_1.default.DateTime, new Date(data.fechaVencimiento))
            .input('permiteEntregasTardias', mssql_1.default.Bit, data.permiteEntregasTardias)
            .input('recursoId', mssql_1.default.Int, newRecursoId)
            .input('esCalificada', mssql_1.default.Bit, data.esCalificada)
            .input('tiposArchivoPermitidos', mssql_1.default.NVarChar(1024), data.tiposArchivoPermitidos)
            .query(`
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
                const fileBuffer = await promises_1.default.readFile(archivo.path);
                await new mssql_1.default.Request(tx)
                    .input('tareaId', mssql_1.default.Int, newTareaId)
                    .input('nombreArchivo', mssql_1.default.NVarChar(1024), archivo.originalname)
                    .input('nombreOriginal', mssql_1.default.NVarChar(1024), archivo.originalname)
                    .input('archivoData', mssql_1.default.VarBinary(mssql_1.default.MAX), fileBuffer)
                    .input('archivoMimeType', mssql_1.default.VarChar(100), archivo.mimetype)
                    .input('tamanoKB', mssql_1.default.Int, Math.round(archivo.size / 1024))
                    .query(`
                        INSERT INTO Virtual.ArchivosTarea 
                            (TareaID, nombreArchivo, NombreOriginal, ArchivoData, ArchivoMimeType, TamanoKB, FechaSubida)
                        VALUES 
                            (@tareaId, @nombreArchivo, @nombreOriginal, @archivoData, @archivoMimeType, @tamanoKB, GETDATE());
                    `);
            }
        }
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(tx).bulk(studentTable);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó una nueva Tarea titulada: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'TAREA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'TAREA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
    }
    catch (err) {
        await tx.rollback();
        throw err;
    }
    finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivos);
    }
};
exports.createRecursoTarea = createRecursoTarea;
const createRecursoArchivo = async (data, archivo, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const maxOrderResult = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        // 💡 LECTURA DE DISCO
        const fileBuffer = await promises_1.default.readFile(archivo.path);
        const recursoResult = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Archivo')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaCreacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .input('archivoData', mssql_1.default.VarBinary(mssql_1.default.MAX), fileBuffer)
            .input('archivoMimeType', mssql_1.default.VarChar(100), archivo.mimetype)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, ArchivoData, ArchivoMimeType)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1, @archivoData, @archivoMimeType);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(tx).bulk(studentTable);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo Archivo titulado: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'ARCHIVO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'ARCHIVO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
    }
    catch (err) {
        await tx.rollback();
        throw err;
    }
    finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivo);
    }
};
exports.createRecursoArchivo = createRecursoArchivo;
const createRecursoForo = async (data, archivo, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const maxOrderResult = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        const recursoResult = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Foro')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaCreacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;
        // 💡 LECTURA DE DISCO (Si existe adjunto)
        let fileBuffer = null;
        if (archivo) {
            fileBuffer = await promises_1.default.readFile(archivo.path);
        }
        await new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, newRecursoId)
            .input('fechaInicio', mssql_1.default.DateTime, new Date(data.fechaInicio))
            .input('fechaCierre', mssql_1.default.DateTime, new Date(data.fechaCierre))
            .input('permitirPublicacionTardia', mssql_1.default.Bit, data.permitirPublicacionTardia)
            .input('esCalificable', mssql_1.default.Bit, data.esCalificable)
            .input('puntajeMaximo', mssql_1.default.Decimal(5, 2), data.esCalificable ? data.puntajeMaximo : null)
            .input('modoForo', mssql_1.default.VarChar(50), data.modoForo)
            .input('adjuntoData', mssql_1.default.VarBinary(mssql_1.default.MAX), fileBuffer)
            .input('adjuntoMimeType', mssql_1.default.VarChar(100), archivo ? archivo.mimetype : null)
            .query(`
                INSERT INTO Virtual.Foros (RecursoID, FechaInicio, FechaCierre, PermitirPublicacionTardia, EsCalificable, PuntajeMaximo, ModoForo, AdjuntoData, AdjuntoMimeType)
                VALUES (@recursoId, @fechaInicio, @fechaCierre, @permitirPublicacionTardia, @esCalificable, @puntajeMaximo, @modoForo, @adjuntoData, @adjuntoMimeType);
            `);
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(tx).bulk(studentTable);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo Foro titulado: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'FORO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'FORO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
    }
    catch (err) {
        await tx.rollback();
        throw err;
    }
    finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivo);
    }
};
exports.createRecursoForo = createRecursoForo;
const addArchivosToCarpeta = async (recursoId, archivos, subCarpetaId, actor) => {
    if (!archivos || archivos.length === 0)
        return;
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        if (subCarpetaId) {
            const check = await new mssql_1.default.Request(tx)
                .input('id', mssql_1.default.Int, subCarpetaId)
                .query("SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @id");
            if (check.recordset.length === 0)
                throw new Error("La carpeta destino no existe.");
            if (check.recordset[0].RecursoID !== recursoId)
                throw new Error("La carpeta destino no pertenece al recurso actual.");
        }
        for (const file of archivos) {
            // 💡 LECTURA DE DISCO
            const fileBuffer = await promises_1.default.readFile(file.path);
            await new mssql_1.default.Request(tx)
                .input('recursoId', mssql_1.default.Int, recursoId)
                .input('subCarpetaId', mssql_1.default.Int, subCarpetaId)
                .input('nombre', mssql_1.default.NVarChar(1024), file.originalname)
                .input('data', mssql_1.default.VarBinary(mssql_1.default.MAX), fileBuffer)
                .input('mime', mssql_1.default.VarChar(100), file.mimetype)
                .input('kb', mssql_1.default.Int, Math.max(1, Math.round(file.size / 1024)))
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
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Subió ${archivos.length} archivos ${ubicacion}.`);
        }
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
    finally {
        // 🚨 LIMPIEZA
        await cleanUpFiles(archivos);
    }
};
exports.addArchivosToCarpeta = addArchivosToCarpeta;
// ==========================================
// MÉTODOS DE DATOS (SIN ARCHIVOS NUEVOS)
// ==========================================
const createRecursoImagenExterna = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const maxOrd = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const nextOrder = (maxOrd.recordset[0]?.maxOrden || 0) + 1;
        const insRec = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipo', mssql_1.default.NVarChar(200), 'Imagen')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, nextOrder)
            .input('fecha', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .input('url', mssql_1.default.NVarChar(mssql_1.default.MAX), data.url)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible, UrlExterna)
                OUTPUT INSERTED.RecursoID 
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, 1, @url);
            `);
        const newRecursoId = Number(insRec.recordset[0].RecursoID);
        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            t.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new mssql_1.default.Request(tx).bulk(t);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Vinculó imagen externa: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'IMAGEN', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
        return { newRecursoId };
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.createRecursoImagenExterna = createRecursoImagenExterna;
const createRecursoUrl = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const maxOrderResult = await new mssql_1.default.Request(transaction)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        const result = await new mssql_1.default.Request(transaction)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar, 'URL')
            .input('titulo', mssql_1.default.NVarChar, data.titulo)
            .input('contenido', mssql_1.default.NVarChar, data.contenido)
            .input('urlExterna', mssql_1.default.NVarChar(mssql_1.default.MAX), data.urlExterna)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaPublicacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .query(`
                INSERT INTO Virtual.Recursos 
                    (ApartadoID, TipoRecurso, Titulo, Contenido, UrlExterna, Orden, FechaCreacion)
                OUTPUT INSERTED.RecursoID
                VALUES 
                    (@apartadoId, @tipoRecurso, @titulo, @contenido, @urlExterna, @orden, @fechaPublicacion);
            `);
        const newRecursoId = result.recordset[0].RecursoID;
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(transaction).bulk(studentTable);
        }
        await transaction.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo recurso URL titulado: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'URL', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'URL', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.createRecursoUrl = createRecursoUrl;
const createRecursoAnuncio = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const maxOrderResult = await new mssql_1.default.Request(transaction)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        const result = await new mssql_1.default.Request(transaction)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Anuncio')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaPublicacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaPublicacion, 1);
            `);
        const newRecursoId = result.recordset[0].RecursoID;
        await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, newRecursoId)
            .input('fechaCierre', mssql_1.default.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
            .input('permiteRespuestas', mssql_1.default.Bit, data.permiteRespuestas === undefined ? true : data.permiteRespuestas)
            .query(`
                INSERT INTO Virtual.Anuncios (RecursoID, FechaCierre, PermiteRespuestas)
                VALUES (@recursoId, @fechaCierre, @permiteRespuestas); 
            `);
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(transaction).bulk(studentTable);
        }
        await transaction.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Creó un nuevo Anuncio titulado: "${data.titulo}" (ID: ${newRecursoId})`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'ANUNCIO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'ANUNCIO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.createRecursoAnuncio = createRecursoAnuncio;
const findRecursoById = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
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
                CASE WHEN EXISTS (
                    SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = r.RecursoID
                ) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END as esPersonalizado,
                (
                    SELECT STRING_AGG(CONVERT(varchar(20), ABS(re.MatriculaNo)), ',')
                    FROM Virtual.RecursosEstudiantes re
                    WHERE re.RecursoID = r.RecursoID
                ) as estudiantesIds,
                
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
    const recurso = result.recordset[0];
    const estudiantesIds = typeof recurso.estudiantesIds === 'string'
        ? recurso.estudiantesIds
            .split(',')
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        : [];
    return {
        ...recurso,
        esPersonalizado: !!recurso.esPersonalizado,
        estudiantesIds,
        tieneAdjunto: !!recurso.tieneAdjuntoForo,
        DuracionMinutos: recurso.duracionMinutos,
        NumeroIntentos: recurso.numeroIntentos,
        Contrasena: recurso.contrasena,
        ModoRevision: recurso.modoRevision,
        Publicado: !!recurso.publicado,
    };
};
exports.findRecursoById = findRecursoById;
const updateRecursoById = async (recursoId, data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const typeResult = await new mssql_1.default.Request(transaction)
            .input('id', mssql_1.default.Int, recursoId)
            .query('SELECT TipoRecurso FROM Virtual.Recursos WHERE RecursoID = @id');
        if (typeResult.recordset.length === 0)
            throw new Error('Recurso no encontrado');
        const tipoRecurso = typeResult.recordset[0].TipoRecurso;
        await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('urlExterna', mssql_1.default.NVarChar(mssql_1.default.MAX), data.urlExterna || null)
            .query(`
                UPDATE Virtual.Recursos
                SET Titulo = @titulo, Contenido = @contenido, UrlExterna = @urlExterna
                WHERE RecursoID = @recursoId;
            `);
        const reqSpecific = new mssql_1.default.Request(transaction).input('recursoId', mssql_1.default.Int, recursoId);
        if (tipoRecurso === 'Tarea') {
            await reqSpecific
                .input('fechaInicio', mssql_1.default.DateTime, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('fechaVencimiento', mssql_1.default.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('puntaje', mssql_1.default.Decimal(5, 2), data.puntajeMaximo)
                .input('tardias', mssql_1.default.Bit, data.permiteEntregasTardias)
                .input('archivos', mssql_1.default.NVarChar(1024), data.tiposArchivoPermitidos)
                .query(`
                    UPDATE Virtual.Tareas
                    SET FechaInicio = @fechaInicio,
                        FechaVencimiento = @fechaVencimiento,
                        PuntajeMaximo = @puntaje,
                        PermiteEntregasTardias = @tardias,
                        TiposArchivoPermitidos = @archivos
                    WHERE RecursoID = @recursoId
                `);
        }
        else if (tipoRecurso === 'Anuncio') {
            await reqSpecific
                .input('fechaCierre', mssql_1.default.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('permiteRespuestas', mssql_1.default.Bit, data.permiteRespuestas)
                .query(`
                    UPDATE Virtual.Anuncios
                    SET FechaCierre = @fechaCierre,
                    PermiteRespuestas = @permiteRespuestas
                    WHERE RecursoID = @recursoId
                `);
        }
        else if (tipoRecurso === 'Prueba') {
            await reqSpecific
                .input('inicio', mssql_1.default.DateTime, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('cierre', mssql_1.default.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('duracion', mssql_1.default.SmallInt, data.duracionMinutos)
                .input('intentos', mssql_1.default.SmallInt, data.numeroIntentos)
                .input('revision', mssql_1.default.NVarChar(50), data.modoRevision)
                .input('password', mssql_1.default.NVarChar(50), data.contrasena || null)
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
                .input('inicio', mssql_1.default.DateTime, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('cierre', mssql_1.default.DateTime, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('calificable', mssql_1.default.Bit, data.esCalificable)
                .input('puntaje', mssql_1.default.Decimal(5, 2), data.esCalificable ? data.puntajeMaximo : null)
                .input('tardia', mssql_1.default.Bit, data.permitirPublicacionTardia)
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
            const currentDataReq = await new mssql_1.default.Request(transaction)
                .input('rid', mssql_1.default.Int, recursoId)
                .query('SELECT UrlSala, Proveedor FROM Virtual.Videoconferencias WHERE RecursoID = @rid');
            const currentUrl = currentDataReq.recordset[0]?.UrlSala || '';
            let nuevaUrl = data.urlExterna;
            let nuevoProveedor = 'Externo';
            if (vidData) {
                if (vidData.modo === 'jitsi') {
                    nuevoProveedor = 'Jitsi';
                    if (!vidData.url || vidData.url.trim() === '') {
                        nuevaUrl = currentUrl;
                        if (!nuevaUrl) {
                            nuevaUrl = `https://meet.jit.si/${slugify(data.titulo)}-${Math.random().toString(36).slice(2, 8)}`;
                        }
                    }
                    else {
                        nuevaUrl = vidData.url;
                    }
                }
                else {
                    nuevoProveedor = 'Externo';
                    nuevaUrl = vidData.url || '';
                }
            }
            else {
                nuevaUrl = currentUrl;
            }
            if (!nuevaUrl)
                nuevaUrl = '';
            await reqSpecific
                .input('inicio', mssql_1.default.DateTime2, data.fechaInicio ? new Date(data.fechaInicio) : null)
                .input('cierre', mssql_1.default.DateTime2, data.fechaCierre ? new Date(data.fechaCierre) : null)
                .input('proveedor', mssql_1.default.NVarChar(50), nuevoProveedor)
                .input('urlSala', mssql_1.default.NVarChar(500), nuevaUrl)
                .query(`
                    UPDATE Virtual.Videoconferencias
                    SET FechaInicio = @inicio, 
                        FechaCierre = @cierre,
                        Proveedor = @proveedor,
                        UrlSala = @urlSala
                    WHERE RecursoID = @recursoId
                `);
            await new mssql_1.default.Request(transaction)
                .input('recursoId', mssql_1.default.Int, recursoId)
                .input('url', mssql_1.default.NVarChar(mssql_1.default.MAX), nuevaUrl)
                .query(`UPDATE Virtual.Recursos SET UrlExterna = @url WHERE RecursoID = @recursoId`);
        }
        await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .query('DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');
        if (data.esPersonalizado && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(recursoId, studentId);
            }
            await new mssql_1.default.Request(transaction).bulk(studentTable);
        }
        await transaction.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Actualizó configuración completa del recurso ${recursoId} (${tipoRecurso})`);
        }
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.updateRecursoById = updateRecursoById;
const toggleRecursoVisibilityById = async (recursoId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
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
        await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Cambió visibilidad del recurso '${Titulo}' a ${nuevoEstado ? 'Visible' : 'Oculto'}`);
    }
    return { nuevoEstado };
};
exports.toggleRecursoVisibilityById = toggleRecursoVisibilityById;
const deleteRecursoById = async (recursoId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const request = new mssql_1.default.Request(transaction);
        const resourceInfo = await request
            .input('recursoIdInfo', mssql_1.default.Int, recursoId)
            .query('SELECT Titulo, TipoRecurso FROM Virtual.Recursos WHERE RecursoID = @recursoIdInfo');
        const titulo = resourceInfo.recordset[0]?.Titulo || `ID ${recursoId}`;
        const tipo = resourceInfo.recordset[0]?.TipoRecurso || 'Desconocido';
        request.input('recursoId', mssql_1.default.Int, recursoId);
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
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Eliminó el recurso '${titulo}' (Tipo: ${tipo}, ID: ${recursoId}) y todo su contenido asociado.`);
        }
    }
    catch (err) {
        await transaction.rollback();
        if ((0, errors_1.isSqlErrorLike)(err) && err.number === 547) {
            throw new Error(`No se pudo eliminar el recurso debido a una dependencia de datos no controlada. Detalle técnico: ${err.message}`);
        }
        throw err;
    }
};
exports.deleteRecursoById = deleteRecursoById;
const cloneRecursoById = async (recursoId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const originalResult = await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .query('SELECT * FROM Virtual.Recursos WHERE RecursoID = @recursoId;');
        if (originalResult.recordset.length === 0)
            throw new Error('Recurso original no encontrado.');
        const original = originalResult.recordset[0];
        const studentsResult = await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .query('SELECT MatriculaNo FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId;');
        const studentIds = studentsResult.recordset.map(r => r.MatriculaNo);
        const orderResult = await new mssql_1.default.Request(transaction)
            .input('apartadoId', mssql_1.default.Int, original.ApartadoID)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId;');
        const newOrder = (orderResult.recordset[0]?.maxOrden || 0) + 1;
        const cloneResult = await new mssql_1.default.Request(transaction)
            .input('apartadoId', mssql_1.default.Int, original.ApartadoID)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), original.TipoRecurso)
            .input('titulo', mssql_1.default.NVarChar(1024), `${original.Titulo} (Copia)`)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), original.Contenido)
            .input('urlExterna', mssql_1.default.NVarChar(4096), original.UrlExterna)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaCreacion', mssql_1.default.DateTime, new Date())
            .input('visible', mssql_1.default.Bit, original.Visible)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, UrlExterna, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @urlExterna, @orden, @fechaCreacion, @visible);
            `);
        const newRecursoId = cloneResult.recordset[0].RecursoID;
        if (studentIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of studentIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(transaction).bulk(studentTable);
        }
        await transaction.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Recursos', `Clonó el recurso '${original.Titulo}' (ID: ${recursoId}). Nuevo ID: ${newRecursoId}`);
        }
        return { newRecursoId };
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.cloneRecursoById = cloneRecursoById;
const registrarVista = async (recursoId, matriculaNo) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const check = await new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNo)
            .query('SELECT 1 FROM Virtual.VistasRecursos WHERE RecursoID = @recursoId AND MatriculaNo = @matriculaNo');
        if (check.recordset.length === 0) {
            await new mssql_1.default.Request(tx)
                .input('recursoId', mssql_1.default.Int, recursoId)
                .input('matriculaNo', mssql_1.default.Int, matriculaNo)
                .query(`
                    INSERT INTO Virtual.VistasRecursos (RecursoID, MatriculaNo, FechaVista)
                    VALUES (@recursoId, @matriculaNo, GETDATE());
                `);
            await new mssql_1.default.Request(tx)
                .input('recursoId', mssql_1.default.Int, recursoId)
                .query(`
                    UPDATE Virtual.Recursos 
                    SET vistas = ISNULL(vistas, 0) + 1 
                    WHERE RecursoID = @recursoId;
                `);
        }
        else {
            await new mssql_1.default.Request(tx)
                .input('recursoId', mssql_1.default.Int, recursoId)
                .input('matriculaNo', mssql_1.default.Int, matriculaNo)
                .query(`
                    UPDATE Virtual.VistasRecursos
                    SET FechaVista = GETDATE()
                    WHERE RecursoID = @recursoId AND MatriculaNo = @matriculaNo;
                `);
        }
        await tx.commit();
    }
    catch (error) {
        await tx.rollback();
        if ((0, errors_1.isSqlErrorLike)(error) && error.number === 2627) {
            await pool.request()
                .input('recursoId', mssql_1.default.Int, recursoId)
                .input('matriculaNo', mssql_1.default.Int, matriculaNo)
                .query(`
                    UPDATE Virtual.VistasRecursos
                    SET FechaVista = GETDATE()
                    WHERE RecursoID = @recursoId AND MatriculaNo = @matriculaNo;
                `);
            return;
        }
        console.error('[Error Crítico] al registrar vista:', error);
        throw error;
    }
};
exports.registrarVista = registrarVista;
const findVistasByRecursoId = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const recursoExists = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query('SELECT 1 as [exists] FROM Virtual.Recursos WHERE RecursoID = @recursoId');
    if (recursoExists.recordset.length === 0) {
        throw new Error('Recurso no encontrado.');
    }
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
            WITH vistas_unicas AS (
                SELECT
                    vr.MatriculaNo,
                    MAX(vr.FechaVista) AS FechaVista
                FROM Virtual.VistasRecursos vr
                WHERE vr.RecursoID = @recursoId
                GROUP BY vr.MatriculaNo
            )
            SELECT
                vu.MatriculaNo as matriculaNo,
                CASE
                    WHEN e.MatrículaNo IS NULL THEN CONCAT('Estudiante ', vu.MatriculaNo)
                    ELSE LTRIM(RTRIM(CONCAT(
                        ISNULL(e.PrimerApellido, ''), ' ',
                        ISNULL(e.SegundoApellido, ''), ' ',
                        ISNULL(e.PrimerNombre, ''), ' ',
                        ISNULL(e.SegundoNombre, '')
                    )))
                END as nombreCompleto,
                CONVERT(varchar(19), vu.FechaVista, 120) as fechaVista
            FROM vistas_unicas vu
            LEFT JOIN dbo.Estudiantes e ON ABS(e.MatrículaNo) = ABS(vu.MatriculaNo)
            WHERE (e.MatrículaNo IS NULL OR e.Estado IS NULL OR e.Estado != 'Retirado')
              AND (
                  NOT EXISTS (SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = @recursoId)
                  OR EXISTS (
                      SELECT 1
                      FROM Virtual.RecursosEstudiantes re
                      WHERE re.RecursoID = @recursoId
                        AND ABS(re.MatriculaNo) = ABS(vu.MatriculaNo)
                  )
              )
            ORDER BY vu.FechaVista DESC, nombreCompleto ASC;
        `);
    return result.recordset;
};
exports.findVistasByRecursoId = findVistasByRecursoId;
// ... OTROS RECURSOS ESPECÍFICOS ...
const getImagenBinaryByRecursoId = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const rs = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
        SELECT MimeType, ByteLength, Data
        FROM Virtual.RecursosImagenes
        WHERE RecursoID = @recursoId;
        `);
    if (!rs.recordset.length)
        return null;
    const row = rs.recordset[0];
    return { buffer: row.Data, mimeType: row.MimeType, byteLength: row.Data?.length || 0 };
};
exports.getImagenBinaryByRecursoId = getImagenBinaryByRecursoId;
const findAdjuntoTareaById = async (archivoId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('archivoId', mssql_1.default.Int, archivoId)
        .query(`
            SELECT at.ArchivoData, at.ArchivoMimeType, at.NombreOriginal, t.RecursoID
            FROM Virtual.ArchivosTarea at
            INNER JOIN Virtual.Tareas t ON t.TareaID = at.TareaID
            WHERE at.ArchivoTareaID = @archivoId
        `);
    return result.recordset[0];
};
exports.findAdjuntoTareaById = findAdjuntoTareaById;
const findAdjuntoForoById = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query('SELECT AdjuntoData, AdjuntoMimeType FROM Virtual.Foros WHERE RecursoID = @recursoId');
    return result.recordset[0];
};
exports.findAdjuntoForoById = findAdjuntoForoById;
const findRecursoArchivoDataById = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query('SELECT ArchivoData, ArchivoMimeType FROM Virtual.Recursos WHERE RecursoID = @recursoId');
    return result.recordset[0];
};
exports.findRecursoArchivoDataById = findRecursoArchivoDataById;
const createRecursoPrueba = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const orderRequest = new mssql_1.default.Request(transaction);
        const maxOrderResult = await orderRequest
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        const resourceRequest = new mssql_1.default.Request(transaction);
        const recursoResult = await resourceRequest
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Prueba')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaCreacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion || new Date()))
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, 1);
            `);
        const newRecursoId = recursoResult.recordset[0].RecursoID;
        const pruebaRequest = new mssql_1.default.Request(transaction);
        const fechaInicio = data.fechaInicio ? new Date(data.fechaInicio) : new Date();
        let fechaCierre;
        if (data.fechaCierre) {
            fechaCierre = new Date(data.fechaCierre);
            if (fechaCierre.getTime() <= fechaInicio.getTime()) {
                fechaCierre = new Date(fechaInicio.getTime() + 60 * 60 * 1000);
            }
        }
        else {
            fechaCierre = new Date(fechaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
        const pruebaResult = await pruebaRequest
            .input('recursoId', mssql_1.default.Int, newRecursoId)
            .input('tipoPrueba', mssql_1.default.NVarChar(50), data.tipoPrueba)
            .input('tipoExamen', mssql_1.default.NVarChar(50), data.tipoExamen)
            .input('duracionMinutos', mssql_1.default.SmallInt, data.duracionMinutos)
            .input('contrasena', mssql_1.default.NVarChar(50), data.contrasena || null)
            .input('modoRevision', mssql_1.default.NVarChar(50), data.modoRevision)
            .input('numeroIntentos', mssql_1.default.SmallInt, data.numeroIntentos)
            .input('fechaInicio', mssql_1.default.DateTime, fechaInicio)
            .input('fechaCierre', mssql_1.default.DateTime, fechaCierre)
            .query(`
                INSERT INTO Virtual.Pruebas 
                (RecursoID, TipoPrueba, TipoExamen, DuracionMinutos, Contrasena, ModoRevision, NumeroIntentos, FechaInicio, FechaCierre, Publicado, Finalizada)
                OUTPUT INSERTED.PruebaID
                VALUES 
                (@recursoId, @tipoPrueba, @tipoExamen, @duracionMinutos, @contrasena, @modoRevision, @numeroIntentos, @fechaInicio, @fechaCierre, 0, 0);
            `);
        const newPruebaId = pruebaResult.recordset[0].PruebaID;
        if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const studentId of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, studentId);
            }
            await new mssql_1.default.Request(transaction).bulk(studentTable);
        }
        await transaction.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Pruebas', `Creó una nueva prueba titulada: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'PREUBA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'PREUBA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
        return { newPruebaId, newRecursoId };
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.createRecursoPrueba = createRecursoPrueba;
const createRecursoVideoconferencia = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const orderReq = new mssql_1.default.Request(transaction);
        const maxOrderResult = await orderReq
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        const newOrder = (maxOrderResult.recordset[0]?.maxOrden || 0) + 1;
        const proveedor = data.modo === 'jitsi' ? 'Jitsi' : 'Externo';
        const urlSala = data.modo === 'jitsi'
            ? `https://meet.jit.si/${slugify(data.titulo)}-${Math.random().toString(36).slice(2, 8)}`
            : (data.urlExterna || '');
        const recursoReq = new mssql_1.default.Request(transaction);
        const recursoRes = await recursoReq
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipoRecurso', mssql_1.default.NVarChar(200), 'Videoconferencia')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrder)
            .input('fechaCreacion', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .input('urlExterna', mssql_1.default.NVarChar(500), urlSala)
            .query(`
                INSERT INTO Virtual.Recursos
                (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, UrlExterna, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipoRecurso, @titulo, @contenido, @orden, @fechaCreacion, @urlExterna, 1);
            `);
        const newRecursoId = recursoRes.recordset[0].RecursoID;
        await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, newRecursoId)
            .input('prov', mssql_1.default.NVarChar(50), proveedor)
            .input('url', mssql_1.default.NVarChar(500), urlSala)
            .input('ini', mssql_1.default.DateTime2, new Date(data.fechaPublicacion))
            .input('fin', mssql_1.default.DateTime2, data.fechaCierre ? new Date(data.fechaCierre) : null)
            .query(`
                INSERT INTO Virtual.Videoconferencias
                (RecursoID, Proveedor, UrlSala, FechaInicio, FechaCierre)
                VALUES (@recursoId, @prov, @url, @ini, @fin);
            `);
        if (data.esPersonalizado && data.estudiantesIds?.length > 0) {
            const studentTable = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            studentTable.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            studentTable.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            for (const id of data.estudiantesIds) {
                studentTable.rows.add(newRecursoId, id);
            }
            await new mssql_1.default.Request(transaction).bulk(studentTable);
        }
        await transaction.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Videoconferencias', `Creó una videoconferencia: "${data.titulo}" (${proveedor})`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'VIDEOCONFERENCIA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'VIDEOCONFERENCIA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
        return { newRecursoId };
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.createRecursoVideoconferencia = createRecursoVideoconferencia;
const createRecursoVideo = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const r1 = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query(`SELECT ISNULL(MAX(Orden),0) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID=@apartadoId`);
        const newOrden = Number(r1.recordset[0].maxOrden) + 1;
        const r2 = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipo', mssql_1.default.NVarChar(200), 'Video')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrden)
            .input('fecha', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .input('url', mssql_1.default.NVarChar(500), data.urlVideo)
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, UrlExterna, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, @url, 1);
            `);
        const newRecursoId = r2.recordset[0].RecursoID;
        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            t.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new mssql_1.default.Request(tx).bulk(t);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Videos', `Creó un video: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'VIDEO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'VIDEO', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
        return { newRecursoId };
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.createRecursoVideo = createRecursoVideo;
const createRecursoCarpeta = async (data, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const r1 = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .query(`SELECT ISNULL(MAX(Orden),0) AS maxOrden FROM Virtual.Recursos WHERE ApartadoID=@apartadoId`);
        const newOrden = Number(r1.recordset[0].maxOrden) + 1;
        const r2 = await new mssql_1.default.Request(tx)
            .input('apartadoId', mssql_1.default.Int, data.apartadoId)
            .input('tipo', mssql_1.default.NVarChar(200), 'Carpeta')
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .input('orden', mssql_1.default.Int, newOrden)
            .input('fecha', mssql_1.default.DateTime, new Date(data.fechaPublicacion))
            .query(`
                INSERT INTO Virtual.Recursos (ApartadoID, TipoRecurso, Titulo, Contenido, Orden, FechaCreacion, Visible)
                OUTPUT INSERTED.RecursoID
                VALUES (@apartadoId, @tipo, @titulo, @contenido, @orden, @fecha, 1);
            `);
        const newRecursoId = r2.recordset[0].RecursoID;
        if (data.esPersonalizado && data.estudiantesIds?.length) {
            const t = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', mssql_1.default.Int, { nullable: false });
            t.columns.add('MatriculaNo', mssql_1.default.Int, { nullable: false });
            data.estudiantesIds.forEach(id => t.rows.add(newRecursoId, id));
            await new mssql_1.default.Request(tx).bulk(t);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Creó la carpeta: "${data.titulo}"`);
            if (data.whatsappTarget && data.whatsappTarget !== 'NONE') {
                // 💡 Enrutador de Notificaciones
                if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
                    console.log(`[Ruteador] Anuncio Personalizado. Redirigiendo a ${data.estudiantesIds.length} estudiantes VIP.`);
                    notificacionService.notificarEstudiantesEspecificos(data.estudiantesIds, newRecursoId, 'CARPETA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
                else {
                    console.log(`[Ruteador] Anuncio Global de Curso. Disparando masivo.`);
                    notificacionService.notificarEstudiantesDeCurso(data.apartadoId, newRecursoId, 'CARPETA', data.titulo, actor, data.whatsappTarget).catch(console.error);
                }
            }
        }
        return { newRecursoId };
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.createRecursoCarpeta = createRecursoCarpeta;
const createSubCarpeta = async (recursoId, nombre, carpetaPadreId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        let checkQuery = `SELECT 1 FROM Virtual.SubCarpetas WHERE RecursoID = @recursoId AND Nombre = @nombre`;
        checkQuery += carpetaPadreId ? ` AND CarpetaPadreID = @padreId` : ` AND CarpetaPadreID IS NULL`;
        const checkReq = new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .input('nombre', mssql_1.default.NVarChar(255), nombre);
        if (carpetaPadreId)
            checkReq.input('padreId', mssql_1.default.Int, carpetaPadreId);
        const exists = await checkReq.query(checkQuery);
        if (exists.recordset.length > 0) {
            throw new Error(`Ya existe una carpeta llamada "${nombre}" en esta ubicación.`);
        }
        if (carpetaPadreId) {
            const parentCheck = await new mssql_1.default.Request(tx)
                .input('padreId', mssql_1.default.Int, carpetaPadreId)
                .query('SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @padreId');
            if (parentCheck.recordset.length === 0)
                throw new Error("La carpeta padre no existe.");
            if (parentCheck.recordset[0].RecursoID !== recursoId)
                throw new Error("Incoherencia de datos: La carpeta padre no pertenece a este recurso.");
        }
        const request = new mssql_1.default.Request(tx)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .input('nombre', mssql_1.default.NVarChar(255), nombre)
            .input('padreId', mssql_1.default.Int, carpetaPadreId);
        await request.query(`
            INSERT INTO Virtual.SubCarpetas (RecursoID, Nombre, CarpetaPadreID, FechaCreacion)
            VALUES (@recursoId, @nombre, @padreId, GETDATE());
        `);
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Creó subcarpeta "${nombre}" en recurso ${recursoId}`);
        }
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.createSubCarpeta = createSubCarpeta;
const createEnlaceCarpeta = async (recursoId, subCarpetaId, titulo, url, actor) => {
    const pool = await dbPool_1.poolPromise;
    if (!url.startsWith('http')) {
        throw new Error("La URL debe comenzar con http:// o https://");
    }
    await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .input('subCarpetaId', mssql_1.default.Int, subCarpetaId)
        .input('titulo', mssql_1.default.NVarChar(255), titulo)
        .input('url', mssql_1.default.NVarChar(2048), url)
        .query(`
            INSERT INTO Virtual.EnlacesCarpeta (RecursoID, SubCarpetaID, Titulo, Url, FechaCreacion)
            VALUES (@recursoId, @subCarpetaId, @titulo, @url, GETUTCDATE());
        `);
    if (actor) {
        await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Agregó enlace "${titulo}" en carpeta.`);
    }
};
exports.createEnlaceCarpeta = createEnlaceCarpeta;
const listArchivosCarpeta = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const rs = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
        SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoMimeType, TamanoKB, FechaSubida
        FROM Virtual.ArchivosCarpeta
        WHERE RecursoID = @recursoId
        ORDER BY FechaSubida DESC, ArchivoCarpetaID DESC;
        `);
    return rs.recordset;
};
exports.listArchivosCarpeta = listArchivosCarpeta;
const getArchivoCarpetaById = async (archivoCarpetaId) => {
    const pool = await dbPool_1.poolPromise;
    const rs = await pool.request()
        .input('id', mssql_1.default.Int, archivoCarpetaId)
        .query(`
        SELECT ArchivoCarpetaID, RecursoID, NombreOriginal, ArchivoData, ArchivoMimeType, TamanoKB, FechaSubida
        FROM Virtual.ArchivosCarpeta
        WHERE ArchivoCarpetaID = @id;
        `);
    return rs.recordset[0] || null;
};
exports.getArchivoCarpetaById = getArchivoCarpetaById;
const getContenidoCarpeta = async (recursoId, carpetaPadreId) => {
    const pool = await dbPool_1.poolPromise;
    if (!recursoId)
        throw new Error("RecursoID es requerido");
    const request = pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .input('padreId', mssql_1.default.Int, carpetaPadreId);
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
        pool.request().input('recursoId', mssql_1.default.Int, recursoId).input('padreId', mssql_1.default.Int, carpetaPadreId).query(queryArchivos),
        pool.request().input('recursoId', mssql_1.default.Int, recursoId).input('padreId', mssql_1.default.Int, carpetaPadreId).query(qEnlaces)
    ]);
    return {
        carpetas: resCarpetas.recordset,
        archivos: resArchivos.recordset,
        enlaces: resEnlaces.recordset
    };
};
exports.getContenidoCarpeta = getContenidoCarpeta;
const deleteArchivoCarpeta = async (archivoCarpetaId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const rs = await new mssql_1.default.Request(tx)
            .input('id', mssql_1.default.Int, archivoCarpetaId)
            .query(`
                SELECT TOP 1 ac.ArchivoCarpetaID, ac.RecursoID, ac.NombreOriginal, r.Titulo
                FROM Virtual.ArchivosCarpeta ac
                INNER JOIN Virtual.Recursos r ON r.RecursoID = ac.RecursoID
                WHERE ac.ArchivoCarpetaID = @id;
            `);
        if (!rs.recordset.length) {
            throw new Error('Archivo no encontrado');
        }
        const row = rs.recordset[0];
        await new mssql_1.default.Request(tx)
            .input('id', mssql_1.default.Int, archivoCarpetaId)
            .query(`DELETE FROM Virtual.ArchivosCarpeta WHERE ArchivoCarpetaID = @id;`);
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Eliminó archivo "${row.NombreOriginal}" de la carpeta "${row.Titulo}"`);
        }
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.deleteArchivoCarpeta = deleteArchivoCarpeta;
const deleteSubCarpeta = async (subCarpetaId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const info = await new mssql_1.default.Request(tx)
            .input('id', mssql_1.default.Int, subCarpetaId)
            .query("SELECT Nombre FROM Virtual.SubCarpetas WHERE SubCarpetaID = @id");
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
        const treeResult = await new mssql_1.default.Request(tx)
            .input('targetId', mssql_1.default.Int, subCarpetaId)
            .query(recursiveQuery);
        const idsToDelete = treeResult.recordset.map(r => r.SubCarpetaID);
        if (idsToDelete.length > 0) {
            const idsCsv = idsToDelete.join(',');
            await new mssql_1.default.Request(tx).query(`
                DELETE FROM Virtual.ArchivosCarpeta 
                WHERE SubCarpetaID IN (${idsCsv})
            `);
            await new mssql_1.default.Request(tx).query(`DELETE FROM Virtual.EnlacesCarpeta WHERE SubCarpetaID IN (${idsCsv})`);
            await new mssql_1.default.Request(tx).query(`
                DELETE FROM Virtual.SubCarpetas 
                WHERE SubCarpetaID IN (${idsCsv})
            `);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Eliminó subcarpeta "${nombreCarpeta}" y su contenido.`);
        }
    }
    catch (e) {
        await tx.rollback();
        if ((0, errors_1.isSqlErrorLike)(e) && e.number === 547) {
            throw new Error("No se pudo eliminar la carpeta debido a restricciones de integridad.");
        }
        throw e;
    }
};
exports.deleteSubCarpeta = deleteSubCarpeta;
const deleteEnlaceCarpeta = async (enlaceId, actor) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('id', mssql_1.default.Int, enlaceId)
        .query('DELETE FROM Virtual.EnlacesCarpeta WHERE EnlaceID = @id');
    if (actor)
        await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Carpetas', `Eliminó un enlace de carpeta.`);
};
exports.deleteEnlaceCarpeta = deleteEnlaceCarpeta;
const moverElementoCarpeta = async (recursoId, tipo, itemId, targetFolderId, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        if (targetFolderId !== null) {
            const checkFolder = await new mssql_1.default.Request(tx)
                .input('fid', mssql_1.default.Int, targetFolderId)
                .query('SELECT RecursoID FROM Virtual.SubCarpetas WHERE SubCarpetaID = @fid');
            if (checkFolder.recordset.length === 0)
                throw new Error("La carpeta destino no existe.");
            if (checkFolder.recordset[0].RecursoID !== recursoId)
                throw new Error("No puedes mover elementos a una carpeta de otro recurso.");
        }
        const request = new mssql_1.default.Request(tx)
            .input('itemId', mssql_1.default.Int, itemId)
            .input('targetId', mssql_1.default.Int, targetFolderId);
        if (tipo === 'archivo') {
            await request.query(`
                UPDATE Virtual.ArchivosCarpeta 
                SET SubCarpetaID = @targetId 
                WHERE ArchivoCarpetaID = @itemId
            `);
        }
        else {
            await request.query(`
                UPDATE Virtual.EnlacesCarpeta 
                SET SubCarpetaID = @targetId 
                WHERE EnlaceID = @itemId
            `);
        }
        await tx.commit();
        if (actor) {
            await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Aula Virtual', 'Gestión de Carpetas', `Movió un ${tipo} a la carpeta ID ${targetFolderId ?? 'Raíz'}`);
        }
    }
    catch (e) {
        await tx.rollback();
        throw e;
    }
};
exports.moverElementoCarpeta = moverElementoCarpeta;

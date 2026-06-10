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
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveItemInFolder = exports.deleteLinkInFolder = exports.deleteSubFolder = exports.deleteArchivoCarpeta = exports.getContenidoCarpeta = exports.getArchivosCarpeta = exports.createLinkInFolder = exports.createSubFolder = exports.createCarpeta = exports.createVideo = exports.createVideoconferencia = exports.addRecursoPrueba = exports.downloadArchivoCarpeta = exports.streamImagen = exports.getRecursoArchivoData = exports.getAdjuntoForo = exports.getAdjuntoTarea = exports.uploadArchivosCarpeta = exports.createImagenFromUrl = exports.createImagenFromFile = exports.addRecursoForo = exports.addRecursoArchivo = exports.addRecursoTarea = exports.getVistasRecurso = exports.registrarVistaRecurso = exports.cloneRecurso = exports.deleteRecurso = exports.toggleRecursoVisibility = exports.updateRecurso = exports.getRecursoById = exports.addRecursoAnuncio = exports.addRecursoUrl = void 0;
const recursoService = __importStar(require("../services/recurso.service"));
const asyncHandler_1 = require("../utils/asyncHandler");
// Helper para extraer el actor de forma segura sin usar 'any'
const getActor = (req) => {
    return req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;
};
// Helper para parsear IDs opcionales de forma segura
const parseOptionalId = (val) => {
    if (val === 'null' || val === 'undefined' || val === null || val === undefined || val === '')
        return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
};
const validarAccesoEstudiante = async (req, res, recursoId) => {
    if (req.user?.perfil !== 'Estudiante')
        return true;
    const puedeAcceder = await recursoService.estudiantePuedeAccederRecurso(recursoId, Number(req.user.codigo));
    if (!puedeAcceder) {
        res.status(404).json({ message: 'Recurso no encontrado.' });
        return false;
    }
    return true;
};
exports.addRecursoUrl = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await recursoService.createRecursoUrl(req.body, getActor(req));
    res.status(201).json({ message: 'Recurso URL creado con éxito.' });
});
exports.addRecursoAnuncio = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await recursoService.createRecursoAnuncio(req.body, getActor(req));
    res.status(201).json({ message: 'Anuncio creado con éxito.' });
});
exports.getRecursoById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const recurso = await recursoService.findRecursoById(id);
    if (!(await validarAccesoEstudiante(req, res, id)))
        return;
    res.status(200).json(recurso);
});
exports.updateRecurso = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    await recursoService.updateRecursoById(recursoId, req.body, getActor(req));
    res.status(200).json({ message: 'Recurso actualizado con éxito.' });
});
exports.toggleRecursoVisibility = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    const { nuevoEstado } = await recursoService.toggleRecursoVisibilityById(recursoId, getActor(req));
    res.status(200).json({ message: `Visibilidad del recurso cambiada.`, data: { nuevoEstado } });
});
exports.deleteRecurso = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    await recursoService.deleteRecursoById(recursoId, getActor(req));
    res.status(200).json({ message: 'Recurso eliminado con éxito.' });
});
exports.cloneRecurso = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    await recursoService.cloneRecursoById(recursoId, getActor(req));
    res.status(201).json({ message: 'Recurso clonado con éxito.' });
});
exports.registrarVistaRecurso = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    const matriculaNo = req.user?.codigo;
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    if (matriculaNo) {
        await recursoService.registrarVista(recursoId, matriculaNo);
    }
    res.sendStatus(204);
});
exports.getVistasRecurso = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    if (!Number.isFinite(recursoId)) {
        return res.status(400).json({ message: 'ID de recurso inválido.' });
    }
    const vistas = await recursoService.findVistasByRecursoId(recursoId);
    res.status(200).json(vistas);
});
// ==========================================
// MÉTODOS MULTIPART (Archivos subidos a Disco)
// ==========================================
exports.addRecursoTarea = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.body.jsonData) {
        throw new Error('Faltan los datos de la tarea (jsonData).');
    }
    const tareaData = JSON.parse(req.body.jsonData);
    const archivosArray = req.files || [];
    // Pasamos los archivos (que ahora tienen la propiedad .path apuntando al disco)
    await recursoService.createRecursoTarea(tareaData, archivosArray, getActor(req));
    res.status(201).json({ message: 'Tarea creada con éxito.' });
});
exports.addRecursoArchivo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        throw new Error('No se ha adjuntado ningún archivo.');
    }
    const archivoData = JSON.parse(req.body.jsonData);
    await recursoService.createRecursoArchivo(archivoData, req.file, getActor(req));
    res.status(201).json({ message: 'Archivo creado con éxito.' });
});
exports.addRecursoForo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.body.jsonData) {
        throw new Error('Faltan los datos del foro (jsonData).');
    }
    const foroData = JSON.parse(req.body.jsonData);
    // req.file puede ser undefined si el foro no requiere archivo
    await recursoService.createRecursoForo(foroData, req.file, getActor(req));
    res.status(201).json({ message: 'Foro creado con éxito.' });
});
exports.createImagenFromFile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw new Error('No se recibió archivo.');
    const body = req.body.jsonData ? JSON.parse(req.body.jsonData) : {};
    const { titulo, contenido, apartadoId, fechaPublicacion, esPersonalizado, estudiantesIds, whatsappTarget } = body;
    if (!apartadoId || !titulo) {
        throw new Error('Faltan datos (apartadoId, titulo).');
    }
    await recursoService.createRecursoImagen({
        apartadoId: Number(apartadoId),
        titulo: String(titulo),
        contenido: String(contenido ?? ''),
        fechaPublicacion: fechaPublicacion ? new Date(fechaPublicacion) : new Date(),
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        path: req.file.path, // Usamos la RUTA DEL DISCO, no el buffer
        esPersonalizado: Boolean(esPersonalizado),
        estudiantesIds: Array.isArray(estudiantesIds) ? estudiantesIds.map(Number) : [],
        whatsappTarget: whatsappTarget
    }, getActor(req));
    res.status(201).json({ message: 'Imagen guardada en base de datos correctamente.' });
});
exports.createImagenFromUrl = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { titulo, contenido, apartadoId, fechaPublicacion, esPersonalizado, estudiantesIds, imageUrl, whatsappTarget } = req.body || {};
    await recursoService.createRecursoImagenExterna({
        apartadoId: Number(apartadoId),
        titulo: String(titulo),
        contenido: String(contenido ?? ''),
        fechaPublicacion: fechaPublicacion ? new Date(fechaPublicacion) : new Date(),
        url: imageUrl,
        esPersonalizado: Boolean(esPersonalizado),
        estudiantesIds: Array.isArray(estudiantesIds) ? estudiantesIds.map(Number) : [],
        whatsappTarget
    }, getActor(req));
    res.status(201).json({ message: 'Imagen vinculada exitosamente.' });
});
exports.uploadArchivosCarpeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId))
        throw new Error('recursoId inválido');
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const folderId = parseOptionalId(req.body.folderId);
    const archivos = req.files || [];
    if (archivos.length === 0)
        throw new Error('No se han adjuntado archivos.');
    await recursoService.addArchivosToCarpeta(recursoId, archivos, folderId, getActor(req));
    res.status(201).json({ message: 'Archivos agregados a la carpeta' });
});
// ==========================================
// DESCARGA Y STREAMING
// ==========================================
exports.getAdjuntoTarea = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const archivoId = Number(req.params.archivoId);
    if (isNaN(archivoId))
        throw new Error('ID inválido');
    const archivo = await recursoService.findAdjuntoTareaById(archivoId);
    if (!archivo || !archivo.ArchivoData) {
        return res.status(404).json({ message: 'Archivo no encontrado.' });
    }
    if (!(await validarAccesoEstudiante(req, res, archivo.RecursoID)))
        return;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', archivo.ArchivoMimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.NombreOriginal || 'archivo')}"`);
    res.end(archivo.ArchivoData);
});
exports.getAdjuntoForo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const archivo = await recursoService.findAdjuntoForoById(recursoId);
    if (!archivo || !archivo.AdjuntoData) {
        return res.status(404).json({ message: 'Archivo adjunto del foro no encontrado.' });
    }
    res.setHeader('Content-Type', archivo.AdjuntoMimeType);
    res.send(archivo.AdjuntoData);
});
exports.getRecursoArchivoData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const archivo = await recursoService.findRecursoArchivoDataById(recursoId);
    if (!archivo || !archivo.ArchivoData) {
        return res.status(404).json({ message: 'Recurso de archivo no encontrado.' });
    }
    res.setHeader('Content-Type', archivo.ArchivoMimeType);
    res.send(archivo.ArchivoData);
});
exports.streamImagen = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId))
        throw new Error('recursoId inválido');
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const item = await recursoService.getImagenBinaryByRecursoId(recursoId);
    if (!item || !item.buffer) {
        return res.status(404).send('Imagen no encontrada o es externa.');
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Content-Length', item.byteLength);
    res.send(item.buffer);
});
exports.downloadArchivoCarpeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isFinite(archivoId))
        throw new Error('archivoId inválido');
    const row = await recursoService.getArchivoCarpetaById(archivoId);
    if (!row || !row.ArchivoData) {
        return res.status(404).send('El archivo no existe o no tiene contenido.');
    }
    if (!(await validarAccesoEstudiante(req, res, row.RecursoID)))
        return;
    res.setHeader('Content-Type', row.ArchivoMimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.NombreOriginal)}"`);
    res.setHeader('Content-Length', row.ArchivoData.length);
    res.end(row.ArchivoData);
});
// ==========================================
// OTROS TIPOS DE RECURSOS Y CARPETAS
// ==========================================
exports.addRecursoPrueba = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await recursoService.createRecursoPrueba(req.body, getActor(req));
    res.status(201).json({ message: 'Prueba creada con éxito.', data });
});
exports.createVideoconferencia = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const payload = {
        titulo: req.body.titulo,
        contenido: req.body.contenido,
        apartadoId: Number(req.body.apartadoId),
        fechaPublicacion: new Date(req.body.fechaPublicacion),
        fechaCierre: req.body.fechaCierre ? new Date(req.body.fechaCierre) : null,
        esPersonalizado: !!req.body.esPersonalizado,
        estudiantesIds: Array.isArray(req.body.estudiantesIds) ? req.body.estudiantesIds.map(Number) : [],
        modo: req.body.modo,
        urlExterna: req.body.urlExterna ?? null,
        whatsappTarget: req.body.whatsappTarget
    };
    const { newRecursoId } = await recursoService.createRecursoVideoconferencia(payload, getActor(req));
    res.status(201).json({ newRecursoId });
});
exports.createVideo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const payload = {
        titulo: req.body.titulo,
        urlVideo: req.body.urlVideo,
        contenido: req.body.contenido ?? '',
        apartadoId: Number(req.body.apartadoId),
        fechaPublicacion: new Date(req.body.fechaPublicacion),
        esPersonalizado: !!req.body.esPersonalizado,
        estudiantesIds: Array.isArray(req.body.estudiantesIds) ? req.body.estudiantesIds.map(Number) : [],
        whatsappTarget: req.body.whatsappTarget
    };
    if (!payload.urlVideo)
        throw new Error('La URL del video es requerida.');
    const { newRecursoId } = await recursoService.createRecursoVideo(payload, getActor(req));
    res.status(201).json({ newRecursoId });
});
exports.createCarpeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const payload = {
        apartadoId: Number(req.body.apartadoId),
        titulo: String(req.body.titulo || ''),
        contenido: String(req.body.contenido || ''),
        fechaPublicacion: req.body.fechaPublicacion ? new Date(req.body.fechaPublicacion) : new Date(),
        esPersonalizado: !!req.body.esPersonalizado,
        estudiantesIds: Array.isArray(req.body.estudiantesIds) ? req.body.estudiantesIds.map(Number) : [],
        whatsappTarget: req.body.whatsappTarget
    };
    if (!payload.apartadoId || !payload.titulo)
        throw new Error('Faltan datos requeridos (apartadoId, titulo).');
    const { newRecursoId } = await recursoService.createRecursoCarpeta(payload, getActor(req));
    res.status(201).json({ newRecursoId });
});
exports.createSubFolder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (isNaN(recursoId))
        throw new Error("ID de recurso inválido");
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const { nombre, parentId } = req.body;
    if (!nombre || typeof nombre !== 'string' || !nombre.trim())
        throw new Error("El nombre de la carpeta es obligatorio.");
    await recursoService.createSubCarpeta(recursoId, nombre.trim(), parseOptionalId(parentId), getActor(req));
    res.status(201).json({ message: 'Carpeta creada exitosamente.' });
});
exports.createLinkInFolder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const folderId = parseOptionalId(req.body.folderId);
    const { titulo, url } = req.body;
    if (!titulo || !url)
        throw new Error("Título y URL son requeridos.");
    await recursoService.createEnlaceCarpeta(recursoId, folderId, titulo, url, getActor(req));
    res.status(201).json({ message: 'Enlace creado.' });
});
exports.getArchivosCarpeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId))
        throw new Error('recursoId inválido');
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const rows = await recursoService.listArchivosCarpeta(recursoId);
    res.json(rows);
});
exports.getContenidoCarpeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (isNaN(recursoId))
        throw new Error("ID de recurso inválido");
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const folderId = parseOptionalId(req.query.folderId);
    const contenido = await recursoService.getContenidoCarpeta(recursoId, folderId);
    res.json(contenido);
});
exports.deleteArchivoCarpeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isFinite(archivoId))
        throw new Error('archivoId inválido');
    await recursoService.deleteArchivoCarpeta(archivoId, getActor(req));
    res.status(204).send();
});
exports.deleteSubFolder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const folderId = Number(req.params.folderId);
    if (isNaN(folderId))
        throw new Error("ID de carpeta inválido");
    await recursoService.deleteSubCarpeta(folderId, getActor(req));
    res.status(204).send();
});
exports.deleteLinkInFolder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const enlaceId = Number(req.params.enlaceId);
    await recursoService.deleteEnlaceCarpeta(enlaceId, getActor(req));
    res.status(204).send();
});
exports.moveItemInFolder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.recursoId);
    if (!(await validarAccesoEstudiante(req, res, recursoId)))
        return;
    const { tipo, itemId, targetFolderId } = req.body;
    if (!['archivo', 'enlace'].includes(tipo))
        throw new Error("Tipo inválido");
    await recursoService.moverElementoCarpeta(recursoId, tipo, itemId, parseOptionalId(targetFolderId), getActor(req));
    res.status(200).json({ message: 'Elemento movido exitosamente.' });
});

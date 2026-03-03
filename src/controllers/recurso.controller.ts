// src/controllers/recurso.controller.ts
import { Request, Response } from 'express';
import { UserActor } from '../services/recurso.service';
import * as recursoService from '../services/recurso.service';
import { asyncHandler } from '../utils/asyncHandler';

// Helper para extraer el actor de forma segura sin usar 'any'
const getActor = (req: Request): UserActor | undefined => {
    return req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;
};

// Helper para parsear IDs opcionales de forma segura
const parseOptionalId = (val: unknown): number | null => {
    if (val === 'null' || val === 'undefined' || val === null || val === undefined || val === '') return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
};

export const addRecursoUrl = asyncHandler(async (req: Request, res: Response) => {
    await recursoService.createRecursoUrl(req.body, getActor(req));
    res.status(201).json({ message: 'Recurso URL creado con éxito.' });
});

export const addRecursoAnuncio = asyncHandler(async (req: Request, res: Response) => {
    await recursoService.createRecursoAnuncio(req.body, getActor(req));
    res.status(201).json({ message: 'Anuncio creado con éxito.' });
});

export const getRecursoById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const recurso = await recursoService.findRecursoById(id);
    res.status(200).json(recurso);
});

export const updateRecurso = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.id);
    await recursoService.updateRecursoById(recursoId, req.body, getActor(req));
    res.status(200).json({ message: 'Recurso actualizado con éxito.' });
});

export const toggleRecursoVisibility = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.id);
    const { nuevoEstado } = await recursoService.toggleRecursoVisibilityById(recursoId, getActor(req));
    res.status(200).json({ message: `Visibilidad del recurso cambiada.`, data: { nuevoEstado } });
});

export const deleteRecurso = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.id);
    await recursoService.deleteRecursoById(recursoId, getActor(req));
    res.status(200).json({ message: 'Recurso eliminado con éxito.' });
});

export const cloneRecurso = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.id);
    await recursoService.cloneRecursoById(recursoId, getActor(req));
    res.status(201).json({ message: 'Recurso clonado con éxito.' });
});

export const registrarVistaRecurso = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.id);
    const matriculaNo = req.user?.codigo; 
    if (matriculaNo) {
        await recursoService.registrarVista(recursoId, matriculaNo);
    }
    res.sendStatus(204); 
});

// ==========================================
// MÉTODOS MULTIPART (Archivos subidos a Disco)
// ==========================================

export const addRecursoTarea = asyncHandler(async (req: Request, res: Response) => {
    if (!req.body.jsonData) {
        throw new Error('Faltan los datos de la tarea (jsonData).');
    }
    const tareaData = JSON.parse(req.body.jsonData);
    const archivosArray = req.files as Express.Multer.File[] || [];

    // Pasamos los archivos (que ahora tienen la propiedad .path apuntando al disco)
    await recursoService.createRecursoTarea(tareaData, archivosArray, getActor(req));
    res.status(201).json({ message: 'Tarea creada con éxito.' });
});

export const addRecursoArchivo = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new Error('No se ha adjuntado ningún archivo.');
    }
    const archivoData = JSON.parse(req.body.jsonData);

    await recursoService.createRecursoArchivo(archivoData, req.file, getActor(req));
    res.status(201).json({ message: 'Archivo creado con éxito.' });
});

export const addRecursoForo = asyncHandler(async (req: Request, res: Response) => {
    if (!req.body.jsonData) {
        throw new Error('Faltan los datos del foro (jsonData).');
    }
    const foroData = JSON.parse(req.body.jsonData);
    
    // req.file puede ser undefined si el foro no requiere archivo
    await recursoService.createRecursoForo(foroData, req.file, getActor(req));
    res.status(201).json({ message: 'Foro creado con éxito.' });
});

export const createImagenFromFile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new Error('No se recibió archivo.');
    
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

export const createImagenFromUrl = asyncHandler(async (req: Request, res: Response) => {
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

export const uploadArchivosCarpeta = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) throw new Error('recursoId inválido');

    const folderId = parseOptionalId(req.body.folderId);
    const archivos = req.files as Express.Multer.File[] || [];
    
    if (archivos.length === 0) throw new Error('No se han adjuntado archivos.');

    await recursoService.addArchivosToCarpeta(recursoId, archivos, folderId, getActor(req));
    res.status(201).json({ message: 'Archivos agregados a la carpeta' });
});


// ==========================================
// DESCARGA Y STREAMING
// ==========================================

export const getAdjuntoTarea = asyncHandler(async (req: Request, res: Response) => {
    const archivoId = Number(req.params.archivoId);
    if (isNaN(archivoId)) throw new Error('ID inválido');

    const archivo = await recursoService.findAdjuntoTareaById(archivoId);

    if (!archivo || !archivo.ArchivoData) {
        return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400'); 
    res.setHeader('Content-Type', archivo.ArchivoMimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.NombreOriginal || 'archivo')}"`);
    res.end(archivo.ArchivoData);
});

export const getAdjuntoForo = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    const archivo = await recursoService.findAdjuntoForoById(recursoId);

    if (!archivo || !archivo.AdjuntoData) {
        return res.status(404).json({ message: 'Archivo adjunto del foro no encontrado.' });
    }

    res.setHeader('Content-Type', archivo.AdjuntoMimeType);
    res.send(archivo.AdjuntoData);
});

export const getRecursoArchivoData = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    const archivo = await recursoService.findRecursoArchivoDataById(recursoId);

    if (!archivo || !archivo.ArchivoData) {
        return res.status(404).json({ message: 'Recurso de archivo no encontrado.' });
    }

    res.setHeader('Content-Type', archivo.ArchivoMimeType);
    res.send(archivo.ArchivoData);
});

export const streamImagen = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) throw new Error('recursoId inválido');

    const item = await recursoService.getImagenBinaryByRecursoId(recursoId);
    
    if (!item || !item.buffer) {
         return res.status(404).send('Imagen no encontrada o es externa.');
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Content-Length', item.byteLength);
    res.send(item.buffer);
});

export const downloadArchivoCarpeta = asyncHandler(async (req: Request, res: Response) => {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isFinite(archivoId)) throw new Error('archivoId inválido');

    const row = await recursoService.getArchivoCarpetaById(archivoId);
    
    if (!row || !row.ArchivoData) {
        return res.status(404).send('El archivo no existe o no tiene contenido.');
    }

    res.setHeader('Content-Type', row.ArchivoMimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.NombreOriginal)}"`);
    res.setHeader('Content-Length', row.ArchivoData.length);
    res.end(row.ArchivoData);
});

// ==========================================
// OTROS TIPOS DE RECURSOS Y CARPETAS
// ==========================================

export const addRecursoPrueba = asyncHandler(async (req: Request, res: Response) => {
    const data = await recursoService.createRecursoPrueba(req.body, getActor(req));
    res.status(201).json({ message: 'Prueba creada con éxito.', data });
});

export const createVideoconferencia = asyncHandler(async (req: Request, res: Response) => {
    const payload = {
        titulo: req.body.titulo,
        contenido: req.body.contenido,
        apartadoId: Number(req.body.apartadoId),
        fechaPublicacion: new Date(req.body.fechaPublicacion),
        fechaCierre: req.body.fechaCierre ? new Date(req.body.fechaCierre) : null,
        esPersonalizado: !!req.body.esPersonalizado,
        estudiantesIds: Array.isArray(req.body.estudiantesIds) ? req.body.estudiantesIds.map(Number) : [],
        modo: req.body.modo as 'jitsi' | 'externo',
        urlExterna: req.body.urlExterna ?? null,
        whatsappTarget: req.body.whatsappTarget
    };

    const { newRecursoId } = await recursoService.createRecursoVideoconferencia(payload, getActor(req));
    res.status(201).json({ newRecursoId });
});

export const createVideo = asyncHandler(async (req: Request, res: Response) => {
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

    if (!payload.urlVideo) throw new Error('La URL del video es requerida.');

    const { newRecursoId } = await recursoService.createRecursoVideo(payload, getActor(req));
    res.status(201).json({ newRecursoId });
});

export const createCarpeta = asyncHandler(async (req: Request, res: Response) => {
    const payload = {
        apartadoId: Number(req.body.apartadoId),
        titulo: String(req.body.titulo || ''),
        contenido: String(req.body.contenido || ''),
        fechaPublicacion: req.body.fechaPublicacion ? new Date(req.body.fechaPublicacion) : new Date(),
        esPersonalizado: !!req.body.esPersonalizado,
        estudiantesIds: Array.isArray(req.body.estudiantesIds) ? req.body.estudiantesIds.map(Number) : [],
        whatsappTarget: req.body.whatsappTarget
    };

    if (!payload.apartadoId || !payload.titulo) throw new Error('Faltan datos requeridos (apartadoId, titulo).');

    const { newRecursoId } = await recursoService.createRecursoCarpeta(payload, getActor(req));
    res.status(201).json({ newRecursoId });
});

export const createSubFolder = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (isNaN(recursoId)) throw new Error("ID de recurso inválido");

    const { nombre, parentId } = req.body;
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) throw new Error("El nombre de la carpeta es obligatorio.");

    await recursoService.createSubCarpeta(recursoId, nombre.trim(), parseOptionalId(parentId), getActor(req));
    res.status(201).json({ message: 'Carpeta creada exitosamente.' });
});

export const createLinkInFolder = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    const folderId = parseOptionalId(req.body.folderId);
    const { titulo, url } = req.body;

    if (!titulo || !url) throw new Error("Título y URL son requeridos.");

    await recursoService.createEnlaceCarpeta(recursoId, folderId, titulo, url, getActor(req));
    res.status(201).json({ message: 'Enlace creado.' });
});

export const getArchivosCarpeta = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) throw new Error('recursoId inválido');
    
    const rows = await recursoService.listArchivosCarpeta(recursoId);
    res.json(rows);
});

export const getContenidoCarpeta = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    if (isNaN(recursoId)) throw new Error("ID de recurso inválido");

    const folderId = parseOptionalId(req.query.folderId);
    const contenido = await recursoService.getContenidoCarpeta(recursoId, folderId);
    res.json(contenido);
});

export const deleteArchivoCarpeta = asyncHandler(async (req: Request, res: Response) => {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isFinite(archivoId)) throw new Error('archivoId inválido');

    await recursoService.deleteArchivoCarpeta(archivoId, getActor(req));
    res.status(204).send();
});

export const deleteSubFolder = asyncHandler(async (req: Request, res: Response) => {
    const folderId = Number(req.params.folderId);
    if (isNaN(folderId)) throw new Error("ID de carpeta inválido");

    await recursoService.deleteSubCarpeta(folderId, getActor(req));
    res.status(204).send();
});

export const deleteLinkInFolder = asyncHandler(async (req: Request, res: Response) => {
    const enlaceId = Number(req.params.enlaceId);
    await recursoService.deleteEnlaceCarpeta(enlaceId, getActor(req));
    res.status(204).send();
});

export const moveItemInFolder = asyncHandler(async (req: Request, res: Response) => {
    const recursoId = Number(req.params.recursoId);
    const { tipo, itemId, targetFolderId } = req.body;

    if (!['archivo', 'enlace'].includes(tipo)) throw new Error("Tipo inválido");

    await recursoService.moverElementoCarpeta(recursoId, tipo, itemId, parseOptionalId(targetFolderId), getActor(req));
    res.status(200).json({ message: 'Elemento movido exitosamente.' });
});


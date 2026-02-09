//src/controllers/recurso.controller.ts
import { Request, Response } from 'express';
import multer from 'multer';
import { UserActor } from '../services/recurso.service';
import * as recursoService from '../services/recurso.service';



const storage = multer.memoryStorage();

const limits = { fileSize: 5 * 1024 * 1024 };



// 2. Filtro solo para Imágenes
const allowedImages = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'
]);

// CONFIGURACIÓN A: SOLO IMÁGENES (Max 5MB, 1 archivo)
const uploadImagen = multer({
    storage,
    limits,
    fileFilter: (_req, file, cb) => {
        if (allowedImages.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato inválido. Solo se permiten imágenes (jpg, png, webp, gif).'));
        }
    }
}).single('archivo');

// Usado para Tareas, Foros y Archivos generales
export const uploadGeneral = multer({
    storage,
    limits
}).single('archivo');

// Helper para parsear IDs opcionales
const parseOptionalId = (val: any): number | null => {
    if (val === 'null' || val === 'undefined' || val === null || val === undefined || val === '') return null;
    const parsed = Number(val);
    return isNaN(parsed) ? null : parsed;
};

export const addRecursoUrl = async (req: Request, res: Response) => {
    try {
        await recursoService.createRecursoUrl(req.body, req.user);
        res.status(201).json({ message: 'Recurso URL creado con éxito.' });
    } catch (error) {
        console.error('Error al crear recurso URL:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const addRecursoAnuncio = async (req: Request, res: Response) => {
    try {
        await recursoService.createRecursoAnuncio(req.body, req.user);
        res.status(201).json({ message: 'Anuncio creado con éxito.' });
    } catch (error) {
        console.error('Error al crear Anuncio:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const getRecursoById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const recurso = await recursoService.findRecursoById(id);
        res.status(200).json(recurso);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el recurso.' });
    }
};

export const updateRecurso = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.id);
        await recursoService.updateRecursoById(recursoId, req.body, req.user);
        res.status(200).json({ message: 'Recurso actualizado con éxito.' });
    } catch (error) {
        console.error('Error al actualizar el recurso:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const toggleRecursoVisibility = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.id);
        const { nuevoEstado } = await recursoService.toggleRecursoVisibilityById(recursoId, req.user);
        
        // if (req.user) {
        //     const operacion = `Cambió la visibilidad del recurso ID: ${recursoId} a ${nuevoEstado ? 'Visible' : 'Oculto'}`;
        //     await registrarAccion(req.user.codigo, req.user.perfil, 'Aula Virtual', 'Gestión de Recursos', operacion);
        // }
        res.status(200).json({ message: `Visibilidad del recurso cambiada.`, data: { nuevoEstado } });
    } catch (error) {
        console.error('Error al cambiar la visibilidad del recurso:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const deleteRecurso = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.id);
        await recursoService.deleteRecursoById(recursoId, req.user);
        res.status(200).json({ message: 'Recurso eliminado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar el recurso.' });
    }
};

export const cloneRecurso = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.id);
        await recursoService.cloneRecursoById(recursoId, req.user);
        res.status(201).json({ message: 'Recurso clonado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al clonar el recurso.' });
    }
};

export const registrarVistaRecurso = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.id);
        // Validación segura por si req.user es undefined (aunque el middleware auth debería evitarlo)
        const matriculaNo = req.user?.codigo; 
        if (matriculaNo) {
             await recursoService.registrarVista(recursoId, matriculaNo);
        }
        res.sendStatus(204); 
    } catch (error) {
        console.error('Error no crítico al registrar vista:', error);
        res.sendStatus(204);
    }
};

export const addRecursoTarea = (req: Request, res: Response) => {
    uploadGeneral(req, res, async (err: any) => {
        // 1. DIAGNÓSTICO DE ERROR DE MULTER
        if (err) {
            console.error('Error de Multer:', err); // <--- AGREGA ESTO PARA VER EL ERROR REAL
            
            // Si el error es por tamaño, el código suele ser 'LIMIT_FILE_SIZE'
            if (err.code === 'LIMIT_FILE_SIZE') {
                 return res.status(400).json({ message: 'El archivo es demasiado pesado. Máximo 5MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error al subir archivo' });
        }

        try {
            console.log('Body recibido:', req.body); // <--- VERIFICA QUE LLEGUE jsonData
            console.log('Archivo recibido:', req.file); // <--- VERIFICA QUE LLEGUE EL ARCHIVO

            // Validación extra: jsonData es obligatorio
            if (!req.body.jsonData) {
                return res.status(400).json({ message: 'Faltan los datos de la tarea (jsonData).' });
            }

            const tareaData = JSON.parse(req.body.jsonData);
            
            const archivo = req.file; 
            const archivosArray = archivo ? [archivo] : [];

            await recursoService.createRecursoTarea(tareaData, archivosArray, req.user);
            res.status(201).json({ message: 'Tarea creada con éxito.' });
        } catch (error) {
            console.error('Error al crear el recurso Tarea:', error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    });
};

export const addRecursoArchivo = (req: Request, res: Response) => {
    uploadGeneral(req, res, async (err: any) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'El archivo es demasiado pesado. El límite permitido es de 5MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error al subir el archivo.' });
        }

        try {
            const archivoData = JSON.parse(req.body.jsonData);
            const archivo = req.file;

            if (!archivo) {
                return res.status(400).json({ message: 'No se ha adjuntado ningún archivo.' });
            }

            await recursoService.createRecursoArchivo(archivoData, archivo, req.user);
            res.status(201).json({ message: 'Archivo creado con éxito.' });
        } catch (error) {
            console.error('Error al crear el recurso Archivo:', error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    });
};

export const addRecursoForo = (req: Request, res: Response) => {
    uploadGeneral(req, res, async (err: any) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'El archivo es demasiado pesado. El límite permitido es de 5MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error al subir el archivo.' });
        }

        try {
            const foroData = JSON.parse(req.body.jsonData);
            const archivo = req.file; // Puede ser undefined

            await recursoService.createRecursoForo(foroData, archivo, req.user);
            res.status(201).json({ message: 'Foro creado con éxito.' });
        } catch (error) {
            console.error('Error al crear el recurso Foro:', error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    });
};

export const getAdjuntoTarea = async (req: Request, res: Response) => {
    try {
        const archivoId = Number(req.params.archivoId);
        if (isNaN(archivoId)) return res.status(400).send('ID inválido');

        const archivo = await recursoService.findAdjuntoTareaById(archivoId);

        if (!archivo || !archivo.ArchivoData) {
            return res.status(404).json({ message: 'Archivo no encontrado.' });
        }

        // Cachear archivos estáticos mejora rendimiento
        res.setHeader('Cache-Control', 'public, max-age=86400'); 
        res.setHeader('Content-Type', archivo.ArchivoMimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.NombreOriginal || 'archivo')}"`);
        
        res.end(archivo.ArchivoData);
    } catch (error) {
        console.error('Error al descargar archivo tarea:', error);
        res.status(500).json({ message: 'Error interno.' });
    }
};

export const getAdjuntoForo = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const archivo = await recursoService.findAdjuntoForoById(recursoId);

        if (!archivo || !archivo.AdjuntoData) {
            return res.status(404).json({ message: 'Archivo adjunto del foro no encontrado.' });
        }

        res.setHeader('Content-Type', archivo.AdjuntoMimeType);
        res.send(archivo.AdjuntoData);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el archivo del foro.' });
    }
};

export const getRecursoArchivoData = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const archivo = await recursoService.findRecursoArchivoDataById(recursoId);

        if (!archivo || !archivo.ArchivoData) {
            return res.status(404).json({ message: 'Recurso de archivo no encontrado.' });
        }

        res.setHeader('Content-Type', archivo.ArchivoMimeType);
        res.send(archivo.ArchivoData);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los datos del archivo.' });
    }
};

export const addRecursoPrueba = async (req: Request, res: Response) => {
    try {
        const data = await recursoService.createRecursoPrueba(req.body, req.user);
        res.status(201).json({ 
            message: 'Prueba creada con éxito. Ahora puedes agregar las preguntas.',
            data: data // Enviamos los nuevos IDs al frontend
        });
    } catch (error) {
        console.error('Error al crear el recurso Prueba:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const createVideoconferencia = async (req: Request, res: Response) => {
  try {
    // Si manejas actor en req (desde auth.middleware), pásalo:
    const actor = (req as any).user as { codigo: number; perfil: string } | undefined;

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

    const { newRecursoId } = await recursoService.createRecursoVideoconferencia(payload, actor as any);
    res.status(201).json({ newRecursoId });
  } catch (e: any) {
    console.error('[createVideoconferencia]', e);
    res.status(500).json({ message: 'Error al crear videoconferencia' });
  }
};

export const createVideo = async (req: Request, res: Response) => {
  try {
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
    const actor = (req as any).user as { codigo: number; perfil: string } | undefined;

    if (!payload.urlVideo) return res.status(400).json({ message: 'La URL del video es requerida.' });

    const { newRecursoId } = await recursoService.createRecursoVideo(payload, actor);
    res.status(201).json({ newRecursoId });
  } catch (e: any) {
    console.error('[CTRL:createVideo]', e);
    res.status(500).json({ message: 'Error al crear el recurso de video' });
  }
};


export const createImagenFromFile = (req: Request, res: Response) => {
    uploadImagen(req, res, async (err: any) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'La imagen excede el límite de 5MB.' });
            }
            // Error lanzado por el fileFilter (tipo de archivo incorrecto)
            return res.status(400).json({ message: err.message || 'Error al procesar la imagen.' });
        }

        try {
            const file = req.file;
            if (!file) return res.status(400).json({ message: 'No se recibió archivo' });

            console.log('[DEBUG BACK 4] Body raw:', req.body);

            const raw = req.body.jsonData;
            const body = raw ? JSON.parse(raw) : {};

            // --- LOG DEBUG 5: ¿Qué hay tras el parseo? ---
            console.log('[DEBUG BACK 5] Body parseado:', body);
            console.log('[DEBUG BACK 5] Target extraído:', body.whatsappTarget);
            
            const { titulo, contenido, apartadoId, fechaPublicacion, esPersonalizado, estudiantesIds, whatsappTarget } = body;

            if (!apartadoId || !titulo) {
                return res.status(400).json({ message: 'Faltan datos (apartadoId, titulo).' });
            }

            const actor: UserActor | undefined = req.user
                ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) }
                : undefined;

            // Enviamos el BUFFER al servicio
            await recursoService.createRecursoImagen({
                apartadoId: Number(apartadoId),
                titulo: String(titulo),
                contenido: String(contenido ?? ''),
                fechaPublicacion: fechaPublicacion ? new Date(fechaPublicacion) : new Date(),
                fileName: file.originalname,
                mimeType: file.mimetype,
                buffer: file.buffer, // <--- AQUÍ ESTÁ LA CLAVE
                esPersonalizado: Boolean(esPersonalizado),
                estudiantesIds: Array.isArray(estudiantesIds) ? estudiantesIds.map(Number) : [],
                whatsappTarget: whatsappTarget
            }, actor);

            res.status(201).json({ message: 'Imagen guardada en base de datos correctamente.' });
        } catch (e: any) {
            console.error('[createImagenFromFile]', e);
            res.status(500).json({ message: 'Error al guardar imagen en BD' });
        }
    });
};


export const createImagenFromUrl = async (req: Request, res: Response) => {
    try {
        const { titulo, contenido, apartadoId, fechaPublicacion, esPersonalizado, estudiantesIds, imageUrl, whatsappTarget } = req.body || {};
        const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;

        await recursoService.createRecursoImagenExterna({
            apartadoId: Number(apartadoId),
            titulo: String(titulo),
            contenido: String(contenido ?? ''),
            fechaPublicacion: fechaPublicacion ? new Date(fechaPublicacion) : new Date(),
            url: imageUrl,
            esPersonalizado: Boolean(esPersonalizado),
            estudiantesIds: Array.isArray(estudiantesIds) ? estudiantesIds.map(Number) : [],
            whatsappTarget
        }, actor);

        res.status(201).json({ message: 'Imagen vinculada exitosamente.' });
    } catch (e: any) {
        console.error('[createImagenFromUrl]', e);
        res.status(500).json({ message: 'Error al vincular imagen.' });
    }
};

// GET /recursos/imagen/:recursoId/stream  (servir binario desde BD)
export const streamImagen = async (req: Request, res: Response) => {
  try {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) return res.status(400).send('recursoId inválido');

    // Ahora priorizamos la búsqueda binaria
    const item = await recursoService.getImagenBinaryByRecursoId(recursoId);
    
    if (!item || !item.buffer) {
         // Fallback por si es una URL antigua o externa
         return res.status(404).send('Imagen no encontrada o es externa.');
    }

    // Cacheo agresivo para rendimiento (las imágenes de BD no cambian seguido)
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 día de caché
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Content-Length', item.buffer.length);
    res.send(item.buffer);

  } catch (e) {
    console.error('[streamImagen]', e);
    res.status(500).send('Error al servir la imagen');
  }
};

export const createCarpeta = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const payload = {
      apartadoId: Number(body.apartadoId),
      titulo: String(body.titulo || ''),
      contenido: String(body.contenido || ''),
      fechaPublicacion: body.fechaPublicacion ? new Date(body.fechaPublicacion) : new Date(),
      esPersonalizado: !!body.esPersonalizado,
      estudiantesIds: Array.isArray(body.estudiantesIds) ? body.estudiantesIds.map(Number) : [],
    };

    if (!payload.apartadoId || !payload.titulo) {
      return res.status(400).json({ message: 'Faltan datos requeridos (apartadoId, titulo).' });
    }

    const actor = (req as any).user ? { codigo: Number((req as any).user.codigo), perfil: String((req as any).user.perfil) } : undefined;
    const { newRecursoId } = await recursoService.createRecursoCarpeta(payload, actor);
    res.status(201).json({ newRecursoId });
  } catch (e) {
    console.error('[createCarpeta]', e);
    res.status(500).json({ message: 'Error al crear carpeta' });
  }
};
export const createSubFolder = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        if (isNaN(recursoId)) return res.status(400).json({ message: "ID de recurso inválido" });

        const { nombre, parentId } = req.body;

        if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
            return res.status(400).json({ message: "El nombre de la carpeta es obligatorio." });
        }

        const parentIdParsed = parseOptionalId(parentId);
        
        const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;

        await recursoService.createSubCarpeta(recursoId, nombre.trim(), parentIdParsed, actor);
        
        res.status(201).json({ message: 'Carpeta creada exitosamente.' });
    } catch (error: any) {
        console.error('[CTRL] createSubFolder:', error);
        res.status(400).json({ message: error.message || 'Error al crear la carpeta.' });
    }
};

export const createLinkInFolder = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        // folderId puede venir como string "null" o un numero
        const folderIdStr = req.body.folderId;
        const folderId = (folderIdStr && folderIdStr !== 'null') ? Number(folderIdStr) : null;
        
        const { titulo, url } = req.body;

        if (!titulo || !url) return res.status(400).json({ message: "Título y URL son requeridos." });

        const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;

        await recursoService.createEnlaceCarpeta(recursoId, folderId, titulo, url, actor);
        res.status(201).json({ message: 'Enlace creado.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al crear enlace.' });
    }
};

// --- NUEVO: listar archivos de carpeta ---
export const getArchivosCarpeta = async (req: Request, res: Response) => {
  try {
    const recursoId = Number(req.params.recursoId);
    if (!Number.isFinite(recursoId)) return res.status(400).json({ message: 'recursoId inválido' });
    const rows = await recursoService.listArchivosCarpeta(recursoId);
    res.json(rows);
  } catch (e) {
    console.error('[getArchivosCarpeta]', e);
    res.status(500).json({ message: 'Error al listar archivos' });
  }
};

export const getContenidoCarpeta = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        if (isNaN(recursoId)) return res.status(400).json({ message: "ID de recurso inválido" });

        // Extraer folderId de la query string (?folderId=123)
        const folderId = parseOptionalId(req.query.folderId);

        const contenido = await recursoService.getContenidoCarpeta(recursoId, folderId);
        res.json(contenido);
    } catch (error: any) {
        console.error('[CTRL] getContenidoCarpeta:', error);
        res.status(500).json({ message: error.message || 'Error interno al obtener contenido.' });
    }
};

// --- NUEVO: subir archivos a carpeta ---
export const uploadArchivosCarpeta = (req: Request, res: Response) => {
    // CAMBIO: Ahora usamos uploadGeneral que fuerza .single('archivo')
    uploadGeneral(req, res, async (err: any) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'El archivo es demasiado pesado. El límite permitido es de 5MB.' });
            }
            return res.status(400).json({ message: err.message || 'Error al subir archivo' });
        }

        
        try {
            const recursoId = Number(req.params.recursoId);
            if (!Number.isFinite(recursoId)) return res.status(400).json({ message: 'recursoId inválido' });

            const folderId = parseOptionalId(req.body.folderId);

            const file = req.file;
            if (!file) return res.status(400).json({ message: 'No se ha adjuntado ningún archivo.' });

            const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;
            
            // Adaptamos a array porque el servicio probablemente espera una lista
            await recursoService.addArchivosToCarpeta(recursoId, [file], folderId, actor);
            
            res.status(201).json({ message: 'Archivo agregado a la carpeta' });
        } catch (e) {
            console.error('[uploadArchivosCarpeta]', e);
            res.status(500).json({ message: 'Error al subir archivo a carpeta' });
        }
    });
};

export const downloadArchivoCarpeta = async (req: Request, res: Response) => {
  try {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isFinite(archivoId)) return res.status(400).send('archivoId inválido');

    // Consultamos al servicio
    const row = await recursoService.getArchivoCarpetaById(archivoId);
    
    // Validamos que exista el registro y que tenga datos binarios
    if (!row || !row.ArchivoData) {
        return res.status(404).send('El archivo no existe o no tiene contenido.');
    }

    // Ya no verificamos 'fs.existsSync' porque confiamos en el BLOB de la BD
    
    // Configurar cabeceras para descarga
    res.setHeader('Content-Type', row.ArchivoMimeType || 'application/octet-stream');
    // encodeURIComponent es vital para nombres con tildes o espacios
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.NombreOriginal)}"`);
    res.setHeader('Content-Length', row.ArchivoData.length);

    // Enviar el Buffer directamente
    res.end(row.ArchivoData);

  } catch (e) {
    console.error('[downloadArchivoCarpeta]', e);
    res.status(500).send('Error al descargar archivo');
  }
};

// --- NUEVO: eliminar archivo ---
export const deleteArchivoCarpeta = async (req: Request, res: Response) => {
  try {
    const archivoId = Number(req.params.archivoId);
    if (!Number.isFinite(archivoId)) return res.status(400).json({ message: 'archivoId inválido' });

    const actor = (req as any).user ? { codigo: Number((req as any).user.codigo), perfil: String((req as any).user.perfil) } : undefined;
    await recursoService.deleteArchivoCarpeta(archivoId, actor);
    res.status(204).send();
  } catch (e) {
    console.error('[deleteArchivoCarpeta]', e);
    res.status(500).json({ message: 'Error al eliminar archivo' });
  }
};

export const deleteSubFolder = async (req: Request, res: Response) => {
    try {
        const folderId = Number(req.params.folderId);
        if (isNaN(folderId)) return res.status(400).json({ message: "ID de carpeta inválido" });

        const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;

        await recursoService.deleteSubCarpeta(folderId, actor);
        
        res.status(204).send(); // 204 No Content
    } catch (error: any) {
        console.error('[CTRL] deleteSubFolder:', error);
        res.status(500).json({ message: error.message || 'Error al eliminar la carpeta.' });
    }
};

export const deleteLinkInFolder = async (req: Request, res: Response) => {
    try {
        const enlaceId = Number(req.params.enlaceId);
        const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;
        await recursoService.deleteEnlaceCarpeta(enlaceId, actor);
        res.status(204).send();
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al eliminar enlace.' });
    }
};

export const moveItemInFolder = async (req: Request, res: Response) => {
    try {
        const recursoId = Number(req.params.recursoId);
        const { tipo, itemId, targetFolderId } = req.body; // targetFolderId puede ser null

        // Validación básica
        if (!['archivo', 'enlace'].includes(tipo)) return res.status(400).json({ message: "Tipo inválido" });

        const actor = req.user ? { codigo: Number(req.user.codigo), perfil: String(req.user.perfil) } : undefined;

        await recursoService.moverElementoCarpeta(recursoId, tipo, itemId, targetFolderId, actor);
        
        res.status(200).json({ message: 'Elemento movido exitosamente.' });
    } catch (error: any) {
        console.error('[moveItemInFolder]', error);
        res.status(500).json({ message: error.message || 'Error al mover elemento.' });
    }
}


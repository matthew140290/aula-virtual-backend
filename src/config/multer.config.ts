// src/config/multer.config.ts
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Aseguramos que la carpeta temporal exista al arrancar el servidor
const tempDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Almacenamiento en disco (Protege la RAM)
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Sanitizar el nombre del archivo para evitar inyecciones o errores de SO
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, `${uniqueSuffix}-${safeName}`);
    }
});

// Filtro estricto para imágenes
const allowedImages = new Set([
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'
]);

export const uploadDiskGeneral = multer({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite estricto de 5MB
});

export const uploadDiskImagen = multer({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (allowedImages.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato inválido. Solo se permiten imágenes (jpg, png, webp, gif).'));
        }
    }
});
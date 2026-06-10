"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDiskImagen = exports.uploadDiskGeneral = void 0;
// src/config/multer.config.ts
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Aseguramos que la carpeta temporal exista al arrancar el servidor
const tempDir = path_1.default.join(__dirname, '../uploads/temp');
if (!fs_1.default.existsSync(tempDir)) {
    fs_1.default.mkdirSync(tempDir, { recursive: true });
}
// Almacenamiento en disco (Protege la RAM)
const diskStorage = multer_1.default.diskStorage({
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
exports.uploadDiskGeneral = (0, multer_1.default)({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite estricto de 5MB
});
exports.uploadDiskImagen = (0, multer_1.default)({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (allowedImages.has(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Formato inválido. Solo se permiten imágenes (jpg, png, webp, gif).'));
        }
    }
});

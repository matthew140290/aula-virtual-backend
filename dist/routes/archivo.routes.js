"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//src/routes/archivo.routes
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB en bytes
    }
});
router.post('/upload', auth_middleware_1.protect, upload.array('archivos'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No se subieron archivos.' });
    }
    try {
        const uploadedFiles = req.files.map(file => ({
            nombreOriginal: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer.toString('base64'),
            tamano: file.size,
        }));
        res.status(201).json({
            message: 'Archivos procesados con éxito.',
            data: uploadedFiles
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error al procesar el archivo.' });
    }
});
exports.default = router;

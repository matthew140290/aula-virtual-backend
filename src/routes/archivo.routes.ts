//src/routes/archivo.routes
import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.middleware';

const router = Router();


const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 5 * 1024 * 1024 // 5 MB en bytes
    }
});

router.post('/upload', protect, upload.array('archivos'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No se subieron archivos.' });
    }

    try {
        const uploadedFiles = (req.files as Express.Multer.File[]).map(file => ({
            nombreOriginal: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer.toString('base64'), 
            tamano: file.size,
        }));
        
        res.status(201).json({
            message: 'Archivos procesados con éxito.',
            data: uploadedFiles
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al procesar el archivo.' });
    }
});

export default router;
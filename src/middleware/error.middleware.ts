// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction): Response => {
    // Capturamos el contexto de la petición para saber DÓNDE ocurrió el error
    const timestamp = new Date().toISOString();
    const route = `${req.method} ${req.originalUrl}`;
    const user = req.user ? `(User: ${req.user.codigo})` : '(No Autenticado)';

    // 1. Errores de Validación de Zod (Culpa del Frontend/Usuario)
    if (err instanceof ZodError) {
        console.warn(`⚠️ [${timestamp}] [VALIDATION_ERROR] ${route} ${user} - Datos mal formados en la petición.`);
        const errors = err.issues.map(e => ({ campo: e.path.join('.'), mensaje: e.message }));
        return res.status(400).json({ message: 'Error de validación de datos', errores: errors });
    }

    // 2. Errores de Multer (Archivos) (Culpa del Frontend/Usuario)
    if (err instanceof multer.MulterError) {
        console.warn(`⚠️ [${timestamp}] [MULTER_ERROR] ${route} ${user} - Motivo: ${err.message}`);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'El archivo excede el límite permitido (5MB).' });
        }
        return res.status(400).json({ message: `Error en la subida del archivo: ${err.message}` });
    }

    // 3. Errores Críticos de Servidor o Base de Datos (Culpa nuestra)
    if (err instanceof Error) {
        // Aquí imprimimos el ERROR EN ROJO junto con su Stack Trace completo (la línea exacta de código que falló)
        console.error(`\n🔥 [${timestamp}] [CRITICAL_ERROR] Fallo en ${route} ${user}`);
        console.error(`   Motivo: ${err.message}`);
        console.error(`   Stack Trace:\n${err.stack}\n`);
        
        // Al cliente solo le enviamos un mensaje genérico para no exponer vulnerabilidades de BD
        return res.status(500).json({ message: 'Error interno del servidor. Hemos registrado el incidente.' });
    }

    // 4. Errores Raros (Throw de strings, objetos no instancias de Error)
    console.error(`\n👽 [${timestamp}] [UNKNOWN_ERROR] Fallo extraño en ${route}`);
    console.error(err);
    return res.status(500).json({ message: 'Error inesperado en el servidor.' });
};
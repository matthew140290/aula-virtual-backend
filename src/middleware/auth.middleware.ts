// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { normalizeRole } from '../constants/roles';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ ERROR CRÍTICO: La variable de entorno JWT_SECRET no está definida.');
    process.exit(1); // Detenemos la app en lugar de usar un fallback inseguro
}

export interface DecodedUserToken {
    codigo: number;
    perfil: string;
    nombre: string;
    nombreCompleto: string;
    originalPerfil?: string;
}

export const protect = (req: Request, res: Response, next: NextFunction): void | Response => {
    try {
        const authHeader = req.headers.authorization;
        const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
        const token = bearer ?? (req.cookies && req.cookies.access_token);

        if (!token) {
            return res.status(401).json({ message: 'No autorizado, no se encontró token.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as DecodedUserToken;
        req.user = decoded; // Ahora TypeScript lo reconoce globalmente sin usar `any`
        
        next();
    } catch (error: unknown) {
        return res.status(401).json({ message: 'No autorizado, token inválido o expirado.' });
    }
};



export const authorize = (allowedRoles: string[]) => {
    const normalizedAllowed = allowedRoles.map(normalizeRole);
    
    return (req: Request, res: Response, next: NextFunction): void | Response => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado. Se requiere autenticación.' });
        }

        const userRole = normalizeRole(req.user.perfil);
        
        if (!normalizedAllowed.includes(userRole)) {
            return res.status(403).json({
                message: 'Acceso prohibido: No tienes los permisos necesarios para realizar esta acción.',
            });
        }
        
        next();
    };
}

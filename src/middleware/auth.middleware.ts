// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export interface DecodedUserToken {
    codigo: number;
    perfil: string;
    nombre: string;
    nombreCompleto: string;
    originalPerfil?: string; // Propiedad opcional
}

declare global {
  namespace Express {
    interface Request {
     user?: DecodedUserToken;
    }
  }
}


const normalizeRole = (r: string) =>
  r
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/s$/, ''); // 'estudiantes' -> 'estudiante'



export const protect = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const token = bearer ?? (req as any).cookies?.access_token;

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, no se encontró token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedUserToken;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'No autorizado, token inválido.' });
  }
};



export const authorize = (roles: string[]) => {
  const normalizedAllowed = roles.map(normalizeRole);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado.' });
    const userRole = normalizeRole(req.user.perfil);
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        message: 'Acceso prohibido: No tienes los permisos necesarios para este recurso.',
      });
    }
    next();
  };
};

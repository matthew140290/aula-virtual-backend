import { Request, Response, NextFunction } from 'express';
import { normalizeRole } from '../constants/roles';
import { verifyUserToken } from '../config/authToken';
import { getTenantId } from '../config/tenantContext';

export type { DecodedUserToken } from '../types/auth';

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response => {
  try {
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined;
    const cookieToken = typeof req.cookies?.access_token === 'string'
      ? req.cookies.access_token
      : undefined;
    const token = bearer || cookieToken;

    if (!token) {
      return res.status(401).json({ message: 'No autorizado, no se encontro token.' });
    }

    const decoded = verifyUserToken(token);
    if (decoded.tenantId !== getTenantId()) {
      return res.status(403).json({ message: 'El token no pertenece a este tenant.' });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'No autorizado, token invalido o expirado.' });
  }
};

export const authorize = (allowedRoles: string[]) => {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado. Se requiere autenticacion.' });
    }

    if (!normalizedAllowed.includes(normalizeRole(req.user.perfil))) {
      return res.status(403).json({
        message: 'Acceso prohibido: no tienes los permisos necesarios.',
      });
    }

    next();
  };
};

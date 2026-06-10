import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { normalizeTenantId } from './tenantRegistry';
import type { DecodedUserToken } from '../types/auth';

const TOKEN_ISSUER = 'aula-virtual';
const TOKEN_AUDIENCE = 'aula-virtual-api';

const userTokenSchema = z.object({
  codigo: z.number().int(),
  perfil: z.string().trim().min(1).max(96),
  nombre: z.string().trim().min(1).max(255),
  nombreCompleto: z.string().trim().min(1).max(255),
  tenantId: z.string().transform(normalizeTenantId),
  originalPerfil: z.string().trim().min(1).max(96).optional(),
  contexto: z.object({
    NombreGrado: z.string(),
    NombreCurso: z.string(),
  }).optional(),
});

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres.');
  }
  return secret;
};

export const assertAuthConfiguration = (): void => {
  getJwtSecret();
};

export const signUserToken = (
  payload: DecodedUserToken,
  expiresIn: '1h' | '8h',
): string =>
  jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
    expiresIn,
  });

export const verifyUserToken = (token: string): DecodedUserToken => {
  const decoded: unknown = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  });
  return userTokenSchema.parse(decoded);
};

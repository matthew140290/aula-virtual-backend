import { Request, Response, NextFunction } from 'express';
import { tenantManager } from '../config/tenantManager';
import { tenantContext } from '../config/tenantContext';
import {
  InvalidTenantError,
  UnknownTenantError,
  normalizeTenantId,
} from '../config/tenantRegistry';

const getHeaderTenant = (req: Request): string => {
  const header = req.headers['x-tenant-id'];
  if (typeof header !== 'string') {
    throw new InvalidTenantError('Se requiere una unica cabecera x-tenant-id.');
  }
  return normalizeTenantId(header);
};

const getOriginTenant = (origin: string | undefined): string | null => {
  if (!origin) return null;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    throw new InvalidTenantError('El encabezado Origin no es valido.');
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  const domain = (process.env.TENANT_FRONTEND_DOMAIN ?? 'aula-virtual.plataformaangela.com')
    .trim()
    .toLowerCase();
  const suffix = `.${domain}`;
  if (!hostname.endsWith(suffix)) {
    throw new InvalidTenantError('El origen no pertenece al dominio multi-tenant.');
  }
  return normalizeTenantId(hostname.slice(0, -suffix.length));
};

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const tenantId = getHeaderTenant(req);
    const originTenant = getOriginTenant(req.headers.origin);
    if (originTenant && originTenant !== tenantId) {
      return res.status(403).json({ message: 'El origen no corresponde al tenant solicitado.' });
    }

    const pool = await tenantManager.getPool(tenantId);
    req.tenantId = tenantId;
    tenantContext.run({ tenantId, pool }, next);
  } catch (error: unknown) {
    if (error instanceof InvalidTenantError) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof UnknownTenantError) {
      return res.status(404).json({ message: 'Tenant no disponible.' });
    }
    console.error('[TenantMiddleware] No fue posible preparar el tenant:', error);
    return res.status(503).json({ message: 'Servicio del colegio temporalmente no disponible.' });
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = void 0;
const tenantManager_1 = require("../config/tenantManager");
const tenantContext_1 = require("../config/tenantContext");
const tenantRegistry_1 = require("../config/tenantRegistry");
const getHeaderTenant = (req) => {
    const header = req.headers['x-tenant-id'];
    if (typeof header !== 'string') {
        throw new tenantRegistry_1.InvalidTenantError('Se requiere una unica cabecera x-tenant-id.');
    }
    return (0, tenantRegistry_1.normalizeTenantId)(header);
};
const getOriginTenant = (origin) => {
    if (!origin)
        return null;
    let hostname;
    try {
        hostname = new URL(origin).hostname.toLowerCase();
    }
    catch {
        throw new tenantRegistry_1.InvalidTenantError('El encabezado Origin no es valido.');
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1')
        return null;
    const domain = (process.env.TENANT_FRONTEND_DOMAIN ?? 'aula-virtual.plataformaangela.com')
        .trim()
        .toLowerCase();
    const suffix = `.${domain}`;
    if (!hostname.endsWith(suffix)) {
        throw new tenantRegistry_1.InvalidTenantError('El origen no pertenece al dominio multi-tenant.');
    }
    return (0, tenantRegistry_1.normalizeTenantId)(hostname.slice(0, -suffix.length));
};
const tenantMiddleware = async (req, res, next) => {
    try {
        const tenantId = getHeaderTenant(req);
        const originTenant = getOriginTenant(req.headers.origin);
        if (originTenant && originTenant !== tenantId) {
            return res.status(403).json({ message: 'El origen no corresponde al tenant solicitado.' });
        }
        const pool = await tenantManager_1.tenantManager.getPool(tenantId);
        req.tenantId = tenantId;
        tenantContext_1.tenantContext.run({ tenantId, pool }, next);
    }
    catch (error) {
        if (error instanceof tenantRegistry_1.InvalidTenantError) {
            return res.status(400).json({ message: error.message });
        }
        if (error instanceof tenantRegistry_1.UnknownTenantError) {
            return res.status(404).json({ message: 'Tenant no disponible.' });
        }
        console.error('[TenantMiddleware] No fue posible preparar el tenant:', error);
        return res.status(503).json({ message: 'Servicio del colegio temporalmente no disponible.' });
    }
};
exports.tenantMiddleware = tenantMiddleware;

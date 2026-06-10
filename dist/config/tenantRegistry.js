"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTenantConfiguration = exports.assertTenantAllowed = exports.getAllowedTenantIds = exports.parseAllowedTenantIds = exports.normalizeTenantId = exports.UnknownTenantError = exports.InvalidTenantError = exports.TenantConfigurationError = void 0;
const TENANT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
class TenantConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TenantConfigurationError';
    }
}
exports.TenantConfigurationError = TenantConfigurationError;
class InvalidTenantError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidTenantError';
    }
}
exports.InvalidTenantError = InvalidTenantError;
class UnknownTenantError extends Error {
    constructor() {
        super('Tenant no registrado.');
        this.name = 'UnknownTenantError';
    }
}
exports.UnknownTenantError = UnknownTenantError;
const normalizeTenantId = (value) => {
    const tenantId = value.trim().toLowerCase();
    if (!TENANT_ID_PATTERN.test(tenantId)) {
        throw new InvalidTenantError('El identificador del tenant no es valido.');
    }
    return tenantId;
};
exports.normalizeTenantId = normalizeTenantId;
const parseAllowedTenantIds = (rawValue) => {
    if (!rawValue?.trim()) {
        throw new TenantConfigurationError('TENANT_IDS debe contener al menos un tenant.');
    }
    return new Set(rawValue.split(',').map(exports.normalizeTenantId));
};
exports.parseAllowedTenantIds = parseAllowedTenantIds;
const getAllowedTenantIds = () => (0, exports.parseAllowedTenantIds)(process.env.TENANT_IDS);
exports.getAllowedTenantIds = getAllowedTenantIds;
const assertTenantAllowed = (value) => {
    const tenantId = (0, exports.normalizeTenantId)(value);
    if (!(0, exports.getAllowedTenantIds)().has(tenantId)) {
        throw new UnknownTenantError();
    }
    return tenantId;
};
exports.assertTenantAllowed = assertTenantAllowed;
const assertTenantConfiguration = () => {
    (0, exports.getAllowedTenantIds)();
    const userTemplate = process.env.DB_USER;
    const databaseTemplate = process.env.DB_DATABASE;
    if (!userTemplate?.includes('{tenant}') || !databaseTemplate?.includes('{tenant}')) {
        throw new TenantConfigurationError('DB_USER y DB_DATABASE deben incluir el marcador {tenant}.');
    }
};
exports.assertTenantConfiguration = assertTenantConfiguration;

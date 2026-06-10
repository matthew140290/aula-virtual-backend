const TENANT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class TenantConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantConfigurationError';
  }
}

export class InvalidTenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTenantError';
  }
}

export class UnknownTenantError extends Error {
  constructor() {
    super('Tenant no registrado.');
    this.name = 'UnknownTenantError';
  }
}

export const normalizeTenantId = (value: string): string => {
  const tenantId = value.trim().toLowerCase();
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new InvalidTenantError('El identificador del tenant no es valido.');
  }
  return tenantId;
};

export const parseAllowedTenantIds = (rawValue: string | undefined): ReadonlySet<string> => {
  if (!rawValue?.trim()) {
    throw new TenantConfigurationError('TENANT_IDS debe contener al menos un tenant.');
  }

  return new Set(rawValue.split(',').map(normalizeTenantId));
};

export const getAllowedTenantIds = (): ReadonlySet<string> =>
  parseAllowedTenantIds(process.env.TENANT_IDS);

export const assertTenantAllowed = (value: string): string => {
  const tenantId = normalizeTenantId(value);
  if (!getAllowedTenantIds().has(tenantId)) {
    throw new UnknownTenantError();
  }
  return tenantId;
};

export const assertTenantConfiguration = (): void => {
  getAllowedTenantIds();

  const userTemplate = process.env.DB_USER;
  const databaseTemplate = process.env.DB_DATABASE;
  if (!userTemplate?.includes('{tenant}') || !databaseTemplate?.includes('{tenant}')) {
    throw new TenantConfigurationError(
      'DB_USER y DB_DATABASE deben incluir el marcador {tenant}.',
    );
  }
};

import { AsyncLocalStorage } from 'async_hooks';
import type sql from 'mssql';

export interface TenantContext {
  tenantId: string;
  pool: sql.ConnectionPool;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const context = tenantContext.getStore();
  if (!context) {
    throw new Error('No hay un contexto de tenant activo para esta operacion.');
  }
  return context;
}

export function getTenantPool(): sql.ConnectionPool {
  return getTenantContext().pool;
}

export function getTenantId(): string {
  return getTenantContext().tenantId;
}

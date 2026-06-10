import type sql from 'mssql';
import { getTenantPool } from './tenantContext';

// Conserva el contrato existente `await poolPromise` sin capturar un pool global.
export const poolPromise: PromiseLike<sql.ConnectionPool> = {
  then<TResult1 = sql.ConnectionPool, TResult2 = never>(
    onfulfilled?: ((value: sql.ConnectionPool) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(getTenantPool)
      .then(onfulfilled, onrejected);
  },
};

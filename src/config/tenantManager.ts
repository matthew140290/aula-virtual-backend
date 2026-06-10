import sql from 'mssql';
import { dbConfig } from './database';
import { assertTenantAllowed } from './tenantRegistry';

interface PoolEntry {
  pool: sql.ConnectionPool;
  lastUsedAt: number;
}

type PoolFactory = (config: sql.config) => sql.ConnectionPool;

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export class TenantManager {
  private readonly pools = new Map<string, PoolEntry>();
  private readonly pendingPools = new Map<string, Promise<sql.ConnectionPool>>();
  private readonly idleTimeoutMs: number;
  private readonly maxPools: number;

  constructor(
    private readonly poolFactory: PoolFactory = (config) => new sql.ConnectionPool(config),
  ) {
    this.idleTimeoutMs = parsePositiveInteger(process.env.TENANT_POOL_IDLE_MS, 30 * 60 * 1000);
    this.maxPools = parsePositiveInteger(process.env.TENANT_MAX_POOLS, 100);
  }

  public async getPool(rawTenantId: string): Promise<sql.ConnectionPool> {
    const tenantId = assertTenantAllowed(rawTenantId);
    await this.closeIdlePools(tenantId);

    const existing = this.pools.get(tenantId);
    if (existing?.pool.connected) {
      existing.lastUsedAt = Date.now();
      return existing.pool;
    }
    if (existing) {
      this.pools.delete(tenantId);
      await existing.pool.close().catch(() => undefined);
    }

    const pending = this.pendingPools.get(tenantId);
    if (pending) return pending;

    if (this.pools.size >= this.maxPools) {
      await this.closeLeastRecentlyUsedPool();
    }

    const connectionPromise = this.createPool(tenantId);
    this.pendingPools.set(tenantId, connectionPromise);
    try {
      return await connectionPromise;
    } finally {
      this.pendingPools.delete(tenantId);
    }
  }

  public async closeAll(): Promise<void> {
    const entries = Array.from(this.pools.values());
    this.pools.clear();
    await Promise.allSettled(entries.map(({ pool }) => pool.close()));
  }

  private async createPool(tenantId: string): Promise<sql.ConnectionPool> {
    const userTemplate = process.env.DB_USER;
    const databaseTemplate = process.env.DB_DATABASE;
    if (!userTemplate?.includes('{tenant}') || !databaseTemplate?.includes('{tenant}')) {
      throw new Error('Las plantillas de base de datos multi-tenant no estan configuradas.');
    }

    const config: sql.config = {
      ...dbConfig,
      user: userTemplate.split('{tenant}').join(tenantId),
      database: databaseTemplate.split('{tenant}').join(tenantId),
    };
    const pool = this.poolFactory(config);

    pool.on('error', (error: Error) => {
      const current = this.pools.get(tenantId);
      if (current?.pool === pool) this.pools.delete(tenantId);
      console.error(`[TenantManager] Pool invalido para tenant ${tenantId}:`, error);
    });

    try {
      const connectedPool = await pool.connect();
      this.pools.set(tenantId, { pool: connectedPool, lastUsedAt: Date.now() });
      return connectedPool;
    } catch (error: unknown) {
      await pool.close().catch(() => undefined);
      throw error;
    }
  }

  private async closeIdlePools(activeTenantId: string): Promise<void> {
    const expiration = Date.now() - this.idleTimeoutMs;
    const idleEntries = Array.from(this.pools.entries()).filter(
      ([tenantId, entry]) => tenantId !== activeTenantId && entry.lastUsedAt < expiration,
    );

    await Promise.all(idleEntries.map(async ([tenantId, entry]) => {
      this.pools.delete(tenantId);
      await entry.pool.close().catch(() => undefined);
    }));
  }

  private async closeLeastRecentlyUsedPool(): Promise<void> {
    const oldest = Array.from(this.pools.entries())
      .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)[0];
    if (!oldest) return;

    this.pools.delete(oldest[0]);
    await oldest[1].pool.close().catch(() => undefined);
  }
}

export const tenantManager = new TenantManager();

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantManager = exports.TenantManager = void 0;
const mssql_1 = __importDefault(require("mssql"));
const database_1 = require("./database");
const tenantRegistry_1 = require("./tenantRegistry");
const parsePositiveInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
class TenantManager {
    constructor(poolFactory = (config) => new mssql_1.default.ConnectionPool(config)) {
        this.poolFactory = poolFactory;
        this.pools = new Map();
        this.pendingPools = new Map();
        this.idleTimeoutMs = parsePositiveInteger(process.env.TENANT_POOL_IDLE_MS, 30 * 60 * 1000);
        this.maxPools = parsePositiveInteger(process.env.TENANT_MAX_POOLS, 100);
    }
    async getPool(rawTenantId) {
        const tenantId = (0, tenantRegistry_1.assertTenantAllowed)(rawTenantId);
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
        if (pending)
            return pending;
        if (this.pools.size >= this.maxPools) {
            await this.closeLeastRecentlyUsedPool();
        }
        const connectionPromise = this.createPool(tenantId);
        this.pendingPools.set(tenantId, connectionPromise);
        try {
            return await connectionPromise;
        }
        finally {
            this.pendingPools.delete(tenantId);
        }
    }
    async closeAll() {
        const entries = Array.from(this.pools.values());
        this.pools.clear();
        await Promise.allSettled(entries.map(({ pool }) => pool.close()));
    }
    async createPool(tenantId) {
        const userTemplate = process.env.DB_USER;
        const databaseTemplate = process.env.DB_DATABASE;
        if (!userTemplate?.includes('{tenant}') || !databaseTemplate?.includes('{tenant}')) {
            throw new Error('Las plantillas de base de datos multi-tenant no estan configuradas.');
        }
        const config = {
            ...database_1.dbConfig,
            user: userTemplate.split('{tenant}').join(tenantId),
            database: databaseTemplate.split('{tenant}').join(tenantId),
        };
        const pool = this.poolFactory(config);
        pool.on('error', (error) => {
            const current = this.pools.get(tenantId);
            if (current?.pool === pool)
                this.pools.delete(tenantId);
            console.error(`[TenantManager] Pool invalido para tenant ${tenantId}:`, error);
        });
        try {
            const connectedPool = await pool.connect();
            this.pools.set(tenantId, { pool: connectedPool, lastUsedAt: Date.now() });
            return connectedPool;
        }
        catch (error) {
            await pool.close().catch(() => undefined);
            throw error;
        }
    }
    async closeIdlePools(activeTenantId) {
        const expiration = Date.now() - this.idleTimeoutMs;
        const idleEntries = Array.from(this.pools.entries()).filter(([tenantId, entry]) => tenantId !== activeTenantId && entry.lastUsedAt < expiration);
        await Promise.all(idleEntries.map(async ([tenantId, entry]) => {
            this.pools.delete(tenantId);
            await entry.pool.close().catch(() => undefined);
        }));
    }
    async closeLeastRecentlyUsedPool() {
        const oldest = Array.from(this.pools.entries())
            .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)[0];
        if (!oldest)
            return;
        this.pools.delete(oldest[0]);
        await oldest[1].pool.close().catch(() => undefined);
    }
}
exports.TenantManager = TenantManager;
exports.tenantManager = new TenantManager();

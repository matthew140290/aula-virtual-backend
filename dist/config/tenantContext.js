"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContext = void 0;
exports.getTenantContext = getTenantContext;
exports.getTenantPool = getTenantPool;
exports.getTenantId = getTenantId;
const async_hooks_1 = require("async_hooks");
exports.tenantContext = new async_hooks_1.AsyncLocalStorage();
function getTenantContext() {
    const context = exports.tenantContext.getStore();
    if (!context) {
        throw new Error('No hay un contexto de tenant activo para esta operacion.');
    }
    return context;
}
function getTenantPool() {
    return getTenantContext().pool;
}
function getTenantId() {
    return getTenantContext().tenantId;
}

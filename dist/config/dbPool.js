"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolPromise = void 0;
const tenantContext_1 = require("./tenantContext");
// Conserva el contrato existente `await poolPromise` sin capturar un pool global.
exports.poolPromise = {
    then(onfulfilled, onrejected) {
        return Promise.resolve()
            .then(tenantContext_1.getTenantPool)
            .then(onfulfilled, onrejected);
    },
};

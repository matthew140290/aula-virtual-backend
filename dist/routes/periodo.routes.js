"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/periodo.routes.ts
const express_1 = require("express");
const periodoController = __importStar(require("../controllers/periodo.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const roles_1 = require("../constants/roles");
const validate_middleware_1 = require("../middleware/validate.middleware");
const periodo_schema_1 = require("../schemas/periodo.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
// GET /api/periodos
router.get('/', periodoController.getAllPeriods);
router.post('/:numeroPeriodo/configurar', (0, auth_middleware_1.authorize)([roles_1.ROLES.COORDINADOR, roles_1.ROLES.COORDINADOR_GENERAL, roles_1.ROLES.ADMINISTRADOR, roles_1.ROLES.MASTER]), (0, validate_middleware_1.validateSchema)(periodo_schema_1.configPeriodoSchema), periodoController.configurarPeriodo);
router.post('/:numeroPeriodo/excepcion', (0, auth_middleware_1.authorize)([roles_1.ROLES.COORDINADOR, roles_1.ROLES.COORDINADOR_GENERAL, roles_1.ROLES.ADMINISTRADOR, roles_1.ROLES.MASTER]), (0, validate_middleware_1.validateSchema)(periodo_schema_1.excepcionPeriodoSchema), periodoController.otorgarExcepcion);
exports.default = router;

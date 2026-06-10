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
// src/routes/semana.routes.ts
const express_1 = require("express");
const semanaController = __importStar(require("../controllers/semana.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware"); // Importamos el guardián
const roles_1 = require("../constants/roles");
const router = (0, express_1.Router)();
// Todas las rutas de semanas requieren autenticación
router.use(auth_middleware_1.protect);
// GET /api/semanas?codigoAsignatura=X&numeroPeriodo=Y
router.get('/', (0, auth_middleware_1.authorize)([
    roles_1.ROLES.DOCENTE,
    roles_1.ROLES.ESTUDIANTE,
    roles_1.ROLES.DIRECTOR_GRUPO,
    roles_1.ROLES.COORDINADOR,
    roles_1.ROLES.COORDINADOR_GENERAL,
    roles_1.ROLES.ADMINISTRADOR,
    roles_1.ROLES.MASTER
]), semanaController.getWeeks);
router.post('/', (0, auth_middleware_1.authorize)([roles_1.ROLES.DOCENTE, roles_1.ROLES.DIRECTOR_GRUPO]), semanaController.addWeeks);
router.patch('/:id', (0, auth_middleware_1.authorize)([roles_1.ROLES.DOCENTE, roles_1.ROLES.DIRECTOR_GRUPO]), semanaController.updateWeek);
router.delete('/:id', (0, auth_middleware_1.authorize)([roles_1.ROLES.DOCENTE, roles_1.ROLES.DIRECTOR_GRUPO]), semanaController.deleteWeek);
router.post('/:id/clone', (0, auth_middleware_1.authorize)([roles_1.ROLES.DOCENTE, roles_1.ROLES.DIRECTOR_GRUPO]), semanaController.cloneWeek);
exports.default = router;

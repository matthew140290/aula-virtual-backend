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
exports.getMisCursos = void 0;
const cursoService = __importStar(require("../services/curso.service"));
const estudianteService = __importStar(require("../services/estudiante.service"));
const roles_1 = require("../constants/roles");
const asyncHandler_1 = require("../utils/asyncHandler");
const ADMIN_ROLES = [roles_1.ROLES.COORDINADOR, roles_1.ROLES.COORDINADOR_GENERAL, roles_1.ROLES.ADMINISTRADOR, roles_1.ROLES.MASTER];
const DOCENTE_ROLES = [roles_1.ROLES.DOCENTE, roles_1.ROLES.DIRECTOR_GRUPO];
exports.getMisCursos = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { perfil, codigo } = req.user;
    if (ADMIN_ROLES.includes(perfil)) {
        const rows = await cursoService.findAllCursosInstitucionales();
        const data = rows.map((r) => ({
            codigoAsignatura: r.CodigoAsignatura,
            nombreAsignatura: r.NombreAsignatura,
            nombreCurso: r.NombreCurso,
            nombreGrado: r.NombreGrado,
            codigoCurso: r.CodigoCurso ?? null,
            nombreDocente: r.NombreDocente || 'Sin asignar',
            codigoDocente: r.CodigoDocente ?? null,
            rolVista: r.RolVista,
            esDirector: false
        }));
        return res.status(200).json(data);
    }
    if (DOCENTE_ROLES.includes(perfil)) {
        const rows = await cursoService.findCursosByDocente(codigo);
        const data = rows.map((r) => ({
            codigoAsignatura: r.CodigoAsignatura,
            nombreAsignatura: r.NombreAsignatura,
            nombreCurso: r.NombreCurso,
            nombreGrado: r.NombreGrado,
            codigoCurso: r.CodigoCurso ?? null,
            nombreDocente: null,
            codigoDocente: codigo,
            rolVista: r.RolVista,
            esDirector: r.RolVista === 'Director'
        }));
        return res.status(200).json(data);
    }
    if (perfil === roles_1.ROLES.ESTUDIANTE) {
        const rows = await estudianteService.findAsignaturasByEstudiante(codigo);
        const data = rows.map((r) => ({
            codigoAsignatura: r.CodigoAsignatura,
            nombreAsignatura: r.NombreAsignatura,
            nombreCurso: r.NombreCurso,
            nombreGrado: r.NombreGrado,
            codigoCurso: null,
            nombreDocente: r.NombreDocente ?? null,
            codigoDocente: null,
            rolVista: roles_1.ROLES.ESTUDIANTE,
            esDirector: false
        }));
        return res.status(200).json(data);
    }
    return res.status(403).json({ message: 'Perfil sin acceso a esta vista.' });
});

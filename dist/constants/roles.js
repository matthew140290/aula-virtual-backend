"use strict";
// src/constants/roles.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRole = exports.ROLES = void 0;
exports.ROLES = {
    ESTUDIANTE: 'Estudiante',
    DOCENTE: 'Docente',
    DIRECTOR_GRUPO: 'Director de grupo',
    COORDINADOR: 'Coordinador', // Nuevo rol integrado
    COORDINADOR_GENERAL: 'Coordinador general',
    ADMINISTRADOR: 'Administrador', // Nuevo rol integrado
    MASTER: 'Master'
};
// Helper para normalizar cadenas entrantes de BD o Tokens y hacer match seguro
const normalizeRole = (role) => {
    return role
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/s$/, ''); // 'estudiantes' -> 'estudiante'
};
exports.normalizeRole = normalizeRole;

// src/constants/roles.ts

export const ROLES = {
    ESTUDIANTE: 'Estudiante',
    DOCENTE: 'Docente',
    DIRECTOR_GRUPO: 'Director de grupo',
    COORDINADOR: 'Coordinador',       // Nuevo rol integrado
    COORDINADOR_GENERAL: 'Coordinador general',
    ADMINISTRADOR: 'Administrador',   // Nuevo rol integrado
    MASTER: 'Master'
} as const;

// Extraemos un tipo estricto basado en los valores del objeto
export type Role = typeof ROLES[keyof typeof ROLES];

// Helper para normalizar cadenas entrantes de BD o Tokens y hacer match seguro
export const normalizeRole = (role: string): string => {
    return role
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/s$/, ''); // 'estudiantes' -> 'estudiante'
};
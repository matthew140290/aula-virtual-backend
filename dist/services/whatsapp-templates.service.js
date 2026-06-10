"use strict";
// src/services/whatsapp-templates.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResourceNotificationVariables = void 0;
const cleanStr = (str) => {
    if (!str)
        return 'N/A';
    return str
        .replace(/\r?\n|\r/g, ' - ') // Cambia saltos de línea por un guión
        .replace(/\t/g, ' ') // Cambia tabulaciones por espacios
        .replace(/\s+/g, ' ') // Colapsa múltiples espacios en uno solo
        .trim(); // Quita espacios iniciales y finales
};
const buildResourceNotificationVariables = (data) => {
    const variables = {
        "1": cleanStr(data.nombreDestino),
        "2": cleanStr(data.tipoRecurso),
        "3": cleanStr(data.nombreAsignatura),
        "4": cleanStr(data.nombreDocente),
        "5": cleanStr(data.tituloRecurso).substring(0, 60),
        "6": cleanStr(data.nombreEstudiante),
        "7": cleanStr(data.fecha)
    };
    console.log('[WhatsApp Template Variables Sanitizadas]:', variables);
    return JSON.stringify(variables);
};
exports.buildResourceNotificationVariables = buildResourceNotificationVariables;

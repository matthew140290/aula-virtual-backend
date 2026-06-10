// src/services/whatsapp-templates.service.ts

interface NotificationData {
    nombreDestino: string;
    tipoRecurso: string;
    nombreAsignatura: string;
    nombreDocente: string;
    tituloRecurso: string;
    nombreEstudiante: string;
    fecha: string;
}

const cleanStr = (str: string | null | undefined): string => {
    if (!str) return 'N/A';
    return str
        .replace(/\r?\n|\r/g, ' - ') // Cambia saltos de línea por un guión
        .replace(/\t/g, ' ')         // Cambia tabulaciones por espacios
        .replace(/\s+/g, ' ')        // Colapsa múltiples espacios en uno solo
        .trim();                     // Quita espacios iniciales y finales
};

export const buildResourceNotificationVariables = (data: NotificationData): string => {
    const variables ={
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
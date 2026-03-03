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

export const buildResourceNotificationVariables = (data: NotificationData): string => {
    return JSON.stringify({
        "1": data.nombreDestino,
        "2": data.tipoRecurso,
        "3": data.nombreAsignatura,
        "4": data.nombreDocente,
        "5": data.tituloRecurso,
        "6": data.nombreEstudiante,
        "7": data.fecha             
    });
};
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

/**
 * Construye el cuerpo del mensaje EXACTAMENTE como fue aprobado por Meta.
 * Cualquier desviación (un espacio extra, un salto de línea diferente) puede
 * hacer que el mensaje falle en producción si es Business-Initiated.
 */
export const buildResourceNotificationBody = (data: NotificationData): string => {
    // NOTA: Los emojis deben coincidir con la plantilla registrada.
    return `Hola ${data.nombreDestino}. Se ha publicado un nuevo recurso tipo (${data.tipoRecurso}) en la asignatura *${data.nombreAsignatura}*.\n\n` +
           `👨‍🏫 *Docente:* ${data.nombreDocente}\n` +
           `📌 *Título:* ${data.tituloRecurso}\n` +
           `👤 *Estudiante:* ${data.nombreEstudiante}\n` +
           `📅 *Fecha:* ${data.fecha}\n\n` +
           `Ingresa al aula virtual de la plataforma Angela 1290 para ver más.`;
};
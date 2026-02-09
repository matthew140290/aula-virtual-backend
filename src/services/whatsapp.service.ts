// src/services/whatsapp.service.ts
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+57';

const client = twilio(accountSid, authToken);


const formatPhoneNumber = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    
    // Eliminar caracteres no numéricos
    const cleaned = phone.replace(/\D/g, '');

    // Validación básica (en Colombia móviles son 10 dígitos)
    if (cleaned.length < 10) return null; 

    // Si ya tiene el código de país (ej: 57300...), lo dejamos, si no, lo agregamos
    if (cleaned.startsWith('57') && cleaned.length === 12) {
        return `whatsapp:+${cleaned}`;
    }
    
    return `whatsapp:${countryCode}${cleaned}`;
};

export const sendWhatsAppMessage = async (to: string, body: string) => {
    const formattedTo = formatPhoneNumber(to);
    
    if (!formattedTo) {
        console.warn(`[WhatsApp] Número inválido u omitido: ${to}`);
        return null;
    }

    try {
        const message = await client.messages.create({
            body: body,
            from: fromNumber,
            to: formattedTo
        });
        return message.sid;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando a ${formattedTo}:`, error);
        return null;
    }
};
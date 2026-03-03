// src/services/whatsapp.service.ts
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const templateNuevoRecursoSid = process.env.TWILIO_TEMPLATE_NUEVO_RECURSO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+57';

const client = twilio(accountSid, authToken);


const formatPhoneNumber = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length < 10) return null; 

    if (cleaned.startsWith('57') && cleaned.length === 12) {
        return `whatsapp:+${cleaned}`;
    }
    
    return `whatsapp:${countryCode}${cleaned}`;
};

export const sendWhatsAppMessage = async (to: string, contentVariablesJson: string) => {
    const formattedTo = formatPhoneNumber(to);
    
    if (!formattedTo) {
        console.warn(`[WhatsApp] Número inválido u omitido: ${to}`);
        return null;
    }

    if (!templateNuevoRecursoSid) {
        console.error(`[WhatsApp] ❌ ERROR: Falta configurar TWILIO_TEMPLATE_NUEVO_RECURSO_SID en tu .env`);
        return null;
    }

    try {
        const message = await client.messages.create({
            from: fromNumber,
            to: formattedTo,
            contentSid: templateNuevoRecursoSid,
            contentVariables: contentVariablesJson
        });
        console.log(`[WhatsApp] ✅ Template enviado a ${formattedTo}. SID: ${message.sid}`);
        return message.sid;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando a ${formattedTo}:`, error);
        return null;
    }
};
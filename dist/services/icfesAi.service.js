"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarExplicacionErrorIa = exports.generateQuestionsWithOpenAI = void 0;
const axios_1 = __importDefault(require("axios"));
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const icfesSchema_service_1 = require("./icfesSchema.service");
const zod_1 = require("zod");
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.4-nano';
const generatedQuestionsSchema = zod_1.z.object({
    preguntas: zod_1.z.array(zod_1.z.object({
        textoPregunta: zod_1.z.string().min(1),
        nombreCompetencia: zod_1.z.string().min(1),
        peso: zod_1.z.number().finite(),
        explicacionRespuesta: zod_1.z.string().optional(),
        opciones: zod_1.z.array(zod_1.z.object({
            letra: zod_1.z.enum(['A', 'B', 'C', 'D']),
            texto: zod_1.z.string().min(1),
            esCorrecta: zod_1.z.boolean(),
        })).length(4),
    })),
});
const parseJsonFromContent = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed);
    }
    const jsonBlock = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlock?.[1])
        return JSON.parse(jsonBlock[1]);
    const genericBlock = trimmed.match(/```\s*([\s\S]*?)\s*```/i);
    if (genericBlock?.[1])
        return JSON.parse(genericBlock[1]);
    throw new Error('No fue posible interpretar la respuesta JSON del modelo.');
};
const generateQuestionsWithOpenAI = async (payload, competencias) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY no esta configurada en el backend.');
    const competenciasTexto = competencias.map(c => `- ${c.nombre}: ${c.peso}%`).join('\n');
    const systemPrompt = [
        'Eres un experto evaluador del ICFES (Instituto Colombiano para la Evaluación de la Educación).',
        'Tu tarea es diseñar ítems de evaluación estrictamente bajo la metodología de Diseño Centrado en Evidencias (DCE) usada por el ICFES.',
        'ESTRUCTURA DEL ÍTEM: Cada pregunta DEBE tener un "Enunciado" que plantee una situación o problema cognitivo basado en el texto base, no una simple pregunta de memoria.',
        'OPCIONES DE RESPUESTA: Deben ser 4 opciones (A, B, C, D). Solo UNA es la Clave (respuesta correcta). Las otras tres son Distractores plausibles que representan errores de pensamiento comunes, no opciones absurdas.',
        'ENFOQUE EN COMPETENCIAS: Las preguntas no evalúan memoria, sino competencias (Interpretativa, Argumentativa, Propositiva). El estudiante debe analizar, deducir, inferir o evaluar críticamente la información del contexto proporcionado.',
        'Debes responder EXCLUSIVAMENTE en formato JSON válido, sin bloques de código markdown alrededor ni explicaciones fuera del JSON.'
    ].join(' ');
    const userPrompt = `Genera ${payload.cantidad} preguntas inéditas tipo ICFES basadas estrictamente en el siguiente texto base.

TEMA: ${payload.tema}
NIVEL DE DIFICULTAD: ${payload.dificultad}

TEXTO BASE (Contexto):
"""
${payload.textoBase}
"""

DISTRIBUCIÓN DE COMPETENCIAS OBJETIVO:
${competenciasTexto}

REGLAS DE GENERACIÓN:
1. El "textoPregunta" debe ser un enunciado tipo ICFES (ej: "A partir de lo planteado en el texto, se puede inferir que...", "El autor menciona [X] con el propósito de...", "Una conclusión válida frente al problema expuesto es...").
2. Evita preguntas literales básicas ("¿Qué año...?", "¿Quién hizo...?"). Prioriza el análisis crítico y la resolución de problemas.
3. Las opciones deben tener longitud similar y ser gramaticalmente concordantes con el enunciado.
4. "explicacionRespuesta" debe justificar por qué la opción correcta es la única válida y por qué los distractores, aunque plausibles, son incorrectos bajo la lógica del texto.

FORMATO ESTRICTO DE SALIDA JSON (respeta exactamente estas llaves):
{
  "preguntas": [
    {
      "textoPregunta": "...",
      "nombreCompetencia": "...",
      "peso": 10,
      "explicacionRespuesta": "...",
      "opciones": [
        {"letra":"A","texto":"...","esCorrecta":false},
        {"letra":"B","texto":"...","esCorrecta":true},
        {"letra":"C","texto":"...","esCorrecta":false},
        {"letra":"D","texto":"...","esCorrecta":false}
      ]
    }
  ]
}`;
    const response = await axios_1.default.post(OPENAI_URL, {
        model: OPENAI_MODEL,
        temperature: 0.7,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
    const content = response.data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string')
        throw new Error('OpenAI no devolvio contenido util.');
    const parsed = generatedQuestionsSchema.parse(parseJsonFromContent(content));
    return { preguntas: parsed.preguntas, systemPrompt };
};
exports.generateQuestionsWithOpenAI = generateQuestionsWithOpenAI;
const generarExplicacionErrorIa = async (intentoId, preguntaId, matriculaNo) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const cacheRs = await pool.request()
        .input('intentoId', mssql_1.default.Int, intentoId)
        .input('preguntaId', mssql_1.default.Int, preguntaId)
        .query(`
      SELECT TOP 1 Explicacion FROM Virtual.ICFES_ExplicacionesIA
      WHERE IntentoGlobalID = @intentoId AND PreguntaGlobalID = @preguntaId
      ORDER BY FechaCreacion DESC;
    `);
    if (cacheRs.recordset.length)
        return { explicacion: cacheRs.recordset[0].Explicacion, cached: true };
    const detalleRs = await pool.request()
        .input('intentoId', mssql_1.default.Int, intentoId)
        .input('preguntaId', mssql_1.default.Int, preguntaId)
        .input('matriculaNo', mssql_1.default.Int, matriculaNo)
        .query(`
      SELECT p.TextoPregunta, p.ExplicacionRespuesta, r.OpcionIDSeleccionada, r.EsCorrecta
      FROM Virtual.ICFES_RespuestasIntento r
      INNER JOIN Virtual.ICFES_IntentosGlobales i ON i.IntentoGlobalID = r.IntentoGlobalID
      INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = r.PreguntaGlobalID
      WHERE r.IntentoGlobalID = @intentoId AND r.PreguntaGlobalID = @preguntaId AND i.MatriculaNo = @matriculaNo;
    `);
    if (!detalleRs.recordset.length)
        throw new Error('No se encontro informacion de la pregunta en este intento.');
    const detalle = detalleRs.recordset[0];
    if (detalle.EsCorrecta)
        return { explicacion: 'Esta respuesta fue correcta. Buen trabajo.', cached: false };
    const opcionesRs = await pool.request().input('preguntaId', mssql_1.default.Int, preguntaId).query(`
    SELECT OpcionID, PreguntaGlobalID, Letra, TextoOpcion, EsCorrecta
    FROM Virtual.ICFES_OpcionesPregunta WHERE PreguntaGlobalID = @preguntaId ORDER BY Letra;
  `);
    const opcionSeleccionada = opcionesRs.recordset.find(o => o.OpcionID === detalle.OpcionIDSeleccionada);
    const opcionCorrecta = opcionesRs.recordset.find(o => o.EsCorrecta);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY no esta configurada en el backend.');
    const systemPrompt = 'Eres un tutor pedagogico experto en pruebas tipo ICFES. Explicas errores sin juzgar y propones mejoras concretas.';
    const userPrompt = `Pregunta: ${detalle.TextoPregunta}
Opcion elegida por estudiante: ${opcionSeleccionada?.Letra ?? 'N/A'} - ${opcionSeleccionada?.TextoOpcion ?? 'Sin respuesta'}
Opcion correcta: ${opcionCorrecta?.Letra ?? 'N/A'} - ${opcionCorrecta?.TextoOpcion ?? 'N/A'}
Explicacion docente/IA base de la correcta: ${detalle.ExplicacionRespuesta ?? 'No disponible'}
Responde en maximo 120 palabras con este formato: 1) Error principal cometido. 2) Por que la correcta si responde lo pedido. 3) Tip practico para no caer en esa trampa de nuevo.`;
    const aiRs = await axios_1.default.post(OPENAI_URL, { model: OPENAI_MODEL, temperature: 0.5, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 45000 });
    const explicacion = String(aiRs.data?.choices?.[0]?.message?.content ?? '').trim();
    if (!explicacion)
        throw new Error('No fue posible generar explicacion con IA.');
    await pool.request()
        .input('intentoId', mssql_1.default.Int, intentoId)
        .input('preguntaId', mssql_1.default.Int, preguntaId)
        .input('explicacion', mssql_1.default.NVarChar(mssql_1.default.MAX), explicacion)
        .input('modelo', mssql_1.default.NVarChar(100), OPENAI_MODEL)
        .query(`
      INSERT INTO Virtual.ICFES_ExplicacionesIA (IntentoGlobalID, PreguntaGlobalID, Explicacion, Modelo)
      VALUES (@intentoId, @preguntaId, @explicacion, @modelo);
    `);
    return { explicacion, cached: false };
};
exports.generarExplicacionErrorIa = generarExplicacionErrorIa;

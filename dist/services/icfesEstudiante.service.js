"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiagnosticoCompetencias = exports.getMisIntentosGlobales = exports.getRevisionIntentoGlobal = exports.entregarIntentoGlobal = exports.iniciarIntentoGlobal = void 0;
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const icfesSchema_service_1 = require("./icfesSchema.service");
const iniciarIntentoGlobal = async (examenId, matriculaNo) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const examenRs = await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).query('SELECT Publicado, FechaInicio, FechaCierre, NumeroIntentos FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId;');
        if (!examenRs.recordset.length)
            throw new Error('Examen global no encontrado.');
        const examen = examenRs.recordset[0];
        if (!examen.Publicado)
            throw new Error('El examen global no esta publicado.');
        const now = new Date();
        if (now < new Date(examen.FechaInicio) || now > new Date(examen.FechaCierre))
            throw new Error('El examen global no esta disponible en este momento.');
        const intentosRs = await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).input('matriculaNo', mssql_1.default.Int, matriculaNo).query('SELECT COUNT(*) AS total FROM Virtual.ICFES_IntentosGlobales WHERE ExamenGlobalID = @examenId AND MatriculaNo = @matriculaNo;');
        if (Number(intentosRs.recordset[0]?.total ?? 0) >= Number(examen.NumeroIntentos))
            throw new Error('Ya agotaste el numero de intentos para este examen global.');
        const intentoRs = await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).input('matriculaNo', mssql_1.default.Int, matriculaNo).query("INSERT INTO Virtual.ICFES_IntentosGlobales (ExamenGlobalID, MatriculaNo, Estado, FechaInicio) OUTPUT INSERTED.IntentoGlobalID VALUES (@examenId, @matriculaNo, 'Iniciado', GETDATE());");
        await tx.commit();
        return { intentoGlobalId: intentoRs.recordset[0].IntentoGlobalID };
    }
    catch (error) {
        await tx.rollback();
        throw error;
    }
};
exports.iniciarIntentoGlobal = iniciarIntentoGlobal;
const entregarIntentoGlobal = async (intentoId, matriculaNo, respuestas, duracionSegundos) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const intentoRs = await new mssql_1.default.Request(tx).input('intentoId', mssql_1.default.Int, intentoId).input('matriculaNo', mssql_1.default.Int, matriculaNo).query("SELECT i.ExamenGlobalID, i.Estado, e.FechaCierre FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID WHERE i.IntentoGlobalID = @intentoId AND i.MatriculaNo = @matriculaNo;");
        if (!intentoRs.recordset.length)
            throw new Error('Intento global no encontrado.');
        const intento = intentoRs.recordset[0];
        if (intento.Estado !== 'Iniciado')
            throw new Error('Este intento ya fue entregado.');
        if (new Date() > new Date(intento.FechaCierre))
            throw new Error('El examen global ya cerro.');
        const preguntasRs = await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, intento.ExamenGlobalID).query("SELECT p.PreguntaGlobalID, p.Peso, o.OpcionID, o.EsCorrecta FROM Virtual.ICFES_Preguntas p INNER JOIN Virtual.ICFES_OpcionesPregunta o ON o.PreguntaGlobalID = p.PreguntaGlobalID WHERE p.ExamenGlobalID = @examenId;");
        const opcionesByPregunta = new Map();
        for (const row of preguntasRs.recordset) {
            const current = opcionesByPregunta.get(row.PreguntaGlobalID) ?? [];
            current.push({ opcionId: row.OpcionID, esCorrecta: Boolean(row.EsCorrecta), peso: Number(row.Peso) });
            opcionesByPregunta.set(row.PreguntaGlobalID, current);
        }
        let puntaje = 0;
        await new mssql_1.default.Request(tx).input('intentoId', mssql_1.default.Int, intentoId).query('DELETE FROM Virtual.ICFES_RespuestasIntento WHERE IntentoGlobalID = @intentoId;');
        for (const [preguntaId, options] of opcionesByPregunta.entries()) {
            const respuesta = respuestas.find(r => r.preguntaGlobalId === preguntaId);
            const seleccionada = respuesta?.opcionId ?? null;
            const correcta = options.find(o => o.esCorrecta);
            const esCorrecta = Boolean(correcta && seleccionada === correcta.opcionId);
            const peso = Number(options[0]?.peso ?? 0);
            const puntajePregunta = esCorrecta ? peso : 0;
            puntaje += puntajePregunta;
            await new mssql_1.default.Request(tx).input('intentoId', mssql_1.default.Int, intentoId).input('preguntaId', mssql_1.default.Int, preguntaId).input('opcionId', mssql_1.default.Int, seleccionada).input('esCorrecta', mssql_1.default.Bit, esCorrecta ? 1 : 0).input('puntaje', mssql_1.default.Decimal(5, 2), puntajePregunta).query("INSERT INTO Virtual.ICFES_RespuestasIntento (IntentoGlobalID, PreguntaGlobalID, OpcionIDSeleccionada, EsCorrecta, PuntajeObtenido) VALUES (@intentoId, @preguntaId, @opcionId, @esCorrecta, @puntaje);");
        }
        const calificacion = (puntaje / 100) * 5;
        await new mssql_1.default.Request(tx).input('intentoId', mssql_1.default.Int, intentoId).input('calificacion', mssql_1.default.Decimal(4, 2), calificacion).input('duracion', mssql_1.default.Int, typeof duracionSegundos === 'number' ? duracionSegundos : null).query("UPDATE Virtual.ICFES_IntentosGlobales SET Estado = 'Calificado', FechaEntrega = GETDATE(), Calificacion = @calificacion, DuracionSegundos = @duracion WHERE IntentoGlobalID = @intentoId;");
        await tx.commit();
        return { intentoGlobalId: intentoId, calificacion, estado: 'Calificado' };
    }
    catch (error) {
        await tx.rollback();
        throw error;
    }
};
exports.entregarIntentoGlobal = entregarIntentoGlobal;
const getRevisionIntentoGlobal = async (intentoId, matriculaNo) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const intentoRs = await pool.request().input('intentoId', mssql_1.default.Int, intentoId).input('matriculaNo', mssql_1.default.Int, matriculaNo).query("SELECT IntentoGlobalID, ExamenGlobalID, Estado, Calificacion, FechaEntrega FROM Virtual.ICFES_IntentosGlobales WHERE IntentoGlobalID = @intentoId AND MatriculaNo = @matriculaNo;");
    if (!intentoRs.recordset.length)
        throw new Error('Intento no encontrado.');
    const base = intentoRs.recordset[0];
    const preguntasRs = await pool.request().input('examenId', mssql_1.default.Int, base.ExamenGlobalID).query("SELECT p.PreguntaGlobalID, p.ExamenGlobalID, p.CompetenciaID, c.NombreCompetencia, p.TextoPregunta, p.Peso, p.ExplicacionRespuesta, p.Orden FROM Virtual.ICFES_Preguntas p LEFT JOIN Virtual.ICFES_CompetenciasExamen c ON c.CompetenciaID = p.CompetenciaID WHERE p.ExamenGlobalID = @examenId ORDER BY p.Orden, p.PreguntaGlobalID;");
    const opcionesRs = await pool.request().input('examenId', mssql_1.default.Int, base.ExamenGlobalID).query("SELECT o.OpcionID, o.PreguntaGlobalID, o.Letra, o.TextoOpcion, o.EsCorrecta FROM Virtual.ICFES_OpcionesPregunta o INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = o.PreguntaGlobalID WHERE p.ExamenGlobalID = @examenId ORDER BY o.PreguntaGlobalID, o.Letra;");
    const respuestasRs = await pool.request().input('intentoId', mssql_1.default.Int, intentoId).query("SELECT PreguntaGlobalID, OpcionIDSeleccionada, EsCorrecta, PuntajeObtenido FROM Virtual.ICFES_RespuestasIntento WHERE IntentoGlobalID = @intentoId;");
    const opcionesByPregunta = new Map();
    for (const op of opcionesRs.recordset) {
        const current = opcionesByPregunta.get(op.PreguntaGlobalID) ?? [];
        current.push(op);
        opcionesByPregunta.set(op.PreguntaGlobalID, current);
    }
    const respuestasByPregunta = new Map();
    for (const r of respuestasRs.recordset) {
        respuestasByPregunta.set(r.PreguntaGlobalID, { opcionIdSeleccionada: r.OpcionIDSeleccionada, esCorrecta: Boolean(r.EsCorrecta), puntaje: Number(r.PuntajeObtenido ?? 0) });
    }
    return {
        intentoGlobalId: base.IntentoGlobalID,
        examenGlobalId: base.ExamenGlobalID,
        estado: base.Estado,
        calificacion: Number(base.Calificacion ?? 0),
        fechaEntrega: base.FechaEntrega,
        preguntas: preguntasRs.recordset.map(p => {
            const r = respuestasByPregunta.get(p.PreguntaGlobalID);
            return {
                preguntaGlobalId: p.PreguntaGlobalID,
                textoPregunta: p.TextoPregunta,
                nombreCompetencia: p.NombreCompetencia ?? 'General',
                peso: Number(p.Peso),
                seleccionada: r?.opcionIdSeleccionada ?? null,
                esCorrecta: r?.esCorrecta ?? false,
                puntajeObtenido: r?.puntaje ?? 0,
                opciones: (opcionesByPregunta.get(p.PreguntaGlobalID) ?? []).map(op => ({ opcionId: op.OpcionID, letra: op.Letra, texto: op.TextoOpcion, esCorrecta: Boolean(op.EsCorrecta) })),
            };
        }),
    };
};
exports.getRevisionIntentoGlobal = getRevisionIntentoGlobal;
const getMisIntentosGlobales = async (matriculaNo) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().input('matriculaNo', mssql_1.default.Int, matriculaNo).query("SELECT i.IntentoGlobalID, i.ExamenGlobalID, i.Estado, i.FechaInicio, i.FechaEntrega, i.Calificacion, i.DuracionSegundos, e.Titulo, e.Periodicidad, e.Trimestre, e.Anio FROM Virtual.ICFES_IntentosGlobales i INNER JOIN Virtual.ICFES_ExamenesGlobales e ON e.ExamenGlobalID = i.ExamenGlobalID WHERE i.MatriculaNo = @matriculaNo ORDER BY i.FechaInicio DESC;");
    return result.recordset;
};
exports.getMisIntentosGlobales = getMisIntentosGlobales;
const getDiagnosticoCompetencias = async (matriculaNo) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().input('matriculaNo', mssql_1.default.Int, matriculaNo).query(`
    SELECT ISNULL(c.NombreCompetencia, 'General') AS NombreCompetencia, COUNT(*) AS TotalPreguntas, SUM(CASE WHEN ri.EsCorrecta = 1 THEN 1 ELSE 0 END) AS Correctas, SUM(ISNULL(ri.PuntajeObtenido, 0)) AS PuntajeObtenido, SUM(ISNULL(p.Peso, 0)) AS PuntajePosible
    FROM Virtual.ICFES_RespuestasIntento ri
    INNER JOIN Virtual.ICFES_IntentosGlobales i ON i.IntentoGlobalID = ri.IntentoGlobalID
    INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = ri.PreguntaGlobalID
    LEFT JOIN Virtual.ICFES_CompetenciasExamen c ON c.CompetenciaID = p.CompetenciaID
    WHERE i.MatriculaNo = @matriculaNo AND i.Estado = 'Calificado'
    GROUP BY ISNULL(c.NombreCompetencia, 'General') ORDER BY NombreCompetencia;
  `);
    return result.recordset.map(r => {
        const total = Number(r.TotalPreguntas ?? 0);
        const correctas = Number(r.Correctas ?? 0);
        const accuracy = total > 0 ? Math.round((correctas / total) * 100) : 0;
        const recommendation = accuracy >= 80 ? 'Fortaleza consolidada. Mantener practica con preguntas de mayor dificultad.' : accuracy >= 60 ? 'Nivel intermedio. Reforzar lectura cuidadosa de enunciados y descarte de distractores.' : 'Requiere refuerzo prioritario. Practicar conceptos base y simulacros guiados.';
        return { competencia: r.NombreCompetencia, totalPreguntas: total, correctas, porcentajeAcierto: accuracy, puntajeObtenido: Number(r.PuntajeObtenido ?? 0), puntajePosible: Number(r.PuntajePosible ?? 0), recommendation };
    });
};
exports.getDiagnosticoCompetencias = getDiagnosticoCompetencias;

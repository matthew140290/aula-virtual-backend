"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePreguntaGlobal = exports.deleteExamenGlobal = exports.getExamenGlobalPublicadoDetalle = exports.listExamenesGlobalesPublicados = exports.despublicarExamenGlobal = exports.publicarExamenGlobal = exports.updatePreguntaGlobal = exports.generarPreguntasIa = exports.getExamenGlobalDetalle = exports.listExamenesGlobales = exports.createExamenGlobal = exports.getPreguntasByExamen = exports.getCompetenciasByExamen = void 0;
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const icfesSchema_service_1 = require("./icfesSchema.service");
const icfesAi_service_1 = require("./icfesAi.service");
const normalizePesoTotal = (competencias) => {
    const total = competencias.reduce((acc, c) => acc + Number(c.peso || 0), 0);
    return Math.round(total * 100) / 100;
};
const getCompetenciasByExamen = async (examenId) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('examenId', mssql_1.default.Int, examenId)
        .query(`
      SELECT CompetenciaID, NombreCompetencia, Peso
      FROM Virtual.ICFES_CompetenciasExamen
      WHERE ExamenGlobalID = @examenId
      ORDER BY CompetenciaID;
    `);
    return result.recordset.map(c => ({
        competenciaId: c.CompetenciaID,
        nombre: c.NombreCompetencia,
        peso: Number(c.Peso),
    }));
};
exports.getCompetenciasByExamen = getCompetenciasByExamen;
const getPreguntasByExamen = async (examenId) => {
    const pool = await dbPool_1.poolPromise;
    const preguntasResult = await pool.request()
        .input('examenId', mssql_1.default.Int, examenId)
        .query(`
      SELECT p.PreguntaGlobalID, p.ExamenGlobalID, p.CompetenciaID,
             c.NombreCompetencia,
             p.TextoPregunta, p.Peso, p.ExplicacionRespuesta, p.Orden
      FROM Virtual.ICFES_Preguntas p
      LEFT JOIN Virtual.ICFES_CompetenciasExamen c ON c.CompetenciaID = p.CompetenciaID
      WHERE p.ExamenGlobalID = @examenId
      ORDER BY p.Orden, p.PreguntaGlobalID;
    `);
    const opcionesResult = await pool.request()
        .input('examenId', mssql_1.default.Int, examenId)
        .query(`
      SELECT o.OpcionID, o.PreguntaGlobalID, o.Letra, o.TextoOpcion, o.EsCorrecta
      FROM Virtual.ICFES_OpcionesPregunta o
      INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = o.PreguntaGlobalID
      WHERE p.ExamenGlobalID = @examenId
      ORDER BY o.PreguntaGlobalID, o.Letra;
    `);
    const opcionesByPregunta = new Map();
    for (const op of opcionesResult.recordset) {
        const current = opcionesByPregunta.get(op.PreguntaGlobalID) ?? [];
        current.push(op);
        opcionesByPregunta.set(op.PreguntaGlobalID, current);
    }
    return preguntasResult.recordset.map(p => ({
        preguntaGlobalId: p.PreguntaGlobalID,
        textoPregunta: p.TextoPregunta,
        nombreCompetencia: p.NombreCompetencia ?? 'General',
        peso: Number(p.Peso),
        explicacionRespuesta: p.ExplicacionRespuesta,
        orden: p.Orden,
        opciones: (opcionesByPregunta.get(p.PreguntaGlobalID) ?? []).map(op => ({
            opcionId: op.OpcionID,
            letra: op.Letra,
            texto: op.TextoOpcion,
            esCorrecta: Boolean(op.EsCorrecta),
        })),
    }));
};
exports.getPreguntasByExamen = getPreguntasByExamen;
const validatePublicacion = async (examenId) => {
    const preguntas = await (0, exports.getPreguntasByExamen)(examenId);
    if (preguntas.length === 0)
        throw new Error('No puedes publicar sin preguntas.');
    const totalPeso = preguntas.reduce((acc, p) => acc + Number(p.peso || 0), 0);
    if (Math.round(totalPeso * 100) / 100 !== 100)
        throw new Error('La suma de pesos de preguntas debe ser 100.');
    for (const p of preguntas) {
        if (p.opciones.length !== 4)
            throw new Error('Todas las preguntas deben tener 4 opciones.');
        if (p.opciones.filter(op => op.esCorrecta).length !== 1)
            throw new Error('Cada pregunta debe tener una sola opcion correcta.');
    }
};
const createExamenGlobal = async (payload, actor) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    if (normalizePesoTotal(payload.competencias) !== 100)
        throw new Error('El peso total de competencias debe ser 100.');
    if (payload.periodicidad === 'TRIMESTRAL' && !payload.trimestre)
        throw new Error('Indica el trimestre.');
    const fechaInicio = new Date(payload.fechaInicio);
    const fechaCierre = new Date(payload.fechaCierre);
    if (fechaCierre <= fechaInicio)
        throw new Error('Cierre debe ser posterior a inicio.');
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const examenResult = await new mssql_1.default.Request(tx)
            .input('titulo', mssql_1.default.NVarChar(255), payload.titulo)
            .input('descripcion', mssql_1.default.NVarChar(mssql_1.default.MAX), payload.descripcion ?? '')
            .input('periodicidad', mssql_1.default.NVarChar(20), payload.periodicidad)
            .input('trimestre', mssql_1.default.TinyInt, payload.periodicidad === 'TRIMESTRAL' ? payload.trimestre ?? null : null)
            .input('anio', mssql_1.default.SmallInt, payload.anio)
            .input('duracionMinutos', mssql_1.default.SmallInt, payload.duracionMinutos)
            .input('numeroIntentos', mssql_1.default.SmallInt, payload.numeroIntentos)
            .input('fechaInicio', mssql_1.default.DateTime, fechaInicio)
            .input('fechaCierre', mssql_1.default.DateTime, fechaCierre)
            .input('creadoPorCodigo', mssql_1.default.Int, actor.codigo)
            .input('creadoPorPerfil', mssql_1.default.NVarChar(100), actor.perfil)
            .query(`
        INSERT INTO Virtual.ICFES_ExamenesGlobales
          (Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado, Publicado, CreadoPorCodigo, CreadoPorPerfil)
        OUTPUT INSERTED.ExamenGlobalID
        VALUES (@titulo, @descripcion, @periodicidad, @trimestre, @anio, @duracionMinutos, @numeroIntentos, @fechaInicio, @fechaCierre, 'Borrador', 0, @creadoPorCodigo, @creadoPorPerfil);
      `);
        const examenId = examenResult.recordset[0].ExamenGlobalID;
        for (const c of payload.competencias) {
            await new mssql_1.default.Request(tx)
                .input('examenId', mssql_1.default.Int, examenId)
                .input('nombre', mssql_1.default.NVarChar(100), c.nombre)
                .input('peso', mssql_1.default.Decimal(5, 2), c.peso)
                .query('INSERT INTO Virtual.ICFES_CompetenciasExamen (ExamenGlobalID, NombreCompetencia, Peso) VALUES (@examenId, @nombre, @peso);');
        }
        await tx.commit();
        return { examenGlobalId: examenId };
    }
    catch (error) {
        await tx.rollback();
        throw error;
    }
};
exports.createExamenGlobal = createExamenGlobal;
const listExamenesGlobales = async () => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query(`
    SELECT ExamenGlobalID, Titulo, Periodicidad, Trimestre, Anio, Estado, Publicado, FechaInicio, FechaCierre, FechaCreacion
    FROM Virtual.ICFES_ExamenesGlobales ORDER BY FechaCreacion DESC;
  `);
    return result.recordset;
};
exports.listExamenesGlobales = listExamenesGlobales;
const getExamenGlobalDetalle = async (examenId) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const examenResult = await pool.request().input('examenId', mssql_1.default.Int, examenId).query(`
    SELECT ExamenGlobalID, Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado, Publicado, FechaCreacion, FechaActualizacion
    FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId;
  `);
    if (!examenResult.recordset.length)
        return null;
    const competencias = await (0, exports.getCompetenciasByExamen)(examenId);
    const preguntas = await (0, exports.getPreguntasByExamen)(examenId);
    return { ...examenResult.recordset[0], competencias, preguntas };
};
exports.getExamenGlobalDetalle = getExamenGlobalDetalle;
const generarPreguntasIa = async (examenId, payload, actor) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const competencias = await (0, exports.getCompetenciasByExamen)(examenId);
    if (!competencias.length)
        throw new Error('El examen no tiene competencias configuradas.');
    const { preguntas, systemPrompt } = await (0, icfesAi_service_1.generateQuestionsWithOpenAI)(payload, competencias);
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        if (payload.replaceDraft ?? true) {
            await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).query(`
        DELETE FROM Virtual.ICFES_OpcionesPregunta WHERE PreguntaGlobalID IN (SELECT PreguntaGlobalID FROM Virtual.ICFES_Preguntas WHERE ExamenGlobalID = @examenId);
        DELETE FROM Virtual.ICFES_Preguntas WHERE ExamenGlobalID = @examenId;
      `);
        }
        const competenciasMap = new Map();
        const compDb = await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).query(`
      SELECT CompetenciaID, NombreCompetencia FROM Virtual.ICFES_CompetenciasExamen WHERE ExamenGlobalID = @examenId;
    `);
        for (const c of compDb.recordset)
            competenciasMap.set(c.NombreCompetencia.trim().toLowerCase(), c.CompetenciaID);
        for (let index = 0; index < preguntas.length; index += 1) {
            const p = preguntas[index];
            const competenciaId = competenciasMap.get(p.nombreCompetencia.trim().toLowerCase()) ?? null;
            const pregRes = await new mssql_1.default.Request(tx)
                .input('examenId', mssql_1.default.Int, examenId).input('competenciaId', mssql_1.default.Int, competenciaId)
                .input('texto', mssql_1.default.NVarChar(mssql_1.default.MAX), p.textoPregunta).input('peso', mssql_1.default.Decimal(5, 2), p.peso)
                .input('explicacion', mssql_1.default.NVarChar(mssql_1.default.MAX), p.explicacionRespuesta ?? null).input('orden', mssql_1.default.Int, index + 1)
                .query(`
          INSERT INTO Virtual.ICFES_Preguntas (ExamenGlobalID, CompetenciaID, TextoPregunta, Peso, ExplicacionRespuesta, TipoPregunta, Fuente, Orden)
          OUTPUT INSERTED.PreguntaGlobalID VALUES (@examenId, @competenciaId, @texto, @peso, @explicacion, 'SeleccionUnica', 'IA', @orden);
        `);
            const pregId = pregRes.recordset[0].PreguntaGlobalID;
            for (const op of p.opciones) {
                await new mssql_1.default.Request(tx).input('preguntaId', mssql_1.default.Int, pregId).input('letra', mssql_1.default.Char(1), op.letra)
                    .input('texto', mssql_1.default.NVarChar(mssql_1.default.MAX), op.texto).input('correcta', mssql_1.default.Bit, op.esCorrecta ? 1 : 0)
                    .query(`INSERT INTO Virtual.ICFES_OpcionesPregunta (PreguntaGlobalID, Letra, TextoOpcion, EsCorrecta) VALUES (@preguntaId, @letra, @texto, @correcta);`);
            }
        }
        await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).input('tema', mssql_1.default.NVarChar(200), payload.tema)
            .input('textoBase', mssql_1.default.NVarChar(mssql_1.default.MAX), payload.textoBase).input('dificultad', mssql_1.default.NVarChar(20), payload.dificultad)
            .input('cantidad', mssql_1.default.Int, payload.cantidad).input('modelo', mssql_1.default.NVarChar(100), process.env.OPENAI_MODEL ?? 'gpt-4o-mini')
            .input('promptSistema', mssql_1.default.NVarChar(mssql_1.default.MAX), systemPrompt).input('creadoPorCodigo', mssql_1.default.Int, actor.codigo)
            .query(`INSERT INTO Virtual.ICFES_GeneracionesIA (ExamenGlobalID, Tema, TextoBase, Dificultad, Cantidad, Modelo, PromptSistema, CreadoPorCodigo) VALUES (@examenId, @tema, @textoBase, @dificultad, @cantidad, @modelo, @promptSistema, @creadoPorCodigo);`);
        await tx.commit();
    }
    catch (error) {
        await tx.rollback();
        throw error;
    }
    return (0, exports.getPreguntasByExamen)(examenId);
};
exports.generarPreguntasIa = generarPreguntasIa;
const updatePreguntaGlobal = async (preguntaId, payload) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    if (payload.opciones.filter(o => o.esCorrecta).length !== 1)
        throw new Error('Debe existir una sola opcion correcta.');
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        const pregRes = await new mssql_1.default.Request(tx).input('preguntaId', mssql_1.default.Int, preguntaId).query('SELECT ExamenGlobalID FROM Virtual.ICFES_Preguntas WHERE PreguntaGlobalID = @preguntaId;');
        if (!pregRes.recordset.length)
            throw new Error('Pregunta global no encontrada.');
        const examenId = pregRes.recordset[0].ExamenGlobalID;
        const compRes = await new mssql_1.default.Request(tx).input('examenId', mssql_1.default.Int, examenId).input('nombre', mssql_1.default.NVarChar(100), payload.nombreCompetencia).query('SELECT TOP 1 CompetenciaID FROM Virtual.ICFES_CompetenciasExamen WHERE ExamenGlobalID = @examenId AND LOWER(NombreCompetencia) = LOWER(@nombre);');
        const competenciaId = compRes.recordset[0]?.CompetenciaID ?? null;
        await new mssql_1.default.Request(tx).input('preguntaId', mssql_1.default.Int, preguntaId).input('competenciaId', mssql_1.default.Int, competenciaId).input('texto', mssql_1.default.NVarChar(mssql_1.default.MAX), payload.textoPregunta).input('peso', mssql_1.default.Decimal(5, 2), payload.peso).input('explicacion', mssql_1.default.NVarChar(mssql_1.default.MAX), payload.explicacionRespuesta ?? null).query(`UPDATE Virtual.ICFES_Preguntas SET CompetenciaID = @competenciaId, TextoPregunta = @texto, Peso = @peso, ExplicacionRespuesta = @explicacion, Fuente = 'Manual' WHERE PreguntaGlobalID = @preguntaId;`);
        await new mssql_1.default.Request(tx).input('preguntaId', mssql_1.default.Int, preguntaId).query('DELETE FROM Virtual.ICFES_OpcionesPregunta WHERE PreguntaGlobalID = @preguntaId;');
        for (const op of payload.opciones) {
            await new mssql_1.default.Request(tx).input('preguntaId', mssql_1.default.Int, preguntaId).input('letra', mssql_1.default.Char(1), op.letra).input('texto', mssql_1.default.NVarChar(mssql_1.default.MAX), op.texto).input('correcta', mssql_1.default.Bit, op.esCorrecta ? 1 : 0).query('INSERT INTO Virtual.ICFES_OpcionesPregunta (PreguntaGlobalID, Letra, TextoOpcion, EsCorrecta) VALUES (@preguntaId, @letra, @texto, @correcta);');
        }
        await tx.commit();
    }
    catch (error) {
        await tx.rollback();
        throw error;
    }
};
exports.updatePreguntaGlobal = updatePreguntaGlobal;
const publicarExamenGlobal = async (examenId) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    await validatePublicacion(examenId);
    const pool = await dbPool_1.poolPromise;
    await pool.request().input('examenId', mssql_1.default.Int, examenId).query("UPDATE Virtual.ICFES_ExamenesGlobales SET Publicado = 1, Estado = 'Publicado', FechaActualizacion = GETDATE() WHERE ExamenGlobalID = @examenId;");
};
exports.publicarExamenGlobal = publicarExamenGlobal;
const despublicarExamenGlobal = async (examenId) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    await pool.request().input('examenId', mssql_1.default.Int, examenId).query("UPDATE Virtual.ICFES_ExamenesGlobales SET Publicado = 0, Estado = 'Borrador', FechaActualizacion = GETDATE() WHERE ExamenGlobalID = @examenId;");
};
exports.despublicarExamenGlobal = despublicarExamenGlobal;
const listExamenesGlobalesPublicados = async () => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query("SELECT ExamenGlobalID, Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado FROM Virtual.ICFES_ExamenesGlobales WHERE Publicado = 1 ORDER BY FechaInicio DESC;");
    return result.recordset;
};
exports.listExamenesGlobalesPublicados = listExamenesGlobalesPublicados;
const getExamenGlobalPublicadoDetalle = async (examenId) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    const examenResult = await pool.request().input('examenId', mssql_1.default.Int, examenId).query("SELECT ExamenGlobalID, Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado, Publicado FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId AND Publicado = 1;");
    if (!examenResult.recordset.length)
        return null;
    const examen = examenResult.recordset[0];
    const competencias = await (0, exports.getCompetenciasByExamen)(examenId);
    const preguntas = await (0, exports.getPreguntasByExamen)(examenId);
    return {
        ...examen,
        competencias,
        preguntas: preguntas.map(p => ({
            preguntaGlobalId: p.preguntaGlobalId,
            textoPregunta: p.textoPregunta,
            nombreCompetencia: p.nombreCompetencia,
            peso: p.peso,
            orden: p.orden,
            opciones: p.opciones.map(op => ({ opcionId: op.opcionId, letra: op.letra, texto: op.texto })),
        })),
    };
};
exports.getExamenGlobalPublicadoDetalle = getExamenGlobalPublicadoDetalle;
const deleteExamenGlobal = async (examenId) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('examenId', mssql_1.default.Int, examenId)
        .query('DELETE FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId;');
};
exports.deleteExamenGlobal = deleteExamenGlobal;
const deletePreguntaGlobal = async (preguntaId) => {
    await (0, icfesSchema_service_1.ensureIcfesSchema)();
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('preguntaId', mssql_1.default.Int, preguntaId)
        .query('DELETE FROM Virtual.ICFES_Preguntas WHERE PreguntaGlobalID = @preguntaId;');
};
exports.deletePreguntaGlobal = deletePreguntaGlobal;

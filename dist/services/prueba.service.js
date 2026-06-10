"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndSetPublicadoReturningRecurso = exports.getPublicacionesByRecursoIds = exports.getPublicacionByRecursoId = exports.createSimulacro = exports.validateAndSetPublicado = exports.setResultadoCalificacion = exports.deleteSimulacroById = exports.getResultadosReales = exports.getResultadosSimulacro = exports.getEstudiantesParaPrueba = exports.deletePregunta = exports.updatePruebaConfig = exports.updatePregunta = exports.addPreguntaToPrueba = exports.setPruebaPublicado = exports.updatePruebaCompetencia = exports.setPruebaFinalizada = exports.heartbeatPrueba = exports.getPruebaDetalles = exports.abandonarPrueba = exports.entregarPrueba = exports.iniciarPrueba = exports.addPreguntaToBanco = exports.getBancoPreguntas = void 0;
// src/services/prueba.service.ts
const dbPool_1 = require("../config/dbPool");
const mssql_1 = __importDefault(require("mssql"));
const HEARTBEAT_INTERVAL_SECONDS = 15;
const HEARTBEAT_TIMEOUT_SECONDS = 60;
const ensurePruebaResultadosSessionSchema = async () => {
    const pool = await dbPool_1.poolPromise;
    await pool.request().query(`
    IF COL_LENGTH('Virtual.PruebasResultados', 'UltimoHeartbeat') IS NULL
    BEGIN
      ALTER TABLE Virtual.PruebasResultados
      ADD UltimoHeartbeat DATETIME NULL;
    END;

    IF COL_LENGTH('Virtual.PruebasResultados', 'AbandonadoPorInactividad') IS NULL
    BEGIN
      ALTER TABLE Virtual.PruebasResultados
      ADD AbandonadoPorInactividad BIT NOT NULL CONSTRAINT DF_PruebasResultados_Abandono DEFAULT 0;
    END;
  `);
};
const expirarIntentosInactivos = async (pruebaId) => {
    await ensurePruebaResultadosSessionSchema();
    const pool = await dbPool_1.poolPromise;
    const request = pool.request()
        .input('timeoutSegundos', mssql_1.default.Int, HEARTBEAT_TIMEOUT_SECONDS);
    let filtro = '';
    if (Number.isFinite(pruebaId)) {
        request.input('pruebaId', mssql_1.default.Int, Number(pruebaId));
        filtro = 'AND r.PruebaID = @pruebaId';
    }
    await request.query(`
    UPDATE r
    SET
      r.Estado = 'Entregado',
      r.CalificacionFinal = 0,
      r.RequiereCalificacionManual = 0,
      r.FechaEntrega = ISNULL(r.FechaEntrega, GETDATE()),
      r.AbandonadoPorInactividad = 1
    FROM Virtual.PruebasResultados r
    WHERE r.Estado = 'Iniciado'
      ${filtro}
      AND DATEDIFF(
        SECOND,
        ISNULL(r.UltimoHeartbeat, ISNULL(r.FechaEntrega, GETDATE())),
        GETDATE()
      ) >= @timeoutSegundos;
  `);
};
const TIPOS_PREGUNTA_VALIDOS = [
    'SeleccionUnica',
    'SeleccionMultiple',
    'VerdaderoFalso',
    'Relacionar',
    'Ensayo',
];
const ensureBancoPreguntasSchema = async () => {
    const pool = await dbPool_1.poolPromise;
    await pool.request().query(`
    IF OBJECT_ID('Virtual.BancoPreguntas', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.BancoPreguntas (
        PreguntaBancoID INT IDENTITY(1,1) PRIMARY KEY,
        TextoPregunta NVARCHAR(MAX) NOT NULL,
        TipoPregunta NVARCHAR(50) NOT NULL,
        CreadoPorCodigo INT NULL,
        CreadoPorPerfil NVARCHAR(50) NULL,
        FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        Activo BIT NOT NULL DEFAULT 1
      );
      CREATE INDEX IX_BancoPreguntas_FechaCreacion ON Virtual.BancoPreguntas(FechaCreacion DESC);
    END;

    IF OBJECT_ID('Virtual.BancoPreguntasRespuestas', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.BancoPreguntasRespuestas (
        RespuestaBancoID INT IDENTITY(1,1) PRIMARY KEY,
        PreguntaBancoID INT NOT NULL,
        TextoRespuesta NVARCHAR(MAX) NULL,
        TextoRespuestaPar NVARCHAR(MAX) NULL,
        EsCorrecta BIT NOT NULL DEFAULT 0,
        Orden SMALLINT NOT NULL DEFAULT 1,
        CONSTRAINT FK_BancoPreguntasRespuestas_Pregunta FOREIGN KEY (PreguntaBancoID)
          REFERENCES Virtual.BancoPreguntas(PreguntaBancoID) ON DELETE CASCADE
      );
      CREATE INDEX IX_BancoPreguntasRespuestas_PreguntaID ON Virtual.BancoPreguntasRespuestas(PreguntaBancoID, Orden);
    END;
  `);
};
const validarPreguntaBanco = (pregunta) => {
    const texto = String(pregunta.TextoPregunta || '').trim();
    if (!texto) {
        throw new Error('El enunciado de la pregunta es obligatorio.');
    }
    if (!TIPOS_PREGUNTA_VALIDOS.includes(pregunta.TipoPregunta)) {
        throw new Error('Tipo de pregunta no soportado.');
    }
    if (pregunta.TipoPregunta === 'Ensayo') {
        return;
    }
    if (!Array.isArray(pregunta.Respuestas) || pregunta.Respuestas.length === 0) {
        throw new Error('La pregunta debe incluir al menos una respuesta.');
    }
    const respuestasInvalidas = pregunta.Respuestas.some((respuesta) => {
        const textoRespuesta = String(respuesta.TextoRespuesta || '').trim();
        if (!textoRespuesta)
            return true;
        if (pregunta.TipoPregunta === 'Relacionar') {
            return !String(respuesta.TextoRespuestaPar || '').trim();
        }
        return false;
    });
    if (respuestasInvalidas) {
        throw new Error('Todas las respuestas del banco deben tener contenido válido.');
    }
    const tieneCorrecta = pregunta.Respuestas.some((respuesta) => Boolean(respuesta.EsCorrecta));
    if (!tieneCorrecta) {
        throw new Error('Debes marcar al menos una respuesta correcta.');
    }
};
const getBancoPreguntas = async () => {
    await ensureBancoPreguntasSchema();
    const pool = await dbPool_1.poolPromise;
    const preguntasResult = await pool.request().query(`
    SELECT PreguntaBancoID, TextoPregunta, TipoPregunta, FechaCreacion
    FROM Virtual.BancoPreguntas
    WHERE Activo = 1
    ORDER BY FechaCreacion DESC;
  `);
    if (preguntasResult.recordset.length === 0) {
        return [];
    }
    const respuestasResult = await pool.request().query(`
    SELECT
      PreguntaBancoID,
      RespuestaBancoID as RespuestaID,
      ISNULL(TextoRespuesta, '') as TextoRespuesta,
      TextoRespuestaPar,
      EsCorrecta
    FROM Virtual.BancoPreguntasRespuestas
    ORDER BY PreguntaBancoID, Orden, RespuestaBancoID;
  `);
    const respuestasPorPregunta = new Map();
    for (const fila of respuestasResult.recordset) {
        const actuales = respuestasPorPregunta.get(fila.PreguntaBancoID) || [];
        actuales.push({
            RespuestaID: fila.RespuestaID,
            TextoRespuesta: fila.TextoRespuesta,
            TextoRespuestaPar: fila.TextoRespuestaPar,
            EsCorrecta: Boolean(fila.EsCorrecta),
        });
        respuestasPorPregunta.set(fila.PreguntaBancoID, actuales);
    }
    return preguntasResult.recordset.map((pregunta) => ({
        PreguntaBancoID: pregunta.PreguntaBancoID,
        TextoPregunta: pregunta.TextoPregunta,
        TipoPregunta: pregunta.TipoPregunta,
        FechaCreacion: pregunta.FechaCreacion,
        Respuestas: respuestasPorPregunta.get(pregunta.PreguntaBancoID) || [],
    }));
};
exports.getBancoPreguntas = getBancoPreguntas;
const addPreguntaToBanco = async (pregunta, actor) => {
    validarPreguntaBanco(pregunta);
    await ensureBancoPreguntasSchema();
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const preguntaResult = await new mssql_1.default.Request(transaction)
            .input('textoPregunta', mssql_1.default.NVarChar(mssql_1.default.MAX), String(pregunta.TextoPregunta).trim())
            .input('tipoPregunta', mssql_1.default.NVarChar(50), pregunta.TipoPregunta)
            .input('creadoPorCodigo', mssql_1.default.Int, actor?.codigo ?? null)
            .input('creadoPorPerfil', mssql_1.default.NVarChar(50), actor?.perfil ?? null)
            .query(`
        INSERT INTO Virtual.BancoPreguntas (TextoPregunta, TipoPregunta, CreadoPorCodigo, CreadoPorPerfil)
        OUTPUT INSERTED.PreguntaBancoID
        VALUES (@textoPregunta, @tipoPregunta, @creadoPorCodigo, @creadoPorPerfil);
      `);
        const preguntaBancoId = preguntaResult.recordset[0].PreguntaBancoID;
        if (pregunta.TipoPregunta !== 'Ensayo' && Array.isArray(pregunta.Respuestas)) {
            let orden = 1;
            for (const respuesta of pregunta.Respuestas) {
                await new mssql_1.default.Request(transaction)
                    .input('preguntaBancoId', mssql_1.default.Int, preguntaBancoId)
                    .input('textoRespuesta', mssql_1.default.NVarChar(mssql_1.default.MAX), String(respuesta.TextoRespuesta || '').trim())
                    .input('textoRespuestaPar', mssql_1.default.NVarChar(mssql_1.default.MAX), respuesta.TextoRespuestaPar?.trim() || null)
                    .input('esCorrecta', mssql_1.default.Bit, respuesta.EsCorrecta ? 1 : 0)
                    .input('orden', mssql_1.default.SmallInt, orden)
                    .query(`
            INSERT INTO Virtual.BancoPreguntasRespuestas
              (PreguntaBancoID, TextoRespuesta, TextoRespuestaPar, EsCorrecta, Orden)
            VALUES
              (@preguntaBancoId, @textoRespuesta, @textoRespuestaPar, @esCorrecta, @orden);
          `);
                orden += 1;
            }
        }
        await transaction.commit();
        return { preguntaBancoId };
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
};
exports.addPreguntaToBanco = addPreguntaToBanco;
const iniciarPrueba = async (pruebaId, matriculaNo, contrasenaIngresada) => {
    await expirarIntentosInactivos(pruebaId);
    await ensurePruebaResultadosSessionSchema();
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    const matriculaNormalizada = Math.abs(matriculaNo);
    try {
        await transaction.begin();
        // 1. Validaciones de Reglas de Negocio
        const pruebaInfo = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .query(`
                SELECT PruebaID, RecursoID, NumeroIntentos, FechaInicio, FechaCierre, Publicado, Finalizada, Contrasena
                FROM Virtual.Pruebas
                WHERE PruebaID = @pruebaId
            `);
        if (pruebaInfo.recordset.length === 0) {
            throw new Error('La prueba no existe.');
        }
        const info = pruebaInfo.recordset[0];
        const now = new Date();
        if (!info.Publicado) {
            throw new Error('La prueba aún no ha sido publicada.');
        }
        const requiereContrasena = typeof info.Contrasena === 'string' && info.Contrasena.trim().length > 0;
        if (requiereContrasena && String(contrasenaIngresada || '') !== String(info.Contrasena)) {
            throw new Error('La contraseña de la prueba es incorrecta.');
        }
        const accesoPersonalizado = await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, Number(info.RecursoID))
            .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
            .query(`
                SELECT
                    CASE WHEN EXISTS (
                        SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = @recursoId
                    ) THEN 1 ELSE 0 END AS EsPersonalizado,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM Virtual.RecursosEstudiantes re
                        WHERE re.RecursoID = @recursoId AND ABS(re.MatriculaNo) = @matriculaNo
                    ) THEN 1 ELSE 0 END AS Permitido;
            `);
        if (accesoPersonalizado.recordset[0]?.EsPersonalizado === 1 && accesoPersonalizado.recordset[0]?.Permitido !== 1) {
            throw new Error('No tienes permisos para iniciar esta prueba.');
        }
        if (now < new Date(info.FechaInicio) || now > new Date(info.FechaCierre)) {
            throw new Error('La prueba no está disponible en este momento.');
        }
        const enProgreso = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNormalizada)
            .query(`
                SELECT TOP 1 ResultadoID
                FROM Virtual.PruebasResultados
                WHERE PruebaID = @pruebaId
                  AND ABS(MatriculaNo) = @matriculaNo
                  AND Estado = 'Iniciado'
                ORDER BY ResultadoID DESC
            `);
        if (enProgreso.recordset.length > 0) {
            await transaction.commit();
            return { resultadoId: enProgreso.recordset[0].ResultadoID, retomado: true };
        }
        // 2. Contar intentos PREVIOS (sin contar el que vamos a crear)
        const intentosPrevios = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNormalizada)
            .query(`
                SELECT COUNT(*) as count
                FROM Virtual.PruebasResultados
                WHERE PruebaID = @pruebaId
                  AND ABS(MatriculaNo) = @matriculaNo
                  AND Estado IN ('Pendiente', 'Calificado', 'Entregado')
            `);
        if (info.NumeroIntentos > 0 && intentosPrevios.recordset[0].count >= info.NumeroIntentos) {
            throw new Error('Has superado el número máximo de intentos.');
        }
        // 3. CREAR EL INTENTO (Estado 'Iniciado')
        // Esto "quema" el intento inmediatamente.
        const insert = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('matriculaNo', mssql_1.default.Int, matriculaNormalizada)
            .input('fechaReferencia', mssql_1.default.DateTime, now)
            .query(`
                INSERT INTO Virtual.PruebasResultados 
                (PruebaID, MatriculaNo, FechaEntrega, UltimoHeartbeat, Estado, CalificacionFinal, RequiereCalificacionManual, AbandonadoPorInactividad)
                OUTPUT INSERTED.ResultadoID
                VALUES 
                (@pruebaId, @matriculaNo, @fechaReferencia, @fechaReferencia, 'Iniciado', 0, 0, 0);
            `);
        const resultadoId = insert.recordset[0].ResultadoID;
        await transaction.commit();
        return { resultadoId, retomado: false };
    }
    catch (err) {
        await transaction.rollback();
        throw err;
    }
};
exports.iniciarPrueba = iniciarPrueba;
const entregarPrueba = async (resultadoId, respuestas, duracionSegundos, matriculaNo) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        // A. Obtener datos de la prueba a través del resultadoId
        const datosPrueba = await new mssql_1.default.Request(transaction)
            .input('resultadoId', mssql_1.default.Int, resultadoId)
            .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
            .query(`
                SELECT p.PruebaID, p.RecursoID, p.TipoExamen, p.FechaCierre, p.ModoRevision, r.Estado
                FROM Virtual.PruebasResultados r
                JOIN Virtual.Pruebas p ON r.PruebaID = p.PruebaID
                WHERE r.ResultadoID = @resultadoId
                  AND ABS(r.MatriculaNo) = @matriculaNo
            `);
        if (datosPrueba.recordset.length === 0)
            throw new Error('Intento no encontrado o no autorizado.');
        const { PruebaID, RecursoID, TipoExamen, FechaCierre, ModoRevision, Estado } = datosPrueba.recordset[0];
        if (Estado !== 'Iniciado') {
            throw new Error('Este intento ya fue cerrado y no admite más envíos.');
        }
        // Validar fecha de cierre con tolerancia de 5 mins (latencia de red)
        if (new Date() > new Date(new Date(FechaCierre).getTime() + 5 * 60000)) {
            // Opcional: Podrías permitirlo pero marcarlo como tardío. Aquí lanzamos error.
            // throw new Error('El tiempo de la prueba ha expirado.');
        }
        // B. Obtener respuestas correctas de la BD
        const preguntasDB = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, PruebaID)
            .query(`
                SELECT p.PreguntaID, p.TextoPregunta, p.TipoPregunta, p.Porcentaje,
                       r.RespuestaID, r.TextoRespuesta, r.EsCorrecta, r.TextoRespuestaPar
                FROM Virtual.Pruebas_Preguntas p
                LEFT JOIN Virtual.Pruebas_Respuestas r ON p.PreguntaID = r.PreguntaID
                WHERE p.PruebaID = @pruebaId
            `);
        // Mapear preguntas para búsqueda rápida
        const mapaPreguntas = new Map();
        preguntasDB.recordset.forEach((row) => {
            if (!mapaPreguntas.has(row.PreguntaID)) {
                mapaPreguntas.set(row.PreguntaID, {
                    texto: row.TextoPregunta,
                    tipo: row.TipoPregunta,
                    peso: Number(row.Porcentaje),
                    respuestas: []
                });
            }
            if (row.RespuestaID !== null) {
                mapaPreguntas.get(row.PreguntaID).respuestas.push(row);
            }
        });
        // C. Algoritmo de Calificación
        let puntajeAcumulado = 0; // Escala 0 a 100
        let requiereManual = false;
        let respuestaEnsayoTexto = '';
        const detalleRevision = [];
        const mostrarRespuestas = ModoRevision === 'VerSoloRespuestas' || ModoRevision === 'VerAmbas';
        for (const respEstudiante of respuestas) {
            const infoPregunta = mapaPreguntas.get(respEstudiante.PreguntaID);
            if (!infoPregunta)
                continue;
            let esCorrecta = false;
            let puntajePregunta = 0;
            // Caso Ensayo: No suma puntos automáticos, marca para revisión manual
            if (infoPregunta.tipo === 'Ensayo') {
                requiereManual = true;
                if (respEstudiante.Texto) {
                    respuestaEnsayoTexto += `[ID:${respEstudiante.PreguntaID}] ${respEstudiante.Texto} ||| `;
                }
                continue;
            }
            // Lógica de calificación por tipo
            if (infoPregunta.tipo === 'SeleccionUnica' || infoPregunta.tipo === 'VerdaderoFalso') {
                const correctaDB = infoPregunta.respuestas.find(r => r.EsCorrecta);
                if (correctaDB && correctaDB.RespuestaID === respEstudiante.SelectedId) {
                    esCorrecta = true;
                }
            }
            else if (infoPregunta.tipo === 'SeleccionMultiple') {
                const correctasIds = infoPregunta.respuestas
                    .filter((r) => r.EsCorrecta === true && r.RespuestaID !== null)
                    .map(r => r.RespuestaID);
                const seleccionados = respEstudiante.SelectedIds || [];
                // Coincidencia exacta de arrays (sin orden)
                if (correctasIds.length === seleccionados.length &&
                    correctasIds.every(id => seleccionados.includes(id))) {
                    esCorrecta = true;
                }
            }
            else if (infoPregunta.tipo === 'Relacionar') {
                // Todo o nada
                const paresCorrectos = infoPregunta.respuestas;
                const paresEstudiante = respEstudiante.Pairs || [];
                let aciertos = 0;
                for (const parEst of paresEstudiante) {
                    const parDB = paresCorrectos.find(r => r.RespuestaID === parEst.leftId);
                    // Comparación insensible a mayúsculas/espacios
                    if (parDB && parDB.TextoRespuestaPar?.trim().toLowerCase() === parEst.rightText?.trim().toLowerCase()) {
                        aciertos++;
                    }
                }
                if (aciertos === paresCorrectos.length && aciertos > 0) {
                    esCorrecta = true;
                }
            }
            if (esCorrecta) {
                puntajeAcumulado += infoPregunta.peso;
                puntajePregunta = infoPregunta.peso;
            }
            // --- Construcción del Detalle de Revisión ---
            // Solo devolvemos datos sensibles si mostrarRespuestas es true
            if (mostrarRespuestas) {
                detalleRevision.push({
                    PreguntaID: respEstudiante.PreguntaID,
                    TextoPregunta: infoPregunta.texto,
                    TipoPregunta: infoPregunta.tipo,
                    EsCorrecta: esCorrecta,
                    PuntajeObtenido: puntajePregunta,
                    // Lo que respondió el estudiante (siempre se puede ver)
                    RespuestaEstudiante: respEstudiante,
                    // Opciones disponibles (para pintar el examen de nuevo)
                    Opciones: infoPregunta.respuestas.map(r => ({
                        RespuestaID: r.RespuestaID,
                        TextoRespuesta: r.TextoRespuesta,
                        // Marcamos cuál es la correcta SOLO si está permitido
                        EsCorrecta: mostrarRespuestas ? Boolean(r.EsCorrecta) : undefined,
                        TextoRespuestaPar: mostrarRespuestas ? r.TextoRespuestaPar : undefined
                    }))
                });
            }
        }
        // D. Cálculo Final de Nota (Escala 0.0 a 5.0)
        // Si el examen es 'Diagnostico' o 'Cognoscitiva' (sin nota), igual calculamos pero el front decide si mostrar.
        // Asumimos que la BD siempre guarda la nota por referencia.
        const calificacionFinal = (puntajeAcumulado / 100) * 5;
        // E. ACTUALIZAR REGISTRO (UPDATE)
        await new mssql_1.default.Request(transaction)
            .input('resultadoId', mssql_1.default.Int, resultadoId)
            .input('fechaEntrega', mssql_1.default.DateTime, new Date())
            .input('estado', mssql_1.default.NVarChar(40), requiereManual ? 'Pendiente' : 'Calificado')
            .input('calificacion', mssql_1.default.Decimal(5, 2), calificacionFinal)
            .input('manual', mssql_1.default.Bit, requiereManual)
            .input('ensayo', mssql_1.default.NVarChar(mssql_1.default.MAX), respuestaEnsayoTexto || null)
            .input('duracion', mssql_1.default.Int, duracionSegundos)
            .query(`
                UPDATE Virtual.PruebasResultados
                SET 
                    FechaEntrega = @fechaEntrega,
                    UltimoHeartbeat = @fechaEntrega,
                    Estado = @estado,
                    CalificacionFinal = @calificacion,
                    RequiereCalificacionManual = @manual,
                    RespuestaEnsayo = @ensayo,
                    DuracionSegundos = @duracion
                WHERE ResultadoID = @resultadoId;
            `);
        await transaction.commit();
        return {
            success: true,
            recursoId: RecursoID,
            calificacion: calificacionFinal,
            estado: requiereManual ? 'Pendiente' : 'Calificado',
            tipoExamen: TipoExamen,
            detalleRevision: detalleRevision,
            duracionSegundos: duracionSegundos
        };
    }
    catch (err) {
        await transaction.rollback();
        console.error("Error al entregar prueba:", err);
        throw err;
    }
};
exports.entregarPrueba = entregarPrueba;
const abandonarPrueba = async (pruebaId, resultadoId, matriculaNo, duracionSegundos) => {
    await ensurePruebaResultadosSessionSchema();
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('resultadoId', mssql_1.default.Int, resultadoId)
        .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
        .input('duracion', mssql_1.default.Int, Number.isFinite(duracionSegundos) ? Math.max(0, Math.floor(Number(duracionSegundos))) : null)
        .query(`
      UPDATE Virtual.PruebasResultados
      SET
        FechaEntrega = GETDATE(),
        Estado = 'Entregado',
        CalificacionFinal = 0,
        RequiereCalificacionManual = 0,
        DuracionSegundos = ISNULL(@duracion, ISNULL(DuracionSegundos, 0))
      WHERE ResultadoID = @resultadoId
        AND PruebaID = @pruebaId
        AND ABS(MatriculaNo) = @matriculaNo
        AND Estado = 'Iniciado';

      SELECT @@ROWCOUNT AS affected;
    `);
    return result.recordset[0]?.affected > 0;
};
exports.abandonarPrueba = abandonarPrueba;
// Obtener detalles completos de una prueba
const getPruebaDetalles = async (id, options = {}) => {
    const includeAnswers = options.includeAnswers ?? true;
    const includeSecret = options.includeSecret ?? true;
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('id', mssql_1.default.Int, id)
        .query(`
      SELECT 
        p.PruebaID, p.RecursoID, r.Titulo, r.Contenido, p.TipoPrueba, p.TipoExamen, p.DuracionMinutos,
        p.Contrasena, p.ModoRevision, p.NombreCompetencia, p.Publicado, r.FechaCreacion as FechaPublicacion,
        p.FechaInicio, p.FechaCierre,
        p.NumeroIntentos, 
        p.Finalizada
      FROM Virtual.Pruebas p
      JOIN Virtual.Recursos r ON p.RecursoID = r.RecursoID
      WHERE p.RecursoID = @id OR p.PruebaID = @id;
    `);
    if (result.recordset.length === 0)
        return undefined;
    const row = result.recordset[0];
    if (Number.isFinite(options.viewerMatriculaNo)) {
        const matriculaNo = Math.abs(Number(options.viewerMatriculaNo));
        const autorizacion = await pool.request()
            .input('pruebaId', mssql_1.default.Int, Number(row.PruebaID))
            .input('matriculaNo', mssql_1.default.Int, matriculaNo)
            .query(`
        SELECT CASE WHEN EXISTS (
          SELECT 1
          FROM Virtual.PruebasResultados pr
          WHERE pr.PruebaID = @pruebaId AND ABS(pr.MatriculaNo) = @matriculaNo
        ) THEN 1 ELSE 0 END AS Permitido;
      `);
        if (autorizacion.recordset[0]?.Permitido !== 1) {
            return undefined;
        }
    }
    const prueba = {
        ...row,
        Contrasena: includeSecret ? row.Contrasena : undefined,
        FechaPublicacion: new Date(row.FechaPublicacion),
        FechaInicio: new Date(row.FechaInicio),
        FechaCierre: new Date(row.FechaCierre),
        Preguntas: [],
        NumeroIntentos: row.NumeroIntentos ?? null,
        Finalizada: Boolean(result.recordset[0].Finalizada),
    };
    // Preguntas
    const preguntasResult = await pool.request()
        .input('pruebaId', mssql_1.default.Int, prueba.PruebaID)
        .query(`
      SELECT PreguntaID, TextoPregunta, TipoPregunta, Porcentaje
      FROM Virtual.Pruebas_Preguntas
      WHERE PruebaID = @pruebaId
      ORDER BY PreguntaID;
    `);
    for (const p of preguntasResult.recordset) {
        const respuestasResult = await pool.request()
            .input('preguntaId', mssql_1.default.Int, p.PreguntaID)
            .query(`
        SELECT RespuestaID, TextoRespuesta, TextoRespuestaPar, EsCorrecta
        FROM Virtual.Pruebas_Respuestas
        WHERE PreguntaID = @preguntaId
        ORDER BY RespuestaID;
      `);
        prueba.Preguntas.push({
            PreguntaID: p.PreguntaID,
            TextoPregunta: p.TextoPregunta,
            TipoPregunta: p.TipoPregunta,
            Porcentaje: p.Porcentaje,
            Respuestas: respuestasResult.recordset.map((r) => ({
                RespuestaID: r.RespuestaID,
                TextoRespuesta: r.TextoRespuesta,
                TextoRespuestaPar: r.TextoRespuestaPar,
                EsCorrecta: includeAnswers ? !!r.EsCorrecta : false
            }))
        });
    }
    return prueba;
};
exports.getPruebaDetalles = getPruebaDetalles;
const heartbeatPrueba = async (pruebaId, resultadoId, matriculaNo, duracionSegundos) => {
    await ensurePruebaResultadosSessionSchema();
    await expirarIntentosInactivos(pruebaId);
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('resultadoId', mssql_1.default.Int, resultadoId)
        .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
        .input('duracion', mssql_1.default.Int, Number.isFinite(duracionSegundos) ? Math.max(0, Math.floor(Number(duracionSegundos))) : null)
        .query(`
      UPDATE Virtual.PruebasResultados
      SET
        UltimoHeartbeat = GETDATE(),
        DuracionSegundos = CASE
          WHEN @duracion IS NULL THEN DuracionSegundos
          WHEN DuracionSegundos IS NULL THEN @duracion
          WHEN @duracion > DuracionSegundos THEN @duracion
          ELSE DuracionSegundos
        END
      WHERE ResultadoID = @resultadoId
        AND PruebaID = @pruebaId
        AND ABS(MatriculaNo) = @matriculaNo
        AND Estado = 'Iniciado';

      SELECT @@ROWCOUNT AS affected;
    `);
    return {
        ok: result.recordset[0]?.affected > 0,
        heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
        timeoutSeconds: HEARTBEAT_TIMEOUT_SECONDS,
    };
};
exports.heartbeatPrueba = heartbeatPrueba;
const setPruebaFinalizada = async (pruebaId, finalizada) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('fin', mssql_1.default.Bit, finalizada ? 1 : 0)
        .query(`
      UPDATE Virtual.Pruebas
      SET Finalizada = @fin
      WHERE PruebaID = @pruebaId;
    `);
};
exports.setPruebaFinalizada = setPruebaFinalizada;
// Actualizar el nombre de la competencia de una prueba
const updatePruebaCompetencia = async (pruebaId, nombreCompetencia) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('nombreCompetencia', mssql_1.default.NVarChar(255), nombreCompetencia)
        .query(`
            UPDATE Virtual.Pruebas
            SET NombreCompetencia = @nombreCompetencia
            WHERE PruebaID = @pruebaId;
        `);
};
exports.updatePruebaCompetencia = updatePruebaCompetencia;
// Actualizar el estado de publicado de una prueba
const setPruebaPublicado = async (pruebaId, publicado) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('publicado', mssql_1.default.Bit, publicado)
        .query(`
            UPDATE Virtual.Pruebas
            SET Publicado = @publicado
            WHERE PruebaID = @pruebaId;
        `);
};
exports.setPruebaPublicado = setPruebaPublicado;
// Añadir una pregunta y sus respuestas a una prueba
const addPreguntaToPrueba = async (pruebaId, pregunta) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        const result = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('textoPregunta', mssql_1.default.NVarChar(mssql_1.default.MAX), pregunta.TextoPregunta)
            .input('tipoPregunta', mssql_1.default.NVarChar(50), pregunta.TipoPregunta)
            .input('porcentaje', mssql_1.default.Decimal(5, 2), pregunta.Porcentaje)
            .query(`
        INSERT INTO Virtual.Pruebas_Preguntas (PruebaID, TextoPregunta, TipoPregunta, Porcentaje)
        OUTPUT INSERTED.PreguntaID
        VALUES (@pruebaId, @textoPregunta, @tipoPregunta, @porcentaje);
      `);
        const newPreguntaId = result.recordset[0].PreguntaID;
        if (pregunta.TipoPregunta !== 'Ensayo' && pregunta.Respuestas?.length) {
            for (const res of pregunta.Respuestas) {
                await new mssql_1.default.Request(transaction)
                    .input('preguntaId', mssql_1.default.Int, newPreguntaId)
                    .input('textoRespuesta', mssql_1.default.NVarChar(mssql_1.default.MAX), res.TextoRespuesta ?? null)
                    .input('textoPar', mssql_1.default.NVarChar(mssql_1.default.MAX), res.TextoRespuestaPar ?? null)
                    .input('correcta', mssql_1.default.Bit, res.EsCorrecta ? 1 : 0)
                    .query(`
            INSERT INTO Virtual.Pruebas_Respuestas (PreguntaID, TextoRespuesta, TextoRespuestaPar, EsCorrecta)
            VALUES (@preguntaId, @textoRespuesta, @textoPar, @correcta);
          `);
            }
        }
        await transaction.commit();
        return newPreguntaId;
    }
    catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de añadir pregunta:", err);
        throw err;
    }
};
exports.addPreguntaToPrueba = addPreguntaToPrueba;
// Actualizar una pregunta y sus respuestas
const updatePregunta = async (preguntaId, pregunta) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        await new mssql_1.default.Request(transaction)
            .input('preguntaId', mssql_1.default.Int, preguntaId)
            .input('textoPregunta', mssql_1.default.NVarChar(mssql_1.default.MAX), pregunta.TextoPregunta)
            .input('tipoPregunta', mssql_1.default.NVarChar(50), pregunta.TipoPregunta)
            .input('porcentaje', mssql_1.default.Decimal(5, 2), pregunta.Porcentaje)
            .query(`
        UPDATE Virtual.Pruebas_Preguntas
        SET TextoPregunta = @textoPregunta, TipoPregunta = @tipoPregunta, Porcentaje = @porcentaje
        WHERE PreguntaID = @preguntaId;
      `);
        await new mssql_1.default.Request(transaction)
            .input('preguntaId', mssql_1.default.Int, preguntaId)
            .query('DELETE FROM Virtual.Pruebas_Respuestas WHERE PreguntaID = @preguntaId;');
        if (pregunta.TipoPregunta !== 'Ensayo' && pregunta.Respuestas?.length) {
            for (const res of pregunta.Respuestas) {
                await new mssql_1.default.Request(transaction)
                    .input('preguntaId', mssql_1.default.Int, preguntaId)
                    .input('textoRespuesta', mssql_1.default.NVarChar(mssql_1.default.MAX), res.TextoRespuesta ?? null)
                    .input('textoPar', mssql_1.default.NVarChar(mssql_1.default.MAX), res.TextoRespuestaPar ?? null)
                    .input('correcta', mssql_1.default.Bit, res.EsCorrecta ? 1 : 0)
                    .query(`
            INSERT INTO Virtual.Pruebas_Respuestas (PreguntaID, TextoRespuesta, TextoRespuestaPar, EsCorrecta)
            VALUES (@preguntaId, @textoRespuesta, @textoPar, @correcta);
          `);
            }
        }
        await transaction.commit();
    }
    catch (err) {
        await transaction.rollback();
        console.error("Error en transacción de actualizar pregunta:", err);
        throw err;
    }
};
exports.updatePregunta = updatePregunta;
const updatePruebaConfig = async (pruebaId, data) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        // 1. Obtener RecursoID asociado a la prueba
        const currentData = await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .query('SELECT RecursoID FROM Virtual.Pruebas WHERE PruebaID = @pruebaId');
        if (currentData.recordset.length === 0)
            throw new Error('Prueba no encontrada');
        const recursoId = currentData.recordset[0].RecursoID;
        // 2. Actualizar Tabla Base (Virtual.Recursos)
        await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .input('titulo', mssql_1.default.NVarChar(1024), data.titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), data.contenido)
            .query(`
                UPDATE Virtual.Recursos 
                SET Titulo = @titulo, Contenido = @contenido 
                WHERE RecursoID = @recursoId
            `);
        // 3. Actualizar Tabla Específica (Virtual.Pruebas)
        // Validar fechas
        const fechaInicio = new Date(data.fechaInicio);
        let fechaCierre = new Date(data.fechaCierre);
        if (fechaCierre <= fechaInicio) {
            fechaCierre = new Date(fechaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
        await new mssql_1.default.Request(transaction)
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('tipoExamen', mssql_1.default.NVarChar(50), data.tipoExamen) // Diagnostico/Cognitivo
            .input('duracion', mssql_1.default.SmallInt, data.duracionMinutos)
            .input('intentos', mssql_1.default.SmallInt, data.numeroIntentos)
            .input('contrasena', mssql_1.default.NVarChar(50), data.contrasena || null)
            .input('revision', mssql_1.default.NVarChar(50), data.modoRevision)
            .input('inicio', mssql_1.default.DateTime, fechaInicio)
            .input('cierre', mssql_1.default.DateTime, fechaCierre)
            .query(`
                UPDATE Virtual.Pruebas
                SET 
                    TipoExamen = @tipoExamen,
                    DuracionMinutos = @duracion,
                    NumeroIntentos = @intentos,
                    Contrasena = @contrasena,
                    ModoRevision = @revision,
                    FechaInicio = @inicio,
                    FechaCierre = @cierre
                WHERE PruebaID = @pruebaId
            `);
        // 4. Actualizar Personalización (Si aplica)
        // Borramos anteriores
        await new mssql_1.default.Request(transaction)
            .input('recursoId', mssql_1.default.Int, recursoId)
            .query('DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId');
        // Insertamos nuevos si es personalizado
        if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
            const t = new mssql_1.default.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', mssql_1.default.Int);
            t.columns.add('MatriculaNo', mssql_1.default.Int);
            for (const id of data.estudiantesIds) {
                t.rows.add(recursoId, id);
            }
            await new mssql_1.default.Request(transaction).bulk(t);
        }
        await transaction.commit();
        return { success: true };
    }
    catch (err) {
        await transaction.rollback();
        console.error("Error actualizando configuración de prueba:", err);
        throw err;
    }
};
exports.updatePruebaConfig = updatePruebaConfig;
// Eliminar una pregunta y sus respuestas
const deletePregunta = async (preguntaId) => {
    const pool = await dbPool_1.poolPromise;
    // Las respuestas se eliminarán en cascada gracias a la FK ON DELETE CASCADE
    await pool.request()
        .input('preguntaId', mssql_1.default.Int, preguntaId)
        .query('DELETE FROM Virtual.Pruebas_Preguntas WHERE PreguntaID = @preguntaId;');
};
exports.deletePregunta = deletePregunta;
const getEstudiantesParaPrueba = async (pruebaId) => {
    const pool = await dbPool_1.poolPromise;
    // 1) Resolver CodigoAsignatura desde Semanas (tu esquema real)
    const rsAsig = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
      SELECT TOP 1 s.CodigoAsignatura
      FROM Virtual.Pruebas p
      INNER JOIN Virtual.Recursos   r  ON r.RecursoID   = p.RecursoID
      INNER JOIN Virtual.Apartados  ap ON ap.ApartadoID = r.ApartadoID
      INNER JOIN Virtual.Semanas    s  ON s.SemanaID    = ap.SemanaID
      WHERE p.PruebaID = @pruebaId;
    `);
    const codigoAsignatura = rsAsig.recordset?.[0]?.CodigoAsignatura;
    if (!codigoAsignatura) {
        // Mensaje claro para depurar fácilmente (el controller lo envía con 500/404 si quieres)
        throw new Error('No se pudo determinar la asignatura de la prueba (Semanas.CodigoAsignatura).');
    }
    // 2) Traer estudiantes de esa asignatura (con nombres desglosados)
    const rsEst = await pool.request()
        .input('codigoAsignatura', mssql_1.default.SmallInt, codigoAsignatura)
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
    SELECT 
      e.[MatrículaNo]  AS MatriculaNo,
      e.PrimerNombre,
      e.SegundoNombre,
      e.PrimerApellido,
      e.SegundoApellido
    FROM dbo.Estudiantes e
    INNER JOIN dbo.Asignaturas a
      ON e.[CódigoCurso] = a.[CódigoCurso]
    INNER JOIN Virtual.Pruebas p
      ON p.PruebaID = @pruebaId
    INNER JOIN Virtual.Recursos r
      ON r.RecursoID = p.RecursoID
    LEFT JOIN Virtual.RecursosEstudiantes re
      ON re.RecursoID = r.RecursoID AND ABS(re.MatriculaNo) = ABS(e.[MatrículaNo])
    WHERE a.[Código] = @codigoAsignatura
      AND (e.Estado IS NULL OR e.Estado <> 'Retirado')
      AND (
        NOT EXISTS (SELECT 1 FROM Virtual.RecursosEstudiantes reScope WHERE reScope.RecursoID = r.RecursoID)
        OR re.RecursoID IS NOT NULL
      )
    ORDER BY e.PrimerApellido, e.PrimerNombre;
  `);
    // 3) Adaptar al shape que consume el front (sin usar "name split")
    return rsEst.recordset.map(e => ({
        MatriculaNo: e.MatriculaNo,
        PrimerNombre: e.PrimerNombre,
        PrimerApellido: e.PrimerApellido,
    }));
};
exports.getEstudiantesParaPrueba = getEstudiantesParaPrueba;
const getResultadosSimulacro = async (pruebaId) => {
    const pool = await dbPool_1.poolPromise;
    const rs = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
      SELECT SimulacroID, PruebaID, MatriculaNo, Fecha, Calificacion, DuracionSegundos
      FROM Virtual.PruebasSimulacros
      WHERE PruebaID = @pruebaId
      ORDER BY Fecha ASC;
    `);
    return rs.recordset.map((r) => ({
        SimulacroID: r.SimulacroID,
        PruebaID: r.PruebaID,
        MatriculaNo: r.MatriculaNo,
        Fecha: r.Fecha,
        Calificacion: Number(r.Calificacion ?? 0),
        DuracionSegundos: r.DuracionSegundos ?? null,
    }));
};
exports.getResultadosSimulacro = getResultadosSimulacro;
const getResultadosReales = async (pruebaId) => {
    const pool = await dbPool_1.poolPromise;
    const rsRes = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
      SELECT ResultadoID, PruebaID, MatriculaNo, FechaEntrega, Estado, CalificacionFinal, RequiereCalificacionManual, RespuestaEnsayo
      FROM Virtual.PruebasResultados
      WHERE PruebaID = @pruebaId;
    `);
    const ids = rsRes.recordset.map((r) => Number(r.MatriculaNo)).filter(n => !Number.isNaN(n));
    if (ids.length === 0) {
        // No hay resultados, devolvemos vacío con forma esperada
        return [];
    }
    const idParams = ids.map((_, i) => `@id${i}`).join(',');
    const req = pool.request();
    ids.forEach((id, i) => req.input(`id${i}`, mssql_1.default.Int, id));
    const rsEst = await req.query(`
    SELECT [MatrículaNo] AS MatriculaNo, PrimerNombre, PrimerApellido
    FROM dbo.Estudiantes
    WHERE [MatrículaNo] IN (${idParams});
  `);
    const map = new Map();
    rsEst.recordset.forEach((e) => map.set(e.MatriculaNo, { PrimerNombre: e.PrimerNombre, PrimerApellido: e.PrimerApellido }));
    return rsRes.recordset.map((r) => ({
        estudiante: {
            MatriculaNo: r.MatriculaNo,
            PrimerNombre: map.get(r.MatriculaNo)?.PrimerNombre ?? '',
            PrimerApellido: map.get(r.MatriculaNo)?.PrimerApellido ?? '',
        },
        resultado: {
            ResultadoID: r.ResultadoID,
            MatriculaNo: r.MatriculaNo,
            FechaEntrega: r.FechaEntrega,
            Estado: r.Estado,
            CalificacionFinal: Number(r.CalificacionFinal ?? 0),
            RequiereCalificacionManual: !!r.RequiereCalificacionManual,
            RespuestaEnsayo: r.RespuestaEnsayo ?? null
        }
    }));
};
exports.getResultadosReales = getResultadosReales;
const deleteSimulacroById = async (simulacroId) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('simulacroId', mssql_1.default.Int, simulacroId)
        .query(`DELETE FROM Virtual.PruebasSimulacros WHERE SimulacroID = @simulacroId;`);
};
exports.deleteSimulacroById = deleteSimulacroById;
// === NUEVO: guardar calificación ===
const setResultadoCalificacion = async (resultadoId, calificacionFinal, retroalimentacion) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('resultadoId', mssql_1.default.Int, resultadoId)
        .input('cal', mssql_1.default.Decimal(3, 1), calificacionFinal)
        .input('retro', mssql_1.default.NVarChar(mssql_1.default.MAX), retroalimentacion ?? null)
        .query(`
      UPDATE Virtual.PruebasResultados
      SET CalificacionFinal = @cal, Estado = 'Calificado'
      WHERE ResultadoID = @resultadoId;
      -- Si tienes una tabla de comentarios, inserta @retro allí.
    `);
};
exports.setResultadoCalificacion = setResultadoCalificacion;
const validateAndSetPublicado = async (pruebaId, publicado) => {
    const pool = await dbPool_1.poolPromise;
    if (!publicado) {
        await pool.request()
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('pub', mssql_1.default.Bit, false)
            .query(`UPDATE Virtual.Pruebas SET Publicado = @pub WHERE PruebaID = @pruebaId;`);
        return;
    }
    const rs = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
      SELECT SUM(CONVERT(decimal(5,2), Porcentaje)) AS TotalPct, COUNT(*) as NumPreguntas
      FROM Virtual.Pruebas_Preguntas WHERE PruebaID = @pruebaId;
    `);
    const totalRaw = Number(rs.recordset[0]?.TotalPct ?? 0);
    const total = Math.round(totalRaw * 100) / 100; // CHANGED
    const n = Number(rs.recordset[0]?.NumPreguntas ?? 0);
    if (n === 0 || total !== 100) {
        throw new Error('Validación de publicación fallida: asegúrate de tener preguntas y que el total de porcentajes sea 100%.');
    }
    await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('pub', mssql_1.default.Bit, true)
        .query(`UPDATE Virtual.Pruebas SET Publicado = @pub WHERE PruebaID = @pruebaId;`);
};
exports.validateAndSetPublicado = validateAndSetPublicado;
const createSimulacro = async (pruebaId, matriculaNo, calificacion, duracionSegundos) => {
    const pool = await dbPool_1.poolPromise;
    const rs = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('matriculaNo', mssql_1.default.Int, Math.abs(matriculaNo))
        .input('cal', mssql_1.default.Decimal(3, 1), calificacion ?? null)
        .input('dur', mssql_1.default.Int, typeof duracionSegundos === 'number' ? duracionSegundos : null)
        .query(`
      IF EXISTS (
        SELECT 1
        FROM Virtual.Pruebas p
        INNER JOIN Virtual.Recursos r ON r.RecursoID = p.RecursoID
        WHERE p.PruebaID = @pruebaId
          AND EXISTS (SELECT 1 FROM Virtual.RecursosEstudiantes re WHERE re.RecursoID = r.RecursoID)
          AND NOT EXISTS (
            SELECT 1
            FROM Virtual.RecursosEstudiantes re
            WHERE re.RecursoID = r.RecursoID
              AND ABS(re.MatriculaNo) = @matriculaNo
          )
      )
      BEGIN
        THROW 51000, 'El estudiante no pertenece a la audiencia personalizada de esta prueba.', 1;
      END;

      INSERT INTO Virtual.PruebasSimulacros (PruebaID, MatriculaNo, Fecha, Calificacion, DuracionSegundos)
      OUTPUT INSERTED.SimulacroID
      VALUES (@pruebaId, @matriculaNo, GETUTCDATE(), @cal, @dur);
    `);
    return Number(rs.recordset[0].SimulacroID);
};
exports.createSimulacro = createSimulacro;
const getPublicacionByRecursoId = async (recursoId) => {
    const pool = await dbPool_1.poolPromise;
    const rs = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
      SELECT CAST(p.Publicado AS bit) AS Publicado
      FROM Virtual.Pruebas p
      WHERE p.RecursoID = @recursoId
    `);
    if (!rs.recordset.length)
        return null;
    return Boolean(rs.recordset[0].Publicado);
};
exports.getPublicacionByRecursoId = getPublicacionByRecursoId;
const getPublicacionesByRecursoIds = async (recursoIds) => {
    const pool = await dbPool_1.poolPromise;
    const idsJson = JSON.stringify(recursoIds);
    const rs = await pool.request()
        .input('ids', mssql_1.default.NVarChar(mssql_1.default.MAX), idsJson)
        .query(` 
      WITH ids AS (
        SELECT CAST([value] AS int) AS RecursoID
        FROM OPENJSON(@ids)
      )
      SELECT p.RecursoID, CAST(p.Publicado AS bit) AS Publicado
      FROM ids
      LEFT JOIN Virtual.Pruebas p ON p.RecursoID = ids.RecursoID
    `);
    return rs.recordset
        .filter((r) => r.RecursoID != null)
        .map((r) => ({
        recursoId: Number(r.RecursoID),
        publicado: Boolean(r.Publicado),
    }));
};
exports.getPublicacionesByRecursoIds = getPublicacionesByRecursoIds;
const validateAndSetPublicadoReturningRecurso = async (pruebaId, publicado) => {
    const pool = await dbPool_1.poolPromise;
    if (!publicado) {
        const rs = await pool.request()
            .input('pruebaId', mssql_1.default.Int, pruebaId)
            .input('pub', mssql_1.default.Bit, false)
            .query(`
        UPDATE Virtual.Pruebas
        SET Publicado = @pub
        OUTPUT INSERTED.RecursoID AS RecursoID, INSERTED.Publicado AS Publicado
        WHERE PruebaID = @pruebaId;
      `);
        return { recursoId: rs.recordset[0]?.RecursoID ?? null, publicado: !!rs.recordset[0]?.Publicado };
    }
    // Validación (igual a tu función actual)
    const rsVal = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
      SELECT SUM(CONVERT(decimal(5,2), Porcentaje)) AS TotalPct, COUNT(*) as NumPreguntas
      FROM Virtual.Pruebas_Preguntas
      WHERE PruebaID = @pruebaId;
    `);
    const totalRaw = Number(rsVal.recordset[0]?.TotalPct ?? 0);
    const total = Math.round(totalRaw * 100) / 100;
    const n = Number(rsVal.recordset[0]?.NumPreguntas ?? 0);
    if (n === 0 || total !== 100) {
        throw new Error('Validación de publicación fallida: asegúrate de tener preguntas y que el total de porcentajes sea 100%.');
    }
    const rsUpd = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .input('pub', mssql_1.default.Bit, true)
        .query(`
      UPDATE Virtual.Pruebas
      SET Publicado = @pub
      OUTPUT INSERTED.RecursoID AS RecursoID, INSERTED.Publicado AS Publicado
      WHERE PruebaID = @pruebaId;
    `);
    return { recursoId: rsUpd.recordset[0]?.RecursoID ?? null, publicado: !!rsUpd.recordset[0]?.Publicado };
};
exports.validateAndSetPublicadoReturningRecurso = validateAndSetPublicadoReturningRecurso;

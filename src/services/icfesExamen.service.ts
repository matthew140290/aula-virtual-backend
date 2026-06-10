import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { ensureIcfesSchema } from './icfesSchema.service';
import { generateQuestionsWithOpenAI } from './icfesAi.service';
import type {
  CompetenciaPayload,
  CreateExamenPayload,
  GenerarPreguntasPayload,
  UserActor,
  OpcionDraft,
  PreguntaRow,
  OpcionRow,
} from './icfesTypes';

const normalizePesoTotal = (competencias: CompetenciaPayload[]) => {
  const total = competencias.reduce((acc, c) => acc + Number(c.peso || 0), 0);
  return Math.round(total * 100) / 100;
};

export const getCompetenciasByExamen = async (examenId: number) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('examenId', sql.Int, examenId)
    .query<{ CompetenciaID: number; NombreCompetencia: string; Peso: number }>(`
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

export const getPreguntasByExamen = async (examenId: number) => {
  const pool = await poolPromise;

  const preguntasResult = await pool.request()
    .input('examenId', sql.Int, examenId)
    .query<PreguntaRow>(`
      SELECT p.PreguntaGlobalID, p.ExamenGlobalID, p.CompetenciaID,
             c.NombreCompetencia,
             p.TextoPregunta, p.Peso, p.ExplicacionRespuesta, p.Orden
      FROM Virtual.ICFES_Preguntas p
      LEFT JOIN Virtual.ICFES_CompetenciasExamen c ON c.CompetenciaID = p.CompetenciaID
      WHERE p.ExamenGlobalID = @examenId
      ORDER BY p.Orden, p.PreguntaGlobalID;
    `);

  const opcionesResult = await pool.request()
    .input('examenId', sql.Int, examenId)
    .query<OpcionRow>(`
      SELECT o.OpcionID, o.PreguntaGlobalID, o.Letra, o.TextoOpcion, o.EsCorrecta
      FROM Virtual.ICFES_OpcionesPregunta o
      INNER JOIN Virtual.ICFES_Preguntas p ON p.PreguntaGlobalID = o.PreguntaGlobalID
      WHERE p.ExamenGlobalID = @examenId
      ORDER BY o.PreguntaGlobalID, o.Letra;
    `);

  const opcionesByPregunta = new Map<number, OpcionRow[]>();
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

const validatePublicacion = async (examenId: number) => {
  const preguntas = await getPreguntasByExamen(examenId);
  if (preguntas.length === 0) throw new Error('No puedes publicar sin preguntas.');

  const totalPeso = preguntas.reduce((acc, p) => acc + Number(p.peso || 0), 0);
  if (Math.round(totalPeso * 100) / 100 !== 100) throw new Error('La suma de pesos de preguntas debe ser 100.');

  for (const p of preguntas) {
    if (p.opciones.length !== 4) throw new Error('Todas las preguntas deben tener 4 opciones.');
    if (p.opciones.filter(op => op.esCorrecta).length !== 1) throw new Error('Cada pregunta debe tener una sola opcion correcta.');
  }
};

export const createExamenGlobal = async (payload: CreateExamenPayload, actor: UserActor) => {
  await ensureIcfesSchema();
  if (normalizePesoTotal(payload.competencias) !== 100) throw new Error('El peso total de competencias debe ser 100.');
  if (payload.periodicidad === 'TRIMESTRAL' && !payload.trimestre) throw new Error('Indica el trimestre.');

  const fechaInicio = new Date(payload.fechaInicio);
  const fechaCierre = new Date(payload.fechaCierre);
  if (fechaCierre <= fechaInicio) throw new Error('Cierre debe ser posterior a inicio.');

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const examenResult = await new sql.Request(tx)
      .input('titulo', sql.NVarChar(255), payload.titulo)
      .input('descripcion', sql.NVarChar(sql.MAX), payload.descripcion ?? '')
      .input('periodicidad', sql.NVarChar(20), payload.periodicidad)
      .input('trimestre', sql.TinyInt, payload.periodicidad === 'TRIMESTRAL' ? payload.trimestre ?? null : null)
      .input('anio', sql.SmallInt, payload.anio)
      .input('duracionMinutos', sql.SmallInt, payload.duracionMinutos)
      .input('numeroIntentos', sql.SmallInt, payload.numeroIntentos)
      .input('fechaInicio', sql.DateTime, fechaInicio)
      .input('fechaCierre', sql.DateTime, fechaCierre)
      .input('creadoPorCodigo', sql.Int, actor.codigo)
      .input('creadoPorPerfil', sql.NVarChar(100), actor.perfil)
      .query<{ ExamenGlobalID: number }>(`
        INSERT INTO Virtual.ICFES_ExamenesGlobales
          (Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado, Publicado, CreadoPorCodigo, CreadoPorPerfil)
        OUTPUT INSERTED.ExamenGlobalID
        VALUES (@titulo, @descripcion, @periodicidad, @trimestre, @anio, @duracionMinutos, @numeroIntentos, @fechaInicio, @fechaCierre, 'Borrador', 0, @creadoPorCodigo, @creadoPorPerfil);
      `);

    const examenId = examenResult.recordset[0].ExamenGlobalID;
    for (const c of payload.competencias) {
      await new sql.Request(tx)
        .input('examenId', sql.Int, examenId)
        .input('nombre', sql.NVarChar(100), c.nombre)
        .input('peso', sql.Decimal(5, 2), c.peso)
        .query('INSERT INTO Virtual.ICFES_CompetenciasExamen (ExamenGlobalID, NombreCompetencia, Peso) VALUES (@examenId, @nombre, @peso);');
    }

    await tx.commit();
    return { examenGlobalId: examenId };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const listExamenesGlobales = async () => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ExamenGlobalID, Titulo, Periodicidad, Trimestre, Anio, Estado, Publicado, FechaInicio, FechaCierre, FechaCreacion
    FROM Virtual.ICFES_ExamenesGlobales ORDER BY FechaCreacion DESC;
  `);
  return result.recordset;
};

export const getExamenGlobalDetalle = async (examenId: number) => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  const examenResult = await pool.request().input('examenId', sql.Int, examenId).query(`
    SELECT ExamenGlobalID, Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado, Publicado, FechaCreacion, FechaActualizacion
    FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId;
  `);

  if (!examenResult.recordset.length) return null;
  const competencias = await getCompetenciasByExamen(examenId);
  const preguntas = await getPreguntasByExamen(examenId);

  return { ...examenResult.recordset[0], competencias, preguntas };
};

export const generarPreguntasIa = async (examenId: number, payload: GenerarPreguntasPayload, actor: UserActor) => {
  await ensureIcfesSchema();
  const competencias = await getCompetenciasByExamen(examenId);
  if (!competencias.length) throw new Error('El examen no tiene competencias configuradas.');

  const { preguntas, systemPrompt } = await generateQuestionsWithOpenAI(payload, competencias);

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    if (payload.replaceDraft ?? true) {
      await new sql.Request(tx).input('examenId', sql.Int, examenId).query(`
        DELETE FROM Virtual.ICFES_OpcionesPregunta WHERE PreguntaGlobalID IN (SELECT PreguntaGlobalID FROM Virtual.ICFES_Preguntas WHERE ExamenGlobalID = @examenId);
        DELETE FROM Virtual.ICFES_Preguntas WHERE ExamenGlobalID = @examenId;
      `);
    }

    const competenciasMap = new Map<string, number>();
    const compDb = await new sql.Request(tx).input('examenId', sql.Int, examenId).query<{ CompetenciaID: number; NombreCompetencia: string }>(`
      SELECT CompetenciaID, NombreCompetencia FROM Virtual.ICFES_CompetenciasExamen WHERE ExamenGlobalID = @examenId;
    `);
    for (const c of compDb.recordset) competenciasMap.set(c.NombreCompetencia.trim().toLowerCase(), c.CompetenciaID);

    for (let index = 0; index < preguntas.length; index += 1) {
      const p = preguntas[index];
      const competenciaId = competenciasMap.get(p.nombreCompetencia.trim().toLowerCase()) ?? null;

      const pregRes = await new sql.Request(tx)
        .input('examenId', sql.Int, examenId).input('competenciaId', sql.Int, competenciaId)
        .input('texto', sql.NVarChar(sql.MAX), p.textoPregunta).input('peso', sql.Decimal(5, 2), p.peso)
        .input('explicacion', sql.NVarChar(sql.MAX), p.explicacionRespuesta ?? null).input('orden', sql.Int, index + 1)
        .query<{ PreguntaGlobalID: number }>(`
          INSERT INTO Virtual.ICFES_Preguntas (ExamenGlobalID, CompetenciaID, TextoPregunta, Peso, ExplicacionRespuesta, TipoPregunta, Fuente, Orden)
          OUTPUT INSERTED.PreguntaGlobalID VALUES (@examenId, @competenciaId, @texto, @peso, @explicacion, 'SeleccionUnica', 'IA', @orden);
        `);

      const pregId = pregRes.recordset[0].PreguntaGlobalID;
      for (const op of p.opciones) {
        await new sql.Request(tx).input('preguntaId', sql.Int, pregId).input('letra', sql.Char(1), op.letra)
          .input('texto', sql.NVarChar(sql.MAX), op.texto).input('correcta', sql.Bit, op.esCorrecta ? 1 : 0)
          .query(`INSERT INTO Virtual.ICFES_OpcionesPregunta (PreguntaGlobalID, Letra, TextoOpcion, EsCorrecta) VALUES (@preguntaId, @letra, @texto, @correcta);`);
      }
    }

    await new sql.Request(tx).input('examenId', sql.Int, examenId).input('tema', sql.NVarChar(200), payload.tema)
      .input('textoBase', sql.NVarChar(sql.MAX), payload.textoBase).input('dificultad', sql.NVarChar(20), payload.dificultad)
      .input('cantidad', sql.Int, payload.cantidad).input('modelo', sql.NVarChar(100), process.env.OPENAI_MODEL ?? 'gpt-4o-mini')
      .input('promptSistema', sql.NVarChar(sql.MAX), systemPrompt).input('creadoPorCodigo', sql.Int, actor.codigo)
      .query(`INSERT INTO Virtual.ICFES_GeneracionesIA (ExamenGlobalID, Tema, TextoBase, Dificultad, Cantidad, Modelo, PromptSistema, CreadoPorCodigo) VALUES (@examenId, @tema, @textoBase, @dificultad, @cantidad, @modelo, @promptSistema, @creadoPorCodigo);`);

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return getPreguntasByExamen(examenId);
};

export const updatePreguntaGlobal = async (preguntaId: number, payload: { textoPregunta: string; nombreCompetencia: string; peso: number; explicacionRespuesta?: string | null; opciones: OpcionDraft[] }) => {
  await ensureIcfesSchema();
  if (payload.opciones.filter(o => o.esCorrecta).length !== 1) throw new Error('Debe existir una sola opcion correcta.');

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const pregRes = await new sql.Request(tx).input('preguntaId', sql.Int, preguntaId).query<{ ExamenGlobalID: number }>('SELECT ExamenGlobalID FROM Virtual.ICFES_Preguntas WHERE PreguntaGlobalID = @preguntaId;');
    if (!pregRes.recordset.length) throw new Error('Pregunta global no encontrada.');
    const examenId = pregRes.recordset[0].ExamenGlobalID;

    const compRes = await new sql.Request(tx).input('examenId', sql.Int, examenId).input('nombre', sql.NVarChar(100), payload.nombreCompetencia).query<{ CompetenciaID: number }>('SELECT TOP 1 CompetenciaID FROM Virtual.ICFES_CompetenciasExamen WHERE ExamenGlobalID = @examenId AND LOWER(NombreCompetencia) = LOWER(@nombre);');
    const competenciaId = compRes.recordset[0]?.CompetenciaID ?? null;

    await new sql.Request(tx).input('preguntaId', sql.Int, preguntaId).input('competenciaId', sql.Int, competenciaId).input('texto', sql.NVarChar(sql.MAX), payload.textoPregunta).input('peso', sql.Decimal(5, 2), payload.peso).input('explicacion', sql.NVarChar(sql.MAX), payload.explicacionRespuesta ?? null).query(`UPDATE Virtual.ICFES_Preguntas SET CompetenciaID = @competenciaId, TextoPregunta = @texto, Peso = @peso, ExplicacionRespuesta = @explicacion, Fuente = 'Manual' WHERE PreguntaGlobalID = @preguntaId;`);
    await new sql.Request(tx).input('preguntaId', sql.Int, preguntaId).query('DELETE FROM Virtual.ICFES_OpcionesPregunta WHERE PreguntaGlobalID = @preguntaId;');

    for (const op of payload.opciones) {
      await new sql.Request(tx).input('preguntaId', sql.Int, preguntaId).input('letra', sql.Char(1), op.letra).input('texto', sql.NVarChar(sql.MAX), op.texto).input('correcta', sql.Bit, op.esCorrecta ? 1 : 0).query('INSERT INTO Virtual.ICFES_OpcionesPregunta (PreguntaGlobalID, Letra, TextoOpcion, EsCorrecta) VALUES (@preguntaId, @letra, @texto, @correcta);');
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const publicarExamenGlobal = async (examenId: number) => {
  await ensureIcfesSchema();
  await validatePublicacion(examenId);
  const pool = await poolPromise;
  await pool.request().input('examenId', sql.Int, examenId).query("UPDATE Virtual.ICFES_ExamenesGlobales SET Publicado = 1, Estado = 'Publicado', FechaActualizacion = GETDATE() WHERE ExamenGlobalID = @examenId;");
};

export const despublicarExamenGlobal = async (examenId: number) => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  await pool.request().input('examenId', sql.Int, examenId).query("UPDATE Virtual.ICFES_ExamenesGlobales SET Publicado = 0, Estado = 'Borrador', FechaActualizacion = GETDATE() WHERE ExamenGlobalID = @examenId;");
};

export const listExamenesGlobalesPublicados = async () => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  const result = await pool.request().query("SELECT ExamenGlobalID, Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado FROM Virtual.ICFES_ExamenesGlobales WHERE Publicado = 1 ORDER BY FechaInicio DESC;");
  return result.recordset;
};

export const getExamenGlobalPublicadoDetalle = async (examenId: number) => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  const examenResult = await pool.request().input('examenId', sql.Int, examenId).query("SELECT ExamenGlobalID, Titulo, Descripcion, Periodicidad, Trimestre, Anio, DuracionMinutos, NumeroIntentos, FechaInicio, FechaCierre, Estado, Publicado FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId AND Publicado = 1;");
  if (!examenResult.recordset.length) return null;

  const examen = examenResult.recordset[0];
  const competencias = await getCompetenciasByExamen(examenId);
  const preguntas = await getPreguntasByExamen(examenId);

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

export const deleteExamenGlobal = async (examenId: number) => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  await pool.request()
    .input('examenId', sql.Int, examenId)
    .query('DELETE FROM Virtual.ICFES_ExamenesGlobales WHERE ExamenGlobalID = @examenId;');
};

export const deletePreguntaGlobal = async (preguntaId: number) => {
  await ensureIcfesSchema();
  const pool = await poolPromise;
  await pool.request()
    .input('preguntaId', sql.Int, preguntaId)
    .query('DELETE FROM Virtual.ICFES_Preguntas WHERE PreguntaGlobalID = @preguntaId;');
};
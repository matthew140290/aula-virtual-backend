// src/services/prueba.service.ts
import { poolPromise } from '../config/dbPool';
import sql from 'mssql';
import { findEstudiantesByAsignatura } from './estudiante.service';
import { registrarAccion } from './log.service';

export type TipoPregunta =
  | 'SeleccionUnica'
  | 'SeleccionMultiple'
  | 'VerdaderoFalso'
  | 'Relacionar'
  | 'Ensayo';
export type ModoRevision = 'NoPermitir' | 'VerSoloRespuestas' | 'VerSoloNotas' | 'VerAmbas';

export interface PruebaDetalles {
    PruebaID: number;
    RecursoID: number;
    Titulo: string;
    Contenido: string; // Descripción
    TipoPrueba: 'Examen' | 'Taller';
    TipoExamen: 'Diagnostico' | 'Cognitivo';
    DuracionMinutos: number;
    Contrasena?: string;
    ModoRevision: ModoRevision;
    NombreCompetencia: string; // Única competencia
    Publicado: boolean;
    FechaPublicacion: Date;
    FechaInicio: Date;
    FechaCierre: Date;
    NumeroIntentos: number | null;
    Finalizada: boolean;  
    Preguntas: Pregunta[]; // Las preguntas asociadas a esta prueba
}

export interface Pregunta {
    PreguntaID: number | null; // null si es nueva
    TextoPregunta: string;
    TipoPregunta: TipoPregunta;
    Porcentaje: number; // Peso dentro del 100% de la competencia
    Respuestas: Respuesta[];
}

export interface Respuesta {
    RespuestaID: number | null; // null si es nueva
    TextoRespuesta: string;
    EsCorrecta: boolean;
    TextoRespuestaPar?: string | null;
}

export interface SimulacroInfo {
  SimulacroID: number;
  PruebaID: number;
  MatriculaNo: number;
  Fecha: Date;
  Calificacion: number | null;
  DuracionSegundos: number | null;
}

export interface PruebaResultado {
  ResultadoID: number;
  PruebaID: number;
  MatriculaNo: number;
  FechaEntrega: Date | null;
  Estado: 'Entregado' | 'Pendiente' | 'Calificado';
  CalificacionFinal: number;
  RequiereCalificacionManual: boolean;
  RespuestaEnsayo: string | null;
}

interface EstudianteDetalleRow {
  MatriculaNo: number;
  PrimerNombre: string;
  SegundoNombre: string | null;
  PrimerApellido: string;
  SegundoApellido: string | null;
}

// --- Interfaces internas para mapeo de BD ---
interface SimulacroDBRow {
    SimulacroID: number;
    PruebaID: number;
    MatriculaNo: number;
    Fecha: Date;
    Calificacion: number | null;
    DuracionSegundos: number | null;
}

interface PruebaResultadoDBRow {
    ResultadoID: number;
    PruebaID: number;
    MatriculaNo: number;
    FechaEntrega: Date | null;
    Estado: 'Entregado' | 'Pendiente' | 'Calificado';
    CalificacionFinal: number;
    RequiereCalificacionManual: boolean;
    RespuestaEnsayo: string | null;
}

interface EstudianteSimpleRow {
    MatriculaNo: number; // Mapeado de [MatrículaNo]
    PrimerNombre: string;
    PrimerApellido: string;
}

interface PublicacionDBRow {
    RecursoID: number | null;
    Publicado: boolean | null;
}

interface PruebaConfigPayload {
    titulo: string;
    contenido: string;
    fechaInicio: string | Date;
    fechaCierre: string | Date;
    tipoExamen: string;
    duracionMinutos: number;
    numeroIntentos: number;
    contrasena?: string;
    modoRevision: string;
    esPersonalizado?: boolean;
    estudiantesIds?: number[];
}

export const iniciarPrueba = async (pruebaId: number, matriculaNo: number) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 1. Validaciones de Reglas de Negocio
        const pruebaInfo = await new sql.Request(transaction)
            .input('pruebaId', sql.Int, pruebaId)
            .query(`SELECT NumeroIntentos, FechaInicio, FechaCierre FROM Virtual.Pruebas WHERE PruebaID = @pruebaId`);
        
        const info = pruebaInfo.recordset[0];
        const now = new Date();

        if (now < new Date(info.FechaInicio) || now > new Date(info.FechaCierre)) {
            throw new Error('La prueba no está disponible en este momento.');
        }

        // const enProgreso = await new sql.Request(transaction)
        //     .input('pruebaId', sql.Int, pruebaId)
        //     .input('matriculaNo', sql.Int, matriculaNo)
        //     .query(`
        //         SELECT TOP 1 ResultadoID 
        //         FROM Virtual.PruebasResultados 
        //         WHERE PruebaID = @pruebaId AND MatriculaNo = @matriculaNo AND Estado = 'Iniciado'
        //     `);
        
        // if (enProgreso.recordset.length > 0) {
        //     await transaction.commit();
        //     // Retornamos el mismo ID para que continúe
        //     return { resultadoId: enProgreso.recordset[0].ResultadoID, retomado: true };
        // }

        // 2. Contar intentos PREVIOS (sin contar el que vamos a crear)
        const intentosPrevios = await new sql.Request(transaction)
            .input('pruebaId', sql.Int, pruebaId)
            .input('matriculaNo', sql.Int, matriculaNo)
            .query(`SELECT COUNT(*) as count FROM Virtual.PruebasResultados WHERE PruebaID = @pruebaId AND MatriculaNo = @matriculaNo`);
        
        if (info.NumeroIntentos > 0 && intentosPrevios.recordset[0].count >= info.NumeroIntentos) {
            // Verificar si hay alguno "En Progreso" que se pueda retomar
            const enProgreso = await new sql.Request(transaction)
                .input('pruebaId', sql.Int, pruebaId)
                .input('matriculaNo', sql.Int, matriculaNo)
                .query(`
                    SELECT TOP 1 ResultadoID FROM Virtual.PruebasResultados 
                    WHERE PruebaID = @pruebaId AND MatriculaNo = @matriculaNo AND Estado = 'Iniciado'
                `);
            
            if (enProgreso.recordset.length > 0) {
                await transaction.commit();
                return { resultadoId: enProgreso.recordset[0].ResultadoID, retomado: true };
            }
            
            throw new Error('Has superado el número máximo de intentos.');
        }

        // 3. CREAR EL INTENTO (Estado 'Iniciado')
        // Esto "quema" el intento inmediatamente.
        const insert = await new sql.Request(transaction)
            .input('pruebaId', sql.Int, pruebaId)
            .input('matriculaNo', sql.Int, matriculaNo)
            .input('FechaEntrega', sql.DateTime, now) // Asegúrate de tener esta columna o usa FechaEntrega como referencia temporal
            .query(`
                INSERT INTO Virtual.PruebasResultados 
                (PruebaID, MatriculaNo, FechaEntrega, Estado, CalificacionFinal, RequiereCalificacionManual)
                OUTPUT INSERTED.ResultadoID
                VALUES 
                (@pruebaId, @matriculaNo, GETDATE(), 'Iniciado', 0, 0); 
            `);
            
        const resultadoId = insert.recordset[0].ResultadoID;

        await transaction.commit();
        return { resultadoId, retomado: false };

    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

export const entregarPrueba = async (
    resultadoId: number, 
    respuestas: { PreguntaID: number, Tipo: string, SelectedId?: number, SelectedIds?: number[], Pairs?: any[], Texto?: string }[],
    duracionSegundos: number
) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // A. Obtener datos de la prueba a través del resultadoId
        const datosPrueba = await new sql.Request(transaction)
            .input('resultadoId', sql.Int, resultadoId)
            .query(`
                SELECT p.PruebaID, p.RecursoID, p.TipoExamen, p.FechaCierre, p.ModoRevision 
                FROM Virtual.PruebasResultados r
                JOIN Virtual.Pruebas p ON r.PruebaID = p.PruebaID
                WHERE r.ResultadoID = @resultadoId
            `);

        if (datosPrueba.recordset.length === 0) throw new Error('Intento no encontrado.');
        const { PruebaID, RecursoID, TipoExamen, FechaCierre, ModoRevision } = datosPrueba.recordset[0];

        // Validar fecha de cierre con tolerancia de 5 mins (latencia de red)
        if (new Date() > new Date(new Date(FechaCierre).getTime() + 5 * 60000)) {
             // Opcional: Podrías permitirlo pero marcarlo como tardío. Aquí lanzamos error.
             // throw new Error('El tiempo de la prueba ha expirado.');
        }

        // B. Obtener respuestas correctas de la BD
        const preguntasDB = await new sql.Request(transaction)
            .input('pruebaId', sql.Int, PruebaID)
            .query(`
                SELECT p.PreguntaID, p.TextoPregunta, p.TipoPregunta, p.Porcentaje,
                       r.RespuestaID, r.TextoRespuesta, r.EsCorrecta, r.TextoRespuestaPar
                FROM Virtual.Pruebas_Preguntas p
                LEFT JOIN Virtual.Pruebas_Respuestas r ON p.PreguntaID = r.PreguntaID
                WHERE p.PruebaID = @pruebaId
            `);

        // Mapear preguntas para búsqueda rápida
        const mapaPreguntas = new Map<number, { texto: string, tipo: string, peso: number, respuestas: any[] }>();
        preguntasDB.recordset.forEach((row: any) => {
            if (!mapaPreguntas.has(row.PreguntaID)) {
                mapaPreguntas.set(row.PreguntaID, { 
                    texto: row.TextoPregunta,
                    tipo: row.TipoPregunta, 
                    peso: Number(row.Porcentaje), 
                    respuestas: [] 
                });
            }
            if (row.RespuestaID) {
                mapaPreguntas.get(row.PreguntaID)!.respuestas.push(row);
            }
        });

        // C. Algoritmo de Calificación
        let puntajeAcumulado = 0; // Escala 0 a 100
        let requiereManual = false;
        let respuestaEnsayoTexto = '';

        const detalleRevision: any[] = [];

        const mostrarRespuestas = ModoRevision === 'VerSoloRespuestas' || ModoRevision === 'VerAmbas';

        for (const respEstudiante of respuestas) {
            const infoPregunta = mapaPreguntas.get(respEstudiante.PreguntaID);
            if (!infoPregunta) continue;

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
            } else if (infoPregunta.tipo === 'SeleccionMultiple') {
                const correctasIds = infoPregunta.respuestas.filter(r => r.EsCorrecta).map(r => r.RespuestaID);
                const seleccionados = respEstudiante.SelectedIds || [];
                // Coincidencia exacta de arrays (sin orden)
                if (correctasIds.length === seleccionados.length && 
                    correctasIds.every(id => seleccionados.includes(id))) {
                    esCorrecta = true;
                }
            } else if (infoPregunta.tipo === 'Relacionar') {
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
                    EsCorrecta: mostrarRespuestas ? r.EsCorrecta : undefined, 
                    TextoRespuestaPar: mostrarRespuestas ? r.TextoRespuestaPar : undefined
                }))
            });
        }}

        // D. Cálculo Final de Nota (Escala 0.0 a 5.0)
        // Si el examen es 'Diagnostico' o 'Cognoscitiva' (sin nota), igual calculamos pero el front decide si mostrar.
        // Asumimos que la BD siempre guarda la nota por referencia.
        const calificacionFinal = (puntajeAcumulado / 100) * 5;

        // E. ACTUALIZAR REGISTRO (UPDATE)
        await new sql.Request(transaction)
            .input('resultadoId', sql.Int, resultadoId)
            .input('fechaEntrega', sql.DateTime, new Date())
            .input('estado', sql.NVarChar(40), requiereManual ? 'Pendiente' : 'Calificado')
            .input('calificacion', sql.Decimal(5, 2), calificacionFinal)
            .input('manual', sql.Bit, requiereManual)
            .input('ensayo', sql.NVarChar(sql.MAX), respuestaEnsayoTexto || null)
            .input('duracion', sql.Int, duracionSegundos)
            .query(`
                UPDATE Virtual.PruebasResultados
                SET 
                    FechaEntrega = @fechaEntrega,
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

    } catch (err) {
        await transaction.rollback();
        console.error("Error al entregar prueba:", err);
        throw err;
    }
};

// Obtener detalles completos de una prueba
export const getPruebaDetalles = async (id: number): Promise<PruebaDetalles | undefined> => {
  const pool = await poolPromise;

  const result = await pool.request()
    .input('id', sql.Int, id)
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

  if (result.recordset.length === 0) return undefined;

  const row = result.recordset[0];
  const prueba: PruebaDetalles = {
    ...row,
    FechaPublicacion: new Date(row.FechaPublicacion),
    FechaInicio: new Date(row.FechaInicio),
    FechaCierre: new Date(row.FechaCierre),
    Preguntas: [],
    NumeroIntentos: row.NumeroIntentos ?? null,
    Finalizada: Boolean(result.recordset[0].Finalizada),
  };

  // Preguntas
  const preguntasResult = await pool.request()
    .input('pruebaId', sql.Int, prueba.PruebaID)
    .query(`
      SELECT PreguntaID, TextoPregunta, TipoPregunta, Porcentaje
      FROM Virtual.Pruebas_Preguntas
      WHERE PruebaID = @pruebaId
      ORDER BY PreguntaID;
    `);

  for (const p of preguntasResult.recordset) {
    const respuestasResult = await pool.request()
      .input('preguntaId', sql.Int, p.PreguntaID)
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
      Respuestas: respuestasResult.recordset.map((r: any) => ({
        RespuestaID: r.RespuestaID,
        TextoRespuesta: r.TextoRespuesta,
        TextoRespuestaPar: r.TextoRespuestaPar,
        EsCorrecta: !!r.EsCorrecta
      }))
    });
  }

  return prueba;
};

export const setPruebaFinalizada = async (pruebaId: number, finalizada: boolean) => {
  const pool = await poolPromise;
  await pool.request()
    .input('pruebaId', sql.Int, pruebaId)
    .input('fin', sql.Bit, finalizada ? 1 : 0)
    .query(`
      UPDATE Virtual.Pruebas
      SET Finalizada = @fin
      WHERE PruebaID = @pruebaId;
    `);
};


// Actualizar el nombre de la competencia de una prueba
export const updatePruebaCompetencia = async (pruebaId: number, nombreCompetencia: string) => {
    const pool = await poolPromise;
    await pool.request()
        .input('pruebaId', sql.Int, pruebaId)
        .input('nombreCompetencia', sql.NVarChar(255), nombreCompetencia)
        .query(`
            UPDATE Virtual.Pruebas
            SET NombreCompetencia = @nombreCompetencia
            WHERE PruebaID = @pruebaId;
        `);
};

// Actualizar el estado de publicado de una prueba
export const setPruebaPublicado = async (pruebaId: number, publicado: boolean) => {
    const pool = await poolPromise;
    await pool.request()
        .input('pruebaId', sql.Int, pruebaId)
        .input('publicado', sql.Bit, publicado)
        .query(`
            UPDATE Virtual.Pruebas
            SET Publicado = @publicado
            WHERE PruebaID = @pruebaId;
        `);
};

// Añadir una pregunta y sus respuestas a una prueba
export const addPreguntaToPrueba = async (pruebaId: number, pregunta: Omit<Pregunta, 'PreguntaID'>) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input('pruebaId', sql.Int, pruebaId)
      .input('textoPregunta', sql.NVarChar(sql.MAX), pregunta.TextoPregunta)
      .input('tipoPregunta', sql.NVarChar(50), pregunta.TipoPregunta)
      .input('porcentaje', sql.Decimal(5, 2), pregunta.Porcentaje)
      .query(`
        INSERT INTO Virtual.Pruebas_Preguntas (PruebaID, TextoPregunta, TipoPregunta, Porcentaje)
        OUTPUT INSERTED.PreguntaID
        VALUES (@pruebaId, @textoPregunta, @tipoPregunta, @porcentaje);
      `);

    const newPreguntaId = result.recordset[0].PreguntaID;

    if (pregunta.TipoPregunta !== 'Ensayo' && pregunta.Respuestas?.length) {
      for (const res of pregunta.Respuestas) {
        await new sql.Request(transaction)
          .input('preguntaId', sql.Int, newPreguntaId)
          .input('textoRespuesta', sql.NVarChar(sql.MAX), res.TextoRespuesta ?? null)
          .input('textoPar', sql.NVarChar(sql.MAX), res.TextoRespuestaPar ?? null)
          .input('correcta', sql.Bit, res.EsCorrecta ? 1 : 0)
          .query(`
            INSERT INTO Virtual.Pruebas_Respuestas (PreguntaID, TextoRespuesta, TextoRespuestaPar, EsCorrecta)
            VALUES (@preguntaId, @textoRespuesta, @textoPar, @correcta);
          `);
      }
    }

    await transaction.commit();
    return newPreguntaId;
  } catch (err) {
    await transaction.rollback();
    console.error("Error en transacción de añadir pregunta:", err);
    throw err;
  }
};

// Actualizar una pregunta y sus respuestas
export const updatePregunta = async (preguntaId: number, pregunta: Omit<Pregunta, 'PreguntaID'>) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input('preguntaId', sql.Int, preguntaId)
      .input('textoPregunta', sql.NVarChar(sql.MAX), pregunta.TextoPregunta)
      .input('tipoPregunta', sql.NVarChar(50), pregunta.TipoPregunta)
      .input('porcentaje', sql.Decimal(5, 2), pregunta.Porcentaje)
      .query(`
        UPDATE Virtual.Pruebas_Preguntas
        SET TextoPregunta = @textoPregunta, TipoPregunta = @tipoPregunta, Porcentaje = @porcentaje
        WHERE PreguntaID = @preguntaId;
      `);

    await new sql.Request(transaction)
      .input('preguntaId', sql.Int, preguntaId)
      .query('DELETE FROM Virtual.Pruebas_Respuestas WHERE PreguntaID = @preguntaId;');

    if (pregunta.TipoPregunta !== 'Ensayo' && pregunta.Respuestas?.length) {
      for (const res of pregunta.Respuestas) {
        await new sql.Request(transaction)
          .input('preguntaId', sql.Int, preguntaId)
          .input('textoRespuesta', sql.NVarChar(sql.MAX), res.TextoRespuesta ?? null)
          .input('textoPar', sql.NVarChar(sql.MAX), res.TextoRespuestaPar ?? null)
          .input('correcta', sql.Bit, res.EsCorrecta ? 1 : 0)
          .query(`
            INSERT INTO Virtual.Pruebas_Respuestas (PreguntaID, TextoRespuesta, TextoRespuestaPar, EsCorrecta)
            VALUES (@preguntaId, @textoRespuesta, @textoPar, @correcta);
          `);
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    console.error("Error en transacción de actualizar pregunta:", err);
    throw err;
  }
};

export const updatePruebaConfig = async (pruebaId: number, data: PruebaConfigPayload) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 1. Obtener RecursoID asociado a la prueba
        const currentData = await new sql.Request(transaction)
            .input('pruebaId', sql.Int, pruebaId)
            .query('SELECT RecursoID FROM Virtual.Pruebas WHERE PruebaID = @pruebaId');
        
        if (currentData.recordset.length === 0) throw new Error('Prueba no encontrada');
        const recursoId = currentData.recordset[0].RecursoID;

        // 2. Actualizar Tabla Base (Virtual.Recursos)
        await new sql.Request(transaction)
            .input('recursoId', sql.Int, recursoId)
            .input('titulo', sql.NVarChar(1024), data.titulo)
            .input('contenido', sql.NVarChar(sql.MAX), data.contenido)
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

        await new sql.Request(transaction)
            .input('pruebaId', sql.Int, pruebaId)
            .input('tipoExamen', sql.NVarChar(50), data.tipoExamen) // Diagnostico/Cognitivo
            .input('duracion', sql.SmallInt, data.duracionMinutos)
            .input('intentos', sql.SmallInt, data.numeroIntentos)
            .input('contrasena', sql.NVarChar(50), data.contrasena || null)
            .input('revision', sql.NVarChar(50), data.modoRevision)
            .input('inicio', sql.DateTime, fechaInicio)
            .input('cierre', sql.DateTime, fechaCierre)
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
        await new sql.Request(transaction)
             .input('recursoId', sql.Int, recursoId)
             .query('DELETE FROM Virtual.RecursosEstudiantes WHERE RecursoID = @recursoId');

        // Insertamos nuevos si es personalizado
        if (data.esPersonalizado && data.estudiantesIds && data.estudiantesIds.length > 0) {
            const t = new sql.Table('Virtual.RecursosEstudiantes');
            t.columns.add('RecursoID', sql.Int);
            t.columns.add('MatriculaNo', sql.Int);
            for (const id of data.estudiantesIds) {
                t.rows.add(recursoId, id);
            }
            await new sql.Request(transaction).bulk(t);
        }

        await transaction.commit();
        return { success: true };

    } catch (err) {
        await transaction.rollback();
        console.error("Error actualizando configuración de prueba:", err);
        throw err;
    }
};

// Eliminar una pregunta y sus respuestas
export const deletePregunta = async (preguntaId: number) => {
    const pool = await poolPromise;
    // Las respuestas se eliminarán en cascada gracias a la FK ON DELETE CASCADE
    await pool.request()
        .input('preguntaId', sql.Int, preguntaId)
        .query('DELETE FROM Virtual.Pruebas_Preguntas WHERE PreguntaID = @preguntaId;');
};

export const getEstudiantesParaPrueba = async (pruebaId: number) => {
  const pool = await poolPromise;

  // 1) Resolver CodigoAsignatura desde Semanas (tu esquema real)
  const rsAsig = await pool.request()
    .input('pruebaId', sql.Int, pruebaId)
    .query<{
      CodigoAsignatura: number;
    }>(`
      SELECT TOP 1 s.CodigoAsignatura
      FROM Virtual.Pruebas p
      INNER JOIN Virtual.Recursos   r  ON r.RecursoID   = p.RecursoID
      INNER JOIN Virtual.Apartados  ap ON ap.ApartadoID = r.ApartadoID
      INNER JOIN Virtual.Semanas    s  ON s.SemanaID    = ap.SemanaID
      WHERE p.PruebaID = @pruebaId;
    `);

  const codigoAsignatura: number | undefined = rsAsig.recordset?.[0]?.CodigoAsignatura;
  if (!codigoAsignatura) {
    // Mensaje claro para depurar fácilmente (el controller lo envía con 500/404 si quieres)
    throw new Error('No se pudo determinar la asignatura de la prueba (Semanas.CodigoAsignatura).');
  }

  // 2) Traer estudiantes de esa asignatura (con nombres desglosados)
  const rsEst = await pool.request()
  .input('codigoAsignatura', sql.SmallInt, codigoAsignatura)
  .input('pruebaId', sql.Int, pruebaId)
  .query<EstudianteDetalleRow>(`
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
      ON re.RecursoID = r.RecursoID AND re.MatriculaNo = e.[MatrículaNo]
    WHERE a.[Código] = @codigoAsignatura
      AND (e.Estado IS NULL OR e.Estado <> 'Retirado')
      AND (re.RecursoID IS NULL OR re.RecursoID = r.RecursoID) -- quita esta línea si quieres obligar a personalización
    ORDER BY e.PrimerApellido, e.PrimerNombre;
  `);

  // 3) Adaptar al shape que consume el front (sin usar "name split")
  return rsEst.recordset.map(e => ({
    MatriculaNo: e.MatriculaNo,
    PrimerNombre: e.PrimerNombre,
    PrimerApellido: e.PrimerApellido,
  }));
};

export const getResultadosSimulacro = async (pruebaId: number): Promise<SimulacroInfo[]> => {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input('pruebaId', sql.Int, pruebaId)
    .query<SimulacroDBRow>(`
      SELECT SimulacroID, PruebaID, MatriculaNo, Fecha, Calificacion, DuracionSegundos
      FROM Virtual.PruebasSimulacros
      WHERE PruebaID = @pruebaId
      ORDER BY Fecha ASC;
    `);
  return rs.recordset.map((r: any) => ({
    SimulacroID: r.SimulacroID,
    PruebaID: r.PruebaID,
    MatriculaNo: r.MatriculaNo,
    Fecha: r.Fecha,
    Calificacion: Number(r.Calificacion ?? 0),
    DuracionSegundos: r.DuracionSegundos ?? null,
  }));
};


export const getResultadosReales = async (pruebaId: number) => {
  const pool = await poolPromise;

  const rsRes = await pool.request()
    .input('pruebaId', sql.Int, pruebaId)
    .query<PruebaResultadoDBRow>(`
      SELECT ResultadoID, PruebaID, MatriculaNo, FechaEntrega, Estado, CalificacionFinal, RequiereCalificacionManual, RespuestaEnsayo
      FROM Virtual.PruebasResultados
      WHERE PruebaID = @pruebaId;
    `);

  const ids: number[] = rsRes.recordset.map((r) => Number(r.MatriculaNo)).filter(n => !Number.isNaN(n));

  if (ids.length === 0) {
    // No hay resultados, devolvemos vacío con forma esperada
    return [];
  }

  const idParams = ids.map((_, i) => `@id${i}`).join(',');
  const req = pool.request();
  ids.forEach((id, i) => req.input(`id${i}`, sql.Int, id));

  const rsEst = await req.query<EstudianteSimpleRow>(`
    SELECT [MatrículaNo] AS MatriculaNo, PrimerNombre, PrimerApellido
    FROM dbo.Estudiantes
    WHERE [MatrículaNo] IN (${idParams});
  `);

  const map = new Map<number, { PrimerNombre: string; PrimerApellido: string }>();
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

export const deleteSimulacroById = async (simulacroId: number) => {
  const pool = await poolPromise;
  await pool.request()
    .input('simulacroId', sql.Int, simulacroId)
    .query(`DELETE FROM Virtual.PruebasSimulacros WHERE SimulacroID = @simulacroId;`);
};

// === NUEVO: guardar calificación ===
export const setResultadoCalificacion = async (resultadoId: number, calificacionFinal: number, retroalimentacion?: string) => {
  const pool = await poolPromise;
  await pool.request()
    .input('resultadoId', sql.Int, resultadoId)
    .input('cal', sql.Decimal(3, 1), calificacionFinal)
    .input('retro', sql.NVarChar(sql.MAX), retroalimentacion ?? null)
    .query(`
      UPDATE Virtual.PruebasResultados
      SET CalificacionFinal = @cal, Estado = 'Calificado'
      WHERE ResultadoID = @resultadoId;
      -- Si tienes una tabla de comentarios, inserta @retro allí.
    `);
};

export const validateAndSetPublicado = async (pruebaId: number, publicado: boolean) => {
  const pool = await poolPromise;

  if (!publicado) {
    await pool.request()
      .input('pruebaId', sql.Int, pruebaId)
      .input('pub', sql.Bit, false)
      .query(`UPDATE Virtual.Pruebas SET Publicado = @pub WHERE PruebaID = @pruebaId;`);
    return;
  }

  const rs = await pool.request()
    .input('pruebaId', sql.Int, pruebaId)
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
    .input('pruebaId', sql.Int, pruebaId)
    .input('pub', sql.Bit, true)
    .query(`UPDATE Virtual.Pruebas SET Publicado = @pub WHERE PruebaID = @pruebaId;`);
};

export const createSimulacro = async (
  pruebaId: number,
  matriculaNo: number,
  calificacion?: number,
  duracionSegundos?: number
): Promise<number> => {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input('pruebaId', sql.Int, pruebaId)
    .input('matriculaNo', sql.Int, matriculaNo)
    .input('cal', sql.Decimal(3, 1), calificacion ?? null)
    .input('dur', sql.Int, typeof duracionSegundos === 'number' ? duracionSegundos : null)
    .query<{ SimulacroID: number }>(`
      INSERT INTO Virtual.PruebasSimulacros (PruebaID, MatriculaNo, Fecha, Calificacion, DuracionSegundos)
      OUTPUT INSERTED.SimulacroID
      VALUES (@pruebaId, @matriculaNo, GETUTCDATE(), @cal, @dur);
    `);

  return Number(rs.recordset[0].SimulacroID);
};

export const getPublicacionByRecursoId = async (recursoId: number): Promise<boolean | null> => {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input('recursoId', sql.Int, recursoId)
    .query(`
      SELECT CAST(p.Publicado AS bit) AS Publicado
      FROM Virtual.Pruebas p
      WHERE p.RecursoID = @recursoId
    `);

  if (!rs.recordset.length) return null;
  return Boolean(rs.recordset[0].Publicado);
};

export const getPublicacionesByRecursoIds = async (
  recursoIds: number[]
): Promise<Array<{ recursoId: number; publicado: boolean }>> => {
  const pool = await poolPromise;
  const idsJson = JSON.stringify(recursoIds);

  const rs = await pool.request()
    .input('ids', sql.NVarChar(sql.MAX), idsJson)
    .query<PublicacionDBRow>(` 
      WITH ids AS (
        SELECT CAST([value] AS int) AS RecursoID
        FROM OPENJSON(@ids)
      )
      SELECT p.RecursoID, CAST(p.Publicado AS bit) AS Publicado
      FROM ids
      LEFT JOIN Virtual.Pruebas p ON p.RecursoID = ids.RecursoID
    `);

  return rs.recordset
    .filter((r: any) => r.RecursoID != null)
    .map((r: any) => ({
      recursoId: Number(r.RecursoID),
      publicado: Boolean(r.Publicado),
    }));
};

export const validateAndSetPublicadoReturningRecurso = async (pruebaId: number, publicado: boolean) => {
  const pool = await poolPromise;

  if (!publicado) {
    const rs = await pool.request()
      .input('pruebaId', sql.Int, pruebaId)
      .input('pub', sql.Bit, false)
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
    .input('pruebaId', sql.Int, pruebaId)
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
    .input('pruebaId', sql.Int, pruebaId)
    .input('pub', sql.Bit, true)
    .query(`
      UPDATE Virtual.Pruebas
      SET Publicado = @pub
      OUTPUT INSERTED.RecursoID AS RecursoID, INSERTED.Publicado AS Publicado
      WHERE PruebaID = @pruebaId;
    `);

  return { recursoId: rsUpd.recordset[0]?.RecursoID ?? null, publicado: !!rsUpd.recordset[0]?.Publicado };
};

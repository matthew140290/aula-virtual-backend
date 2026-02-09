// src/services/semana.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';

interface Resource {
  id: number;
  titulo: string;
  contenido: string;
  tipoRecurso: string;
  fechaCreacion: string;
  urlExterna?: string;
  fechaInicio?: string;
  fechaCierre?: string;
  puntajeMaximo?: number;
  permiteEntregasTardias?: boolean;
  tiposArchivoPermitidos?: string;
  DuracionMinutos?: number;
  NumeroIntentos?: number;
  ModoRevision?: string;
  Contrasena?: string;
  Publicado?: boolean;
  EsCalificable?: boolean;
  PermitirPublicacionTardia?: boolean;
}

const defaultApartados = [
  { Nombre: 'Misión y Visión', Orden: 1, Tipo: 'mision_vision' },
  { Nombre: 'Recursos de Aprendizaje', Orden: 2, Tipo: 'recursos' },
  { Nombre: 'Lecturas Complementarias', Orden: 3, Tipo: 'lecturas' },
  { Nombre: 'Actividades de Aprendizaje', Orden: 4, Tipo: 'actividades' },
  { Nombre: 'Foros', Orden: 5, Tipo: 'foros' },
];

// Obtener todas las semanas de una asignatura en un período
export const findWeeksByCourseAndPeriod = async (codigoAsignatura: number, numeroPeriodo: number) => {
  let pool;
  try {
    const pool = await poolPromise;
    // La consulta principal ahora es más compleja para traer todos los datos anidados
    const result = await pool.request()
      .input('codigoAsignatura', sql.SmallInt, codigoAsignatura)
      .input('numeroPeriodo', sql.SmallInt, numeroPeriodo)
      .query(`
        SELECT 
            -- Datos Semana
            s.SemanaID as id, s.Nombre as name, s.Fijado as isPinned,
            
            -- Datos Apartado
            a.ApartadoID as apartado_id, a.Nombre as apartado_nombre, a.TipoApartado as apartado_tipo, a.Fijado as apartado_fijado,
            
            -- Datos Recurso Base
            r.RecursoID as recurso_id,
            r.TipoRecurso as recurso_tipo,
            r.Titulo as recurso_titulo,
            r.Contenido as recurso_contenido,
            r.UrlExterna as recurso_urlExterna,
            r.FechaCreacion as recurso_fecha_creacion,
            r.Visible as recurso_visible,
            
            -- Contadores
            (SELECT COUNT(*) FROM Virtual.VistasRecursos WHERE RecursoID = r.RecursoID) as recurso_vistas,
            (SELECT COUNT(*) FROM dbo.Estudiantes se WHERE se.CódigoCurso = asig.CódigoCurso AND (se.Estado IS NULL OR se.Estado != 'Retirado')) as total_estudiantes,
            (SELECT COUNT(*) FROM Virtual.EntregasTareas et JOIN Virtual.Tareas t ON et.TareaID = t.TareaID WHERE t.RecursoID = r.RecursoID AND et.Calificacion IS NOT NULL) as total_calificadas,
            (SELECT COUNT(*) FROM Virtual.EntregasTareas et JOIN Virtual.Tareas t ON et.TareaID = t.TareaID WHERE t.RecursoID = r.RecursoID) as total_entregas,

            -- ✅ DATOS ESPECÍFICOS (Alias unificados para facilitar el mapeo)
            
            -- Tarea
            t.FechaInicio as t_inicio, 
            t.FechaVencimiento as t_fin, 
            t.PuntajeMaximo as t_puntaje,
            t.PermiteEntregasTardias as t_tardias,
            t.TiposArchivoPermitidos as t_archivos,

            -- Prueba
            p.FechaInicio as p_inicio,
            p.FechaCierre as p_fin,
            p.DuracionMinutos as p_duracion,
            p.NumeroIntentos as p_intentos,
            p.ModoRevision as p_revision,
            p.Contrasena as p_password,
            p.Publicado as p_publicado,

            -- Foro
            f.FechaInicio as f_inicio,
            f.FechaCierre as f_fin,
            f.EsCalificable as f_calificable,
            f.PuntajeMaximo as f_puntaje,
            f.PermitirPublicacionTardia as f_tardia,

            -- Videoconferencia
            v.FechaInicio as v_inicio,
            v.FechaCierre as v_fin

        FROM Virtual.Semanas s
        LEFT JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
        LEFT JOIN Virtual.Apartados a ON s.SemanaID = a.SemanaID
        LEFT JOIN Virtual.Recursos r ON a.ApartadoID = r.ApartadoID
        
        -- JOINS A TABLAS HIJAS
        LEFT JOIN Virtual.Tareas t ON r.RecursoID = t.RecursoID
        LEFT JOIN Virtual.Pruebas p ON r.RecursoID = p.RecursoID
        LEFT JOIN Virtual.Foros f ON r.RecursoID = f.RecursoID
        LEFT JOIN Virtual.Videoconferencias v ON r.RecursoID = v.RecursoID

        WHERE s.CodigoAsignatura = @codigoAsignatura AND s.NumeroPeriodo = @numeroPeriodo
        ORDER BY s.Orden, a.Orden, r.Orden;
      `);
    
    // Procesamos el resultado plano para anidar los datos
    const weeksMap = new Map();
    for (const row of result.recordset) {
        if (!weeksMap.has(row.id)) {
            weeksMap.set(row.id, {
                id: row.id,
                name: row.name,
                isPinned: row.isPinned,
                apartados: new Map() // Usamos un mapa para apartados
            });
        }

        const week = weeksMap.get(row.id);
        
        if (row.apartado_id && !week.apartados.has(row.apartado_id)) {
            week.apartados.set(row.apartado_id, {
                id: row.apartado_id,
                title: row.apartado_nombre,
                sectionType: row.apartado_tipo,
                isPinned: row.apartado_fijado,
                resources: [] as Resource[],
            });
        }
        
        if (row.recurso_id) {
            const apartado = week.apartados.get(row.apartado_id);
            if (!apartado.resources.some((r: Resource) => r.id === row.recurso_id)) {

              let fechaInicio = row.t_inicio || row.p_inicio || row.f_inicio || row.v_inicio;
              let fechaCierre = row.t_fin || row.p_fin || row.f_fin || row.v_fin;
              let puntajeMaximo = row.t_puntaje || row.f_puntaje;

            apartado.resources.push({
                id: row.recurso_id,
                titulo: row.recurso_titulo,
                contenido: row.recurso_contenido, // Asegúrate de seleccionar esta columna
                tipoRecurso: row.recurso_tipo,
                fechaCreacion: row.recurso_fecha_creacion,
                urlExterna: row.recurso_urlExterna,
                Visible: row.recurso_visible,
                vistas: row.recurso_vistas, 
                totalEstudiantes: row.total_estudiantes,
                totalCalificadas: row.total_calificadas,
                totalEntregas: row.total_entregas,
                // ✅ MAPEO DE DATOS ESPECÍFICOS PARA EDICIÓN
                fechaInicio: fechaInicio,
                fechaCierre: fechaCierre,
                puntajeMaximo: puntajeMaximo,
                
                // Tarea
                permiteEntregasTardias: row.t_tardias,
                tiposArchivoPermitidos: row.t_archivos,

                
                DuracionMinutos: row.p_duracion,
                NumeroIntentos: row.p_intentos,
                ModoRevision: row.p_revision,
                Contrasena: row.p_password,
                Publicado: row.p_publicado,

                // Foro
                EsCalificable: row.f_calificable,
                PermitirPublicacionTardia: row.f_tardia
            });
        }
        }
    }

    // Convertimos los mapas a arrays para la respuesta final
    const finalResult = Array.from(weeksMap.values()).map(week => {
        week.apartados = Array.from(week.apartados.values());
        return week;
    });

    return finalResult;

  } catch (error) {
      console.error('Error al obtener las semanas y sus apartados:', error);
      throw new Error('Error de BD al obtener las semanas.');
  } 
};

// CREAR múltiples semanas Y SUS APARTADOS POR DEFECTO
export const createWeeks = async (weeksData: { name: string; codigoAsignatura: number; numeroPeriodo: number; orden: number }[]) => {
  let pool;
  let transaction;
  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1. Insertar las nuevas semanas y OBTENER sus IDs
    const newWeekIds: number[] = [];
    for (const week of weeksData) {
      const result = await transaction.request()
        .input('codigoAsignatura', sql.SmallInt, week.codigoAsignatura)
        .input('numeroPeriodo', sql.SmallInt, week.numeroPeriodo)
        .input('nombre', sql.NVarChar(255), week.name)
        .input('orden', sql.Int, week.orden)
        .query(`
          INSERT INTO Virtual.Semanas (CodigoAsignatura, NumeroPeriodo, Nombre, Orden, Fijado)
          OUTPUT INSERTED.SemanaID
          VALUES (@codigoAsignatura, @numeroPeriodo, @nombre, @orden, 0);
        `);
      newWeekIds.push(result.recordset[0].SemanaID);
    }

    console.log(`Semanas creadas con IDs: ${newWeekIds.join(', ')}`);

    // 2. Para cada nuevo ID de semana, insertar los apartados por defecto
    const apartadosTable = new sql.Table('Virtual.Apartados');
    apartadosTable.columns.add('SemanaID', sql.Int, { nullable: false });
    apartadosTable.columns.add('Nombre', sql.NVarChar(255), { nullable: false });
    apartadosTable.columns.add('Orden', sql.Int, { nullable: false });
    apartadosTable.columns.add('TipoApartado', sql.NVarChar(100), { nullable: true });
    apartadosTable.columns.add('Fijado', sql.Bit, { nullable: false });

    for (const weekId of newWeekIds) {
      for (const apartado of defaultApartados) {
        apartadosTable.rows.add(weekId, apartado.Nombre, apartado.Orden, apartado.Tipo, false);
      }
    }
    
    if (apartadosTable.rows.length > 0) {
        console.log(`Insertando ${apartadosTable.rows.length} apartados por defecto...`);
        const request = new sql.Request(transaction);
        await request.bulk(apartadosTable);
    }

    await transaction.commit();
    console.log('Transacción completada exitosamente.');

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('--- ERROR DETALLADO DEL SERVICIO ---', error);
    throw new Error('Error de base de datos al crear semanas y sus apartados.');
  }
};

// Actualizar el nombre de una semana
export const updateWeekName = async (semanaId: number, newName: string) => {
  const pool = await poolPromise;
  await pool.request()
    .input('semanaId', sql.Int, semanaId)
    .input('newName', sql.NVarChar(255), newName)
    .query('UPDATE Virtual.Semanas SET Nombre = @newName WHERE SemanaID = @semanaId');
};

// Eliminar una semana
export const deleteWeekById = async (semanaId: number) => {
  const pool = await poolPromise;
  await pool.request()
    .input('semanaId', sql.Int, semanaId)
    .query('DELETE FROM Virtual.Semanas WHERE SemanaID = @semanaId');
};

export const cloneWeekById = async (semanaId: number) => {
  let pool;
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1. Obtener los datos de la semana original
    const weekToCloneResult = await transaction.request()
      .input('semanaId', sql.Int, semanaId)
      .query('SELECT CodigoAsignatura, NumeroPeriodo, Nombre FROM Virtual.Semanas WHERE SemanaID = @semanaId');
    
    if (weekToCloneResult.recordset.length === 0) {
      throw new Error('La semana que intentas clonar no existe.');
    }
    const weekToClone = weekToCloneResult.recordset[0];

    // 2. Encontrar el número de orden más alto para colocar la copia al final
    const maxOrderResult = await transaction.request()
      .input('codigoAsignatura', sql.SmallInt, weekToClone.CodigoAsignatura)
      .input('numeroPeriodo', sql.SmallInt, weekToClone.NumeroPeriodo)
      .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Semanas WHERE CodigoAsignatura = @codigoAsignatura AND NumeroPeriodo = @numeroPeriodo');
    
    const newOrder = maxOrderResult.recordset[0].maxOrden + 1;

    // 3. Insertar la nueva semana (la copia)
    await transaction.request()
      .input('codigoAsignatura', sql.SmallInt, weekToClone.CodigoAsignatura)
      .input('numeroPeriodo', sql.SmallInt, weekToClone.NumeroPeriodo)
      .input('nombre', sql.NVarChar(255), `${weekToClone.Nombre} (Copia)`)
      .input('orden', sql.Int, newOrder)
      .query(`
        INSERT INTO Virtual.Semanas (CodigoAsignatura, NumeroPeriodo, Nombre, Orden, Fijado)
        VALUES (@codigoAsignatura, @numeroPeriodo, @nombre, @orden, 0)
      `);
      
    await transaction.commit();
  } catch (error) {
    console.error('Error al clonar la semana:', error);
    throw new Error('Error de base de datos al clonar la semana.');
  }
};
// src/services/estudiante.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';

interface Student {
  id: number;
  name: string;
}

export interface VistaEstudianteDTO {
    // Datos Generales del Recurso
    id: number;
    titulo: string;
    contenido: string;
    tipo: string;
    urlExterna?: string;
    
    // Configuración de Tarea/Prueba (Reglas de Negocio)
    fechaCierre?: Date;       // Para Tarea y Prueba
    permiteTardias?: boolean; // Solo Tarea
    tiposArchivo?: string;    // Solo Tarea
    intentosMax?: number;     // Solo Prueba
    duracionMinutos?: number; // Solo Prueba

    // Estado del Estudiante (Lo que ha hecho)
    estado: {
        entregado: boolean;
        fechaEntrega?: Date;
        calificacion?: number;
        intentosUsados?: number; // Solo Prueba
        retroalimentacion?: string;
        urlArchivo?: string;     // El archivo que subió el estudiante
    };
}

export const findEstudiantesByAsignatura = async (codigoAsignatura: number): Promise<Student[]> => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('codigoAsignatura', sql.SmallInt, codigoAsignatura)
        .query(`
            SELECT 
                e.MatrículaNo as id,
                LTRIM(RTRIM(CONCAT(
                    e.PrimerApellido, ' ', e.SegundoApellido, ' ', 
                    e.PrimerNombre, ' ', e.SegundoNombre
                ))) as name
            FROM dbo.Estudiantes as e
            JOIN dbo.Asignaturas as a ON e.CódigoCurso = a.CódigoCurso
            WHERE a.Código = @codigoAsignatura 
              AND (e.Estado IS NULL OR e.Estado != 'Retirado')
            ORDER BY name;
        `)
    return result.recordset;
};

export const findAsignaturasByEstudiante = async (matriculaNo: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .query(`
            SELECT 
                asig.Código AS CodigoAsignatura,
                asig.Descripción AS NombreAsignatura,
                cur.Curso AS NombreCurso,
                g.Descripción AS NombreGrado,
                doc.PrimerNombre + ' ' + doc.PrimerApellido AS NombreDocente
            FROM dbo.Estudiantes e
            JOIN dbo.Asignaturas asig ON e.CódigoCurso = asig.CódigoCurso
            JOIN dbo.Cursos cur ON asig.CódigoCurso = cur.Código
            JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
            -- Usamos un LEFT JOIN para el docente en caso de que no haya uno asignado
            LEFT JOIN dbo.AsignaciónAcadémica aa ON asig.Código = aa.CódigoAsignatura
            LEFT JOIN dbo.Docentes doc ON aa.CódigoDocente = doc.Código
            WHERE e.MatrículaNo = @matriculaNo
            ORDER BY asig.Descripción;
        `);
    return result.recordset;
};


export const findEventosProximosByEstudiante = async (matriculaNo: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .query(`
            SELECT TOP 20
                r.RecursoID as id,
                r.TipoRecurso as tipo,
                r.Titulo as titulo,
                
                -- Nombre de la Asignatura
                asig.Descripción as nombreAsignatura,
                
                -- Nombre del Docente (Concatenación segura)
                ISNULL(doc.PrimerNombre, '') + ' ' + ISNULL(doc.PrimerApellido, '') as nombreDocente,
                
                -- Fecha de Publicación (Para ordenar el feed)
                r.FechaCreacion as fechaPublicacion,

                -- Fecha unificada: Vencimiento o Cierre (Solo si aplica)
                COALESCE(
                    t.FechaVencimiento, 
                    f.FechaCierre, 
                    p.FechaCierre, 
                    an.FechaCierre,
                    vid.FechaCierre
                ) as fechaFinal

            FROM dbo.Estudiantes e
            -- 1. Obtenemos las asignaturas inscritas del estudiante
            -- (Nota: Dependiendo de tu modelo, puede ser via InscripcionEstudiantes o directo por CódigoCurso)
            -- Asumiendo el modelo directo por GRADO/CURSO como en tus otras funciones:
            JOIN dbo.Asignaturas asig ON e.CódigoCurso = asig.CódigoCurso
            
            -- 2. Bajamos a los recursos: Asignatura -> Semanas -> Apartados -> Recursos
            JOIN Virtual.Semanas s ON asig.Código = s.CodigoAsignatura
            JOIN Virtual.Apartados apt ON s.SemanaID = apt.SemanaID
            JOIN Virtual.Recursos r ON apt.ApartadoID = r.ApartadoID
            
            -- 3. Obtenemos el docente
            LEFT JOIN dbo.AsignaciónAcadémica aa ON asig.Código = aa.CódigoAsignatura
            LEFT JOIN dbo.Docentes doc ON aa.CódigoDocente = doc.Código

            -- 4. Joins Específicos para obtener fechas de vencimiento
            LEFT JOIN Virtual.Tareas t ON r.RecursoID = t.RecursoID
            LEFT JOIN Virtual.Foros f ON r.RecursoID = f.RecursoID
            LEFT JOIN Virtual.Pruebas p ON r.RecursoID = p.RecursoID
            LEFT JOIN Virtual.Anuncios an ON r.RecursoID = an.RecursoID
            LEFT JOIN Virtual.Videoconferencias vid ON r.RecursoID = vid.RecursoID

            WHERE e.MatrículaNo = @matriculaNo
              AND r.Visible = 1
              AND r.RecursoID NOT IN (
                  SELECT RecursoID FROM Virtual.EventosOcultos WHERE MatriculaNo = @matriculaNo
              )
            ORDER BY r.FechaCreacion DESC
        `);
    return result.recordset;
};

export const ocultarEventoEstudiante = async (matriculaNo: number, recursoId: number) => {
    const pool = await poolPromise;
    // Usamos MERGE o IF NOT EXISTS para evitar error si le dan doble click
    await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .input('recursoId', sql.Int, recursoId)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM Virtual.EventosOcultos WHERE MatriculaNo = @matriculaNo AND RecursoID = @recursoId)
            BEGIN
                INSERT INTO Virtual.EventosOcultos (MatriculaNo, RecursoID)
                VALUES (@matriculaNo, @recursoId)
            END
        `);
    return { success: true };
};

export const findContextoAcademicoByDocente = async (codigoDocente: number) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('codigoDocente', sql.SmallInt, codigoDocente)
        .query(`
            SELECT TOP 1
                g.Descripción AS NombreGrado,
                c.Curso AS NombreCurso
            FROM dbo.AsignaciónAcadémica aa
            JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
            JOIN dbo.Cursos c ON asig.CódigoCurso = c.Código
            JOIN dbo.Grados g ON c.CódigoGrado = g.Código
            WHERE aa.CódigoDocente = @codigoDocente
            ORDER BY g.Código, c.Código;
        `);

    return result.recordset[0];
};

export const getVistaRecursoEstudiante = async (recursoId: number, matriculaNo: number) => {
    const pool = await poolPromise;
    const now = new Date();
    
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .input('matriculaNo', sql.Int, matriculaNo)
        .query(`
            SELECT 
                -- 1. Datos Base del Recurso
                r.RecursoID, r.Titulo, r.Contenido, r.TipoRecurso, r.UrlExterna, r.Visible,
                
                -- 2. Datos de Configuración (Tarea)
                t.FechaVencimiento,
                t.PermiteEntregasTardias,
                t.TiposArchivoPermitidos,
                t.PuntajeMaximo,

                -- ✅ 2.1. Archivo Adjunto del Docente (NUEVO)
                -- Tomamos el primero si hubiera varios (TOP 1)
                (SELECT TOP 1 ArchivoTareaID FROM Virtual.ArchivosTarea WHERE TareaID = t.TareaID) as AdjuntoID,
                (SELECT TOP 1 NombreOriginal FROM Virtual.ArchivosTarea WHERE TareaID = t.TareaID) as AdjuntoNombre,
                (SELECT TOP 1 ArchivoMimeType FROM Virtual.ArchivosTarea WHERE TareaID = t.TareaID) as AdjuntoMime,

                -- 3. Datos de Configuración (Prueba)
                p.PruebaID,
                p.FechaInicio as P_FechaInicio,
                p.FechaCierre as P_FechaCierre,
                p.NumeroIntentos as P_IntentosMax,
                p.DuracionMinutos as P_Duracion,
                p.Publicado as P_Publicado,
                p.ModoRevision, 

                -- 4. Estado del Estudiante (Tarea - Virtual.EntregasTareas)
                et.FechaEntrega,
                et.Calificacion as NotaTarea,
                et.ComentariosProfesor,
                et.ComentariosEstudiante,
                et.FechaCalificacion,
                
                -- CÁLCULO DE ESTADO DINÁMICO (Sin usar columna inexistente)
                CASE 
                    WHEN et.FechaEntrega IS NULL THEN 'Pendiente'
                    WHEN et.FechaEntrega <= t.FechaVencimiento THEN 'A tiempo'
                    ELSE 'Tardía'
                END as EstadoEntregaCalculado,

                (SELECT TOP 1 UrlArchivo FROM Virtual.ArchivosEntrega ae WHERE ae.EntregaID = et.EntregaID) as UrlArchivoEntregado,

                
                (SELECT COUNT(*) FROM Virtual.PruebasResultados rp WHERE rp.PruebaID = p.PruebaID AND rp.MatriculaNo = @matriculaNo) as IntentosUsados,
                (SELECT TOP 1 CalificacionFinal FROM Virtual.PruebasResultados rp WHERE rp.PruebaID = p.PruebaID AND rp.MatriculaNo = @matriculaNo ORDER BY FechaEntrega DESC) as P_NotaReciente,
                (SELECT TOP 1 FechaEntrega FROM Virtual.PruebasResultados rp WHERE rp.PruebaID = p.PruebaID AND rp.MatriculaNo = @matriculaNo ORDER BY FechaEntrega DESC) as P_FechaReciente

            FROM Virtual.Recursos r
            -- Joins de Configuración
            LEFT JOIN Virtual.Tareas t ON r.RecursoID = t.RecursoID
            LEFT JOIN Virtual.Pruebas p ON r.RecursoID = p.RecursoID
            
            -- Joins de Estado del Estudiante
            LEFT JOIN Virtual.EntregasTareas et ON t.TareaID = et.TareaID AND et.MatriculaNo = @matriculaNo
            
            WHERE r.RecursoID = @recursoId
        `);

    if (result.recordset.length === 0) return null;

    const row = result.recordset[0];
    const tipo = row.TipoRecurso ? row.TipoRecurso.toLowerCase() : '';

    // 1. Si no está publicado y es Prueba, el estudiante NO debe ver nada (o ver que está oculto)
    // Nota: Usualmente el endpoint de listado filtra esto, pero aquí protegemos el detalle.
    if (tipo === 'prueba' && !row.P_Publicado) {
        return { 
            id: row.RecursoID, 
            tipo: 'Bloqueado', 
            titulo: 'Recurso no disponible',
            mensaje: 'Este recurso aún no ha sido publicado por el docente.',
            contenido: '', 
            estado: { entregado: false }
        };
    }

    // 2. Lógica de Disponibilidad de Prueba
    let pruebaEstado = 'DISPONIBLE'; // Default
    let mensajeBloqueo = null;

    const intentosUsados = row.IntentosUsados || 0; 
    const notaReciente = row.P_NotaReciente;
    const fechaReciente = row.P_FechaReciente;
    
    if (tipo === 'prueba') {
        const fechaInicio = new Date(row.P_FechaInicio);
        const fechaCierre = new Date(row.P_FechaCierre);
        const intentosMax = row.P_IntentosMax;

        if (now < fechaInicio) {
            pruebaEstado = 'NO_INICIADA';
            mensajeBloqueo = `La prueba estará disponible el ${fechaInicio.toLocaleString()}.`;
        } else if (now > fechaCierre) {
            pruebaEstado = 'CERRADA';
            mensajeBloqueo = `La prueba cerró el ${fechaCierre.toLocaleString()}.`;
        } else if (intentosMax > 0 && intentosUsados >= intentosMax) {
            pruebaEstado = 'SIN_INTENTOS';
            mensajeBloqueo = `Has agotado tus ${intentosMax} intentos permitidos.`;
        }
    }

    // Mapeo DTO (Data Transfer Object) para el Frontend
    return {
        id: row.RecursoID,
        titulo: row.Titulo,
        contenido: row.Contenido,
        tipo: tipo,
        urlExterna: row.UrlExterna,
        
        // Objeto específico para Tareas
        tarea: tipo === 'tarea' ? {
            fechaVencimiento: row.FechaVencimiento,
            permiteTardias: row.PermiteEntregasTardias,
            tiposArchivo: row.TiposArchivoPermitidos,
            puntajeMaximo: row.PuntajeMaximo,
            // ✅ Mapeamos el archivo del docente
            archivoAdjunto: row.AdjuntoID ? {
                id: row.AdjuntoID,
                nombre: row.AdjuntoNombre,
                mimeType: row.AdjuntoMime
            } : null,
            estado: {
                entregado: !!row.FechaEntrega,
                fechaEntrega: row.FechaEntrega,
                calificacion: row.NotaTarea,
                comentarios: row.ComentariosProfesor,
                comentariosEstudiante: row.ComentariosEstudiante,
                fechaCalificacion: row.FechaCalificacion,
                urlArchivo: row.UrlArchivoEntregado,
                estadoEtiqueta: row.EstadoEntregaCalculado 
            }
        } : null,

        prueba: tipo === 'prueba' ? {
            pruebaId: row.PruebaID, // Necesario para iniciar
            fechaInicio: row.P_FechaInicio,
            fechaCierre: row.P_FechaCierre,
            intentosMax: row.P_IntentosMax,
            duracionMinutos: row.P_Duracion,
            modoRevision: row.ModoRevision,
            estadoAcceso: pruebaEstado, // DISPONIBLE, CERRADA, ETC.
            mensajeBloqueo: mensajeBloqueo,
            historial: {
                intentosUsados: intentosUsados || 0,
                calificacionReciente: notaReciente,
                fechaReciente: fechaReciente
            }
        } : null,

        estado: {
            entregado: false, // Genérico
        }
    };
};
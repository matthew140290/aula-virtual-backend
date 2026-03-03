// src/services/expedienteEstudiantil.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';

// ==========================================
// INTERFACES
// ==========================================

export interface BusquedaEstudiante {
    matriculaNo: number;
    nombreCompleto: string;
    documento: string;
    nombreCurso: string;
    nombreGrado: string;
    estado: string;
}

export interface InfoBasicaEstudiante {
    matriculaNo: number;
    primerNombre: string;
    segundoNombre: string;
    primerApellido: string;
    segundoApellido: string;
    documento: string;
    correo: string;
    telefono: string;
    nombreCurso: string;
    nombreGrado: string;
    estado: string;
    perfilUsuario: string;
    ultimaConexion: Date | null;
    diasSinConexion: number;
}

export interface ResumenAsignatura {
    codigoAsignatura: number;
    nombreAsignatura: string;
    totalTareas: number;
    tareasEntregadas: number;
    tareasSinEntregar: number;
    entregasTardias: number;
    promedioTareas: number | null;
    totalPruebas: number;
    pruebasRealizadas: number;
    promedioPruebas: number | null;
    totalForos: number;
    forosParticipados: number;
    promedioForos: number | null;
}

export interface EventoTimeline {
    fecha: Date | null;
    tipoEvento: string;
    accion: string;
    descripcion: string;
    asignatura: string;
}

// ==========================================
// BUSCAR ESTUDIANTES
// ==========================================

export const buscarEstudiantes = async (query: string): Promise<BusquedaEstudiante[]> => {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const pool = await poolPromise;
    const searchTerm = query.trim();
    const result = await pool.request()
        .input('search', sql.NVarChar(200), `%${searchTerm}%`)
        .query<BusquedaEstudiante>(`
            SELECT TOP 20
                e.MatrículaNo as matriculaNo,
                LTRIM(RTRIM(CONCAT(
                    ISNULL(e.PrimerNombre, ''), ' ',
                    ISNULL(e.SegundoNombre, ''), ' ',
                    ISNULL(e.PrimerApellido, ''), ' ',
                    ISNULL(e.SegundoApellido, '')
                ))) as nombreCompleto,
                ISNULL(e.NúmeroDocumento, '') as documento,
                ISNULL(cur.Curso, '') as nombreCurso,
                ISNULL(g.Descripción, '') as nombreGrado,
                ISNULL(e.Estado, '') as estado
            FROM dbo.Estudiantes e
            JOIN dbo.Cursos cur ON e.CódigoCurso = cur.Código
            JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
            WHERE ISNULL(e.Estado, '') NOT IN ('Retirado', 'Desertor')
              AND (
                  e.PrimerNombre LIKE @search
                  OR e.SegundoNombre LIKE @search
                  OR e.PrimerApellido LIKE @search
                  OR e.SegundoApellido LIKE @search
                  OR e.NúmeroDocumento LIKE @search
                  OR CONCAT(e.PrimerNombre, ' ', e.PrimerApellido) LIKE @search
                  OR CONCAT(e.PrimerNombre, ' ', e.SegundoNombre, ' ', e.PrimerApellido) LIKE @search
              )
            ORDER BY e.PrimerApellido, e.PrimerNombre;
        `);
    return result.recordset;
};

// ==========================================
// INFO BASICA + ULTIMA CONEXION
// ==========================================

export const getInfoBasica = async (matriculaNo: number): Promise<InfoBasicaEstudiante | null> => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .query<InfoBasicaEstudiante>(`
            SET DATEFORMAT mdy;

            SELECT
                e.MatrículaNo as matriculaNo,
                ISNULL(e.PrimerNombre, '') as primerNombre,
                ISNULL(e.SegundoNombre, '') as segundoNombre,
                ISNULL(e.PrimerApellido, '') as primerApellido,
                ISNULL(e.SegundoApellido, '') as segundoApellido,
                ISNULL(e.NúmeroDocumento, '') as documento,
                ISNULL(e.CorreoElectrónico, '') as correo,
                ISNULL(e.Teléfono, '') as telefono,
                ISNULL(cur.Curso, '') as nombreCurso,
                ISNULL(g.Descripción, '') as nombreGrado,
                ISNULL(e.Estado, '') as estado,
                ISNULL(u.Perfil, '') as perfilUsuario,
                sub.ultimaConexion,
                CASE
                    WHEN sub.ultimaConexion IS NULL THEN 9999
                    ELSE DATEDIFF(DAY, sub.ultimaConexion, GETDATE())
                END as diasSinConexion
            FROM dbo.Estudiantes e
            JOIN dbo.Cursos cur ON e.CódigoCurso = cur.Código
            JOIN dbo.Grados g ON cur.CódigoGrado = g.Código
            LEFT JOIN dbo.Usuarios u
                ON (e.MatrículaNo = u.Código OR e.MatrículaNo = (u.Código * -1))
                AND u.Perfil NOT IN (
                    'Docente', 'Director de grupo', 'Coordinador',
                    'Coordinador general', 'Administrador', 'Máster'
                )
            OUTER APPLY (
                SELECT MAX(TRY_CAST(r.Fecha + ' ' + r.Hora AS DATETIME)) as ultimaConexion
                FROM dbo.RegistroOperacionesUsuarios r
                WHERE r.CódigoUsuario = u.Código
                  AND r.PerfilUsuario = u.Perfil
                  AND (r.Menú = 'Login' OR r.Opción = 'Login')
            ) sub
            WHERE e.MatrículaNo = @matriculaNo;
        `);

    return result.recordset.length > 0 ? result.recordset[0] : null;
};

// ==========================================
// RESUMEN ACADEMICO POR ASIGNATURA
// ==========================================

export const getResumenAcademico = async (matriculaNo: number): Promise<ResumenAsignatura[]> => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .query<ResumenAsignatura>(`
            -- Obtener el CódigoCurso del estudiante
            DECLARE @codigoCurso SMALLINT;
            SELECT @codigoCurso = CódigoCurso FROM dbo.Estudiantes WHERE MatrículaNo = @matriculaNo;

            -- CTE: Asignaturas en las que el estudiante está inscrito
            ;WITH AsignaturasEstudiante AS (
                SELECT asig.Código as codigoAsignatura, asig.Descripción as nombreAsignatura
                FROM dbo.Asignaturas asig
                WHERE asig.CódigoCurso = @codigoCurso
                  AND (
                      ISNULL(asig.InscripciónPersonalizada, 0) = 0
                      OR EXISTS (
                          SELECT 1 FROM dbo.InscripciónEstudiantes ie
                          WHERE ie.CódigoAsignatura = asig.Código
                            AND ie.MatrículaNo = @matriculaNo
                      )
                  )
            ),

            -- CTE: Resumen de tareas por asignatura
            TareasResumen AS (
                SELECT
                    s.CodigoAsignatura,
                    COUNT(DISTINCT t.TareaID) as totalTareas,
                    COUNT(DISTINCT CASE WHEN et.EntregaID IS NOT NULL THEN t.TareaID END) as tareasEntregadas,
                    COUNT(DISTINCT CASE
                        WHEN et.EntregaID IS NULL AND t.FechaVencimiento < GETDATE()
                        THEN t.TareaID
                    END) as tareasSinEntregar,
                    COUNT(DISTINCT CASE
                        WHEN et.FechaEntrega IS NOT NULL AND et.FechaEntrega > t.FechaVencimiento
                        THEN t.TareaID
                    END) as entregasTardias,
                    AVG(et.Calificacion) as promedioTareas
                FROM Virtual.Tareas t
                JOIN Virtual.Recursos r ON t.RecursoID = r.RecursoID
                JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                LEFT JOIN Virtual.EntregasTareas et
                    ON t.TareaID = et.TareaID AND et.MatriculaNo = @matriculaNo
                WHERE s.CodigoAsignatura IN (SELECT codigoAsignatura FROM AsignaturasEstudiante)
                  AND r.Visible = 1
                  AND t.FechaPublicacion <= GETDATE()
                GROUP BY s.CodigoAsignatura
            ),

            -- CTE: Resumen de pruebas por asignatura
            PruebasResumen AS (
                SELECT
                    s.CodigoAsignatura,
                    COUNT(DISTINCT p.PruebaID) as totalPruebas,
                    COUNT(DISTINCT CASE WHEN pr.ResultadoID IS NOT NULL THEN p.PruebaID END) as pruebasRealizadas,
                    AVG(pr.CalificacionFinal) as promedioPruebas
                FROM Virtual.Pruebas p
                JOIN Virtual.Recursos r ON p.RecursoID = r.RecursoID
                JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                LEFT JOIN Virtual.PruebasResultados pr
                    ON p.PruebaID = pr.PruebaID AND pr.MatriculaNo = @matriculaNo
                WHERE s.CodigoAsignatura IN (SELECT codigoAsignatura FROM AsignaturasEstudiante)
                  AND p.Publicado = 1
                GROUP BY s.CodigoAsignatura
            ),

            -- CTE: Resumen de foros por asignatura
           ForosResumen AS (
                    SELECT
                        s.CodigoAsignatura,
                        COUNT(DISTINCT f.ForoID) as totalForos,
                        COUNT(DISTINCT CASE
                            WHEN fe.EntradaID IS NOT NULL THEN f.ForoID
                        END) as forosParticipados,
                        AVG(fc.Calificacion) as promedioForos
                    FROM Virtual.Foros f
                    JOIN Virtual.Recursos r ON f.RecursoID = r.RecursoID
                    JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                    JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                    LEFT JOIN (
                        SELECT DISTINCT RecursoID, EntradaID
                        FROM Virtual.ForoEntradas
                        WHERE UsuarioID = @matriculaNo OR UsuarioID = (@matriculaNo * -1)
                    ) fe ON f.RecursoID = fe.RecursoID
                    LEFT JOIN Virtual.ForoCalificaciones fc
                        ON f.RecursoID = fc.RecursoID AND fc.MatriculaNo = @matriculaNo
                    WHERE s.CodigoAsignatura IN (SELECT codigoAsignatura FROM AsignaturasEstudiante)
                    AND f.EsCalificable = 1
                    GROUP BY s.CodigoAsignatura
                )

            SELECT
                ae.codigoAsignatura,
                ae.nombreAsignatura,
                ISNULL(tr.totalTareas, 0) as totalTareas,
                ISNULL(tr.tareasEntregadas, 0) as tareasEntregadas,
                ISNULL(tr.tareasSinEntregar, 0) as tareasSinEntregar,
                ISNULL(tr.entregasTardias, 0) as entregasTardias,
                tr.promedioTareas,
                ISNULL(pr.totalPruebas, 0) as totalPruebas,
                ISNULL(pr.pruebasRealizadas, 0) as pruebasRealizadas,
                pr.promedioPruebas,
                ISNULL(fr.totalForos, 0) as totalForos,
                ISNULL(fr.forosParticipados, 0) as forosParticipados,
                fr.promedioForos
            FROM AsignaturasEstudiante ae
            LEFT JOIN TareasResumen tr ON ae.codigoAsignatura = tr.CodigoAsignatura
            LEFT JOIN PruebasResumen pr ON ae.codigoAsignatura = pr.CodigoAsignatura
            LEFT JOIN ForosResumen fr ON ae.codigoAsignatura = fr.CodigoAsignatura
            ORDER BY ae.nombreAsignatura;
        `);
    return result.recordset;
};

// ==========================================
// TIMELINE DE ACTIVIDAD
// ==========================================

export const getTimelineActividad = async (
    matriculaNo: number,
    limite: number = 100
): Promise<EventoTimeline[]> => {
    const pool = await poolPromise;

    // Obtener perfil del estudiante para filtrar RegistroOperacionesUsuarios
    const perfilResult = await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .query<{ Perfil: string }>(`
            SELECT TOP 1 u.Perfil
                FROM dbo.Usuarios u
                WHERE (u.Código = @matriculaNo OR u.Código = (@matriculaNo * -1))
                AND u.Perfil NOT IN (
                  'Docente', 'Director de grupo', 'Coordinador',
                  'Coordinador general', 'Administrador', 'Máster'
              )
        `);

    const perfilUsuario = perfilResult.recordset.length > 0
        ? perfilResult.recordset[0].Perfil
        : '';

    if (!perfilUsuario) {
        return [];
    }

    const result = await pool.request()
        .input('matriculaNo', sql.Int, matriculaNo)
        .input('perfilUsuario', sql.NVarChar(96), perfilUsuario)
        .input('limite', sql.Int, limite)
        .query<EventoTimeline>(`
            SET DATEFORMAT mdy;

            SELECT TOP (@limite) *
            FROM (
                -- 1. Vistas de recursos (Descargó/Visualizó contenido)
                SELECT
                    vr.FechaVista as fecha,
                    'vista' as tipoEvento,
                    'Visualizó recurso' as accion,
                    ISNULL(r.TipoRecurso, '') + ': ' + ISNULL(r.Titulo, '') as descripcion,
                    ISNULL(asig.Descripción, '') as asignatura
                FROM Virtual.VistasRecursos vr
                JOIN Virtual.Recursos r ON vr.RecursoID = r.RecursoID
                JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
                WHERE vr.MatriculaNo = @matriculaNo

                UNION ALL

                -- 2. Entregas de tareas
                SELECT
                    et.FechaEntrega as fecha,
                    'entrega' as tipoEvento,
                    CASE
                        WHEN et.FechaEntrega > t.FechaVencimiento THEN 'Entregó tarea (tarde)'
                        ELSE 'Entregó tarea'
                    END as accion,
                    'Tarea: ' + ISNULL(r.Titulo, '') as descripcion,
                    ISNULL(asig.Descripción, '') as asignatura
                FROM Virtual.EntregasTareas et
                JOIN Virtual.Tareas t ON et.TareaID = t.TareaID
                JOIN Virtual.Recursos r ON t.RecursoID = r.RecursoID
                JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
                WHERE et.MatriculaNo = @matriculaNo
                  AND et.FechaEntrega IS NOT NULL

                UNION ALL

                -- 3. Pruebas realizadas
                SELECT
                    CAST(pr.FechaEntrega AS DATETIME) as fecha,
                    'prueba' as tipoEvento,
                    'Realizó prueba' as accion,
                    'Prueba: ' + ISNULL(r.Titulo, '')
                        + CASE
                            WHEN pr.CalificacionFinal IS NOT NULL
                            THEN ' (Nota: ' + CAST(pr.CalificacionFinal AS VARCHAR(10)) + ')'
                            ELSE ''
                          END as descripcion,
                    ISNULL(asig.Descripción, '') as asignatura
                FROM Virtual.PruebasResultados pr
                JOIN Virtual.Pruebas p ON pr.PruebaID = p.PruebaID
                JOIN Virtual.Recursos r ON p.RecursoID = r.RecursoID
                JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
                WHERE pr.MatriculaNo = @matriculaNo
                  AND pr.FechaEntrega IS NOT NULL

                UNION ALL

                -- 4. Publicaciones en foros
                SELECT
                    DATEADD(HOUR, -5, fe.FechaCreacion) as fecha,
                    'foro' as tipoEvento,
                    CASE
                        WHEN fe.EntradaPadreID IS NULL THEN 'Publicó en foro'
                        ELSE 'Respondió en foro'
                    END as accion,
                    'Foro: ' + ISNULL(r.Titulo, '') as descripcion,
                    ISNULL(asig.Descripción, '') as asignatura
                FROM Virtual.ForoEntradas fe
                JOIN Virtual.Recursos r ON fe.RecursoID = r.RecursoID
                JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
                JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
                JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
                WHERE (fe.UsuarioID = @matriculaNo OR fe.UsuarioID = (@matriculaNo * -1))
                AND fe.PerfilUsuario = @perfilUsuario

                UNION ALL

                -- 5. Login / Sesiones (solo eventos de acceso)
                SELECT
                    TRY_CAST(ro.Fecha + ' ' + ro.Hora AS DATETIME) as fecha,
                    'login' as tipoEvento,
                    'Ingresó al sistema' as accion,
                    '' as descripcion,
                    '' as asignatura
                FROM dbo.RegistroOperacionesUsuarios ro
                WHERE (ro.CódigoUsuario = @matriculaNo OR ro.CódigoUsuario = (@matriculaNo * -1))
                AND ro.PerfilUsuario = @perfilUsuario
                AND (ro.Menú = 'Login' OR ro.Opción = 'Login')
            ) AS timeline
            WHERE fecha IS NOT NULL
            ORDER BY fecha DESC;
        `);
    return result.recordset;
};
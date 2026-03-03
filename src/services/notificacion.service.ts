// src/services/notificacion.service.ts
import sql from 'mssql';
import { dbConfig } from '../config/database';
import { sendWhatsAppMessage } from './whatsapp.service';
import { buildResourceNotificationVariables } from './whatsapp-templates.service';

// --- Interfaces para el manejo de datos ---
interface UserIdentity {
    codigo: number;
    perfil: string;
}

interface NotificationParams {
    destinatario: UserIdentity;
    tipo: string;
    mensaje: string;
    recursoId?: number;
    actor?: UserIdentity;
}

export type WhatsAppTarget = 'NONE' | 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';

// --- Funciones del Servicio ---


export const getNotificaciones = async (userIdentity: UserIdentity, page: number, limit: number) => {
    const pool = await sql.connect(dbConfig);
    const offset = (page - 1) * limit;

    const idPositivo = Math.abs(userIdentity.codigo);

    const query = `
        SELECT 
            n.NotificacionID, n.Tipo, n.Mensaje, n.RecursoID, 
            n.FechaCreacion, n.Leido,
            actor.NombreCompleto as ActorNombre,
            asig.Descripción as NombreAsignatura,
            CASE 
                WHEN r.Visible = 0 THEN 1

                WHEN n.RecursoID IS NOT NULL AND r.RecursoID IS NULL THEN 1

                WHEN n.RecursoID IS NULL 
                     AND (
                        n.Mensaje LIKE 'Nuevo%publicado:%' OR 
                        n.Mensaje LIKE 'Nuevo recurso publicado:%'
                     )
                THEN 1

                ELSE 0 
            END AS RecursoEliminado,
            COALESCE(
                t.FechaVencimiento, 
                f.FechaCierre, 
                p.FechaCierre, 
                an.FechaCierre,
                vid.FechaCierre
            ) AS FechaCierreRecurso
        FROM Virtual.Notificaciones as n
        LEFT JOIN dbo.Usuarios as actor ON n.ActorID = actor.Código AND n.ActorPerfil = actor.Perfil
        LEFT JOIN Virtual.Recursos r ON n.RecursoID = r.RecursoID
        LEFT JOIN Virtual.Apartados apt ON r.ApartadoID = apt.ApartadoID
        LEFT JOIN Virtual.Semanas s ON apt.SemanaID = s.SemanaID
        LEFT JOIN dbo.Asignaturas asig ON s.CodigoAsignatura = asig.Código
        LEFT JOIN Virtual.Tareas t ON r.RecursoID = t.RecursoID
        LEFT JOIN Virtual.Foros f ON r.RecursoID = f.RecursoID
        LEFT JOIN Virtual.Pruebas p ON r.RecursoID = p.RecursoID
        LEFT JOIN Virtual.Anuncios an ON r.RecursoID = an.RecursoID
        LEFT JOIN Virtual.Videoconferencias vid ON r.RecursoID = vid.RecursoID
        WHERE (n.UsuarioID = @idPositivo OR n.UsuarioID = (@idPositivo * -1))
          AND n.PerfilUsuario = @perfilUsuario

        ORDER BY n.FechaCreacion DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) as total FROM Virtual.Notificaciones
        WHERE (UsuarioID = @idPositivo OR UsuarioID = (@idPositivo * -1)) 
          AND PerfilUsuario = @perfilUsuario;
    `;

    const result = await pool.request()
        .input('idPositivo', sql.Int, idPositivo)
        .input('perfilUsuario', sql.NVarChar(96), userIdentity.perfil)
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limit)
        .query(query);

        const recordsets = result.recordsets as sql.IRecordSet<any>[];

    
    return {
        notificaciones: recordsets[0],
        total: recordsets[1][0].total,
    };
};


export const marcarComoLeidas = async (userIdentity: UserIdentity, ids?: number[]) => {
    const pool = await sql.connect(dbConfig);
    const idPositivo = Math.abs(userIdentity.codigo);
    let query = `
        UPDATE Virtual.Notificaciones 
        SET Leido = 1 
        WHERE (UsuarioID = @idPositivo OR UsuarioID = (@idPositivo * -1))
          AND PerfilUsuario = @perfilUsuario 
          AND Leido = 0
    `;
    
    const request = pool.request()
        .input('idPositivo', sql.Int, idPositivo)
        .input('perfilUsuario', sql.NVarChar(96), userIdentity.perfil);

    if (ids && ids.length > 0) {
        // Para evitar inyección SQL, creamos un parámetro por cada ID
        const idParams = ids.map((_, i) => `@id${i}`).join(',');
        query += ` AND NotificacionID IN (${idParams})`;
        ids.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
    }
    
    await request.query(query);
};


export const createNotificacion = async (params: NotificationParams) => {
    const pool = await sql.connect(dbConfig);

    // Resolver Código real del destinatario
    const destPositivo = Math.abs(params.destinatario.codigo);
    const destLookup = await pool.request()
        .input('idPos', sql.Int, destPositivo)
        .input('perfil', sql.NVarChar(96), params.destinatario.perfil)
        .query<{ Código: number }>(`
            SELECT TOP 1 Código FROM dbo.Usuarios 
            WHERE (Código = @idPos OR Código = (@idPos * -1)) AND Perfil = @perfil
        `);
    const destReal = destLookup.recordset.length > 0 ? destLookup.recordset[0].Código : params.destinatario.codigo;

    // Resolver Código real del actor (si existe)
    let actorReal = params.actor?.codigo;
    if (params.actor) {
        const actorPositivo = Math.abs(params.actor.codigo);
        const actorLookup = await pool.request()
            .input('idPos', sql.Int, actorPositivo)
            .input('perfil', sql.NVarChar(96), params.actor.perfil)
            .query<{ Código: number }>(`
                SELECT TOP 1 Código FROM dbo.Usuarios 
                WHERE (Código = @idPos OR Código = (@idPos * -1)) AND Perfil = @perfil
            `);
        actorReal = actorLookup.recordset.length > 0 ? actorLookup.recordset[0].Código : params.actor.codigo;
    }

    const request = pool.request()
        .input('usuarioId', sql.SmallInt, destReal)
        .input('perfilUsuario', sql.NVarChar(96), params.destinatario.perfil)
        .input('tipo', sql.VarChar(50), params.tipo)
        .input('mensaje', sql.NVarChar(512), params.mensaje);

    if (params.recursoId) request.input('recursoId', sql.Int, params.recursoId);
    if (params.actor) {
        request.input('actorId', sql.SmallInt, actorReal!);
        request.input('actorPerfil', sql.NVarChar(96), params.actor.perfil);
    }

    const query = `
        INSERT INTO Virtual.Notificaciones
            (UsuarioID, PerfilUsuario, Tipo, Mensaje, RecursoID, ActorID, ActorPerfil)
        VALUES
            (@usuarioId, @perfilUsuario, @tipo, @mensaje, ${params.recursoId ? '@recursoId' : 'NULL'}, ${params.actor ? '@actorId' : 'NULL'}, ${params.actor ? '@actorPerfil' : 'NULL'});
    `;
    
    await request.query(query);
};

export const notificarDocentePorInteraccion = async (
    recursoId: number,
    estudiante: { codigo: number, nombreCompleto: string },
    tipoAccion: 'TAREA_ENTREGADA' | 'FORO_PARTICIPACION' | 'ANUNCIO_RESPUESTA' | 'PRUEBA_FINALIZADA'
) => {
    const pool = await sql.connect(dbConfig);

    // 1. Buscar al Docente asociado a la asignatura de este recurso
    // La ruta es: Recurso -> Apartado -> Semana -> Asignatura -> AsignaciónAcadémica -> Docente
    const queryDocente = `
        SELECT TOP 1 
            aa.CódigoDocente as Codigo,
            u.Perfil
        FROM Virtual.Recursos r
        JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
        JOIN Virtual.Semanas s ON ap.SemanaID = s.SemanaID
        JOIN dbo.AsignaciónAcadémica aa ON s.CodigoAsignatura = aa.CódigoAsignatura
        JOIN dbo.Usuarios u ON aa.CódigoDocente = u.Código 
        WHERE r.RecursoID = @recursoId
        AND (u.Perfil LIKE 'Docente%' OR u.Perfil = 'Director de grupo') -- Asegurar que es perfil docente
    `;

    const resultDocente = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(queryDocente);

    const docente = resultDocente.recordset[0];

    if (!docente) {
        console.warn(`[Notificacion] No se encontró docente para el recurso ${recursoId}`);
        return;
    }

    // 2. Construir el mensaje según el tipo de acción
    let mensaje = '';
    let tipoNotificacion = '';

    switch (tipoAccion) {
        case 'TAREA_ENTREGADA':
            mensaje = `${estudiante.nombreCompleto} ha entregado una tarea.`;
            tipoNotificacion = 'TAREA';
            break;
        case 'FORO_PARTICIPACION':
            mensaje = `${estudiante.nombreCompleto} participó en un foro.`;
            tipoNotificacion = 'FORO';
            break;
        case 'ANUNCIO_RESPUESTA':
            mensaje = `${estudiante.nombreCompleto} respondió a un anuncio.`;
            tipoNotificacion = 'ANUNCIO';
            break;
        case 'PRUEBA_FINALIZADA':
            mensaje = `${estudiante.nombreCompleto} finalizó una prueba en línea.`;
            tipoNotificacion = 'PRUEBA';
            break;
    }

    await createNotificacion({
        destinatario: { codigo: docente.Codigo, perfil: docente.Perfil },
        tipo: tipoNotificacion,
        mensaje: mensaje,
        recursoId: recursoId,
        actor: { codigo: estudiante.codigo, perfil: 'Estudiante' } // Para que salga "Juan Perez ha..."
    });
    
    console.log(`[Notificacion] Docente ${docente.Codigo} notificado de acción ${tipoAccion} por estudiante ${estudiante.codigo}`);
};

export const notificarEstudiantesDeCurso = async (
    apartadoId: number, 
    recursoId: number, 
    tipo: string, 
    tituloRecurso: string, 
    actor: { codigo: number, perfil: string }, // El docente
    target: WhatsAppTarget
) => {
    const pool = await sql.connect(dbConfig);
    console.log(`[WhatsApp] Iniciando proceso para recurso "${tituloRecurso}". Target recibido: "${target}"`);
    
    const queryActor = `
        SELECT NombreCompleto 
        FROM dbo.Usuarios 
        WHERE Código = @codigo AND Perfil = @perfil
    `;
    
    const resultActor = await pool.request()
        .input('codigo', sql.SmallInt, actor.codigo)
        .input('perfil', sql.NVarChar(96), actor.perfil)
        .query(queryActor);

    const nombreDocente = resultActor.recordset[0]?.NombreCompleto || 'Docente';

    const querySelect = `
        SELECT 
            e.MatrículaNo, 
            e.PrimerNombre, 
            e.PrimerApellido,
            e.Teléfono as TelefonoEstudiante,
            e.TeléfonoAcudiente,
            e.TeléfonoMadre,
            e.TeléfonoPadre,
            e.NombreCompletoAcudiente,
            asig.Descripción as NombreAsignatura,
            MIN(u.Código) AS ID_Usuario_Real
        FROM Virtual.Apartados ap
        JOIN Virtual.Semanas sem ON ap.SemanaID = sem.SemanaID
        JOIN dbo.Asignaturas asig ON sem.CodigoAsignatura = asig.Código
        JOIN dbo.Estudiantes e ON asig.CódigoCurso = e.CódigoCurso
        LEFT JOIN dbo.Usuarios u ON (e.MatrículaNo = u.Código OR e.MatrículaNo = (u.Código * -1))
        WHERE ap.ApartadoID = @apartadoId
          AND (e.Estado IS NULL OR e.Estado != 'Retirado')
          GROUP BY 
            e.MatrículaNo, 
            e.PrimerNombre, 
            e.PrimerApellido,
            e.Teléfono,
            e.TeléfonoAcudiente,
            e.TeléfonoMadre,
            e.TeléfonoPadre,
            e.NombreCompletoAcudiente,
            asig.Descripción
    `;

    const result = await pool.request()
        .input('apartadoId', sql.Int, apartadoId)
        .query(querySelect);

    const estudiantes = result.recordset;

    if (estudiantes.length === 0) {
        console.log('[WhatsApp] No se encontraron estudiantes en este curso.');
        return;
    }

    // 2. Insertar notificaciones masivas (Bulk Insert)
    const table = new sql.Table('Virtual.Notificaciones');
    table.create = false; // La tabla ya existe
    
    // Configura columnas EXACTAMENTE como en tu BD
    table.columns.add('UsuarioID', sql.SmallInt, { nullable: false });
    table.columns.add('PerfilUsuario', sql.NVarChar(96), { nullable: false });
    table.columns.add('Tipo', sql.VarChar(50), { nullable: false });
    table.columns.add('Mensaje', sql.NVarChar(1024), { nullable: false });
    table.columns.add('RecursoID', sql.Int, { nullable: true });
    table.columns.add('FechaCreacion', sql.DateTime, { nullable: false });
    table.columns.add('Leido', sql.Bit, { nullable: false });
    table.columns.add('ActorID', sql.SmallInt, { nullable: true });
    table.columns.add('ActorPerfil', sql.NVarChar(96), { nullable: true });

    const mensaje = `Nuevo(a) ${tipo.toLowerCase()} publicado: "${tituloRecurso}"`;
    const now = new Date();
    let insertCount = 0;

    estudiantes.forEach((est: any) => {
        // 🔥 VALIDACIÓN: Solo insertamos si el estudiante tiene un Usuario asociado
        // De lo contrario, la FK fallaría y rompería todo el proceso.
        if (est.ID_Usuario_Real) {
            table.rows.add(
                est.ID_Usuario_Real, // Usamos el ID negativo (-244)
                'Estudiante', 
                tipo, 
                mensaje, 
                recursoId, 
                now, 
                0, 
                actor.codigo, 
                actor.perfil
            );
            insertCount++;
        }
    });

    if (insertCount > 0) {
        const req = new sql.Request(pool);
        try {
            await req.bulk(table);
            console.log(`✅ [Notificación] Insertadas ${insertCount} notificaciones en BD.`);
        } catch (err) {
            console.error("❌ [Notificación] Error fatal en Bulk Insert:", err);
        }
    } else {
        console.warn("⚠️ [Notificación] Se encontraron estudiantes pero ninguno tiene Usuario asociado en BD. No se enviaron notificaciones internas.");
    }

    if (target === 'NONE') {
        console.log('[WhatsApp] Target es NONE. Omitiendo envío de mensajes.');
        return; 
    }

    const whatsappPromises: Promise<any>[] = [];

    // Recorremos cada estudiante para ver a quién enviamos
    estudiantes.forEach((est: any) => {
        const nombreEst = `${est.PrimerNombre} ${est.PrimerApellido}`;
        const tipoLegible = tipo.toLowerCase();
        const telefonoEstudianteRaw = est.TelefonoEstudiante;
        const NombreAsignatura = est.NombreAsignatura;
        

        const fechaPub = now.toLocaleDateString('es-CO')
        
        // --- FUNCIÓN HELPER INTERNA PARA ENVIAR ---
        const enviar = (telefono: string, nombreDestino: string) => {
            const variablesJSON = buildResourceNotificationVariables({
                nombreDestino: nombreDestino,
                tipoRecurso: tipoLegible,
                nombreAsignatura: NombreAsignatura,
                nombreDocente: nombreDocente,
                tituloRecurso: tituloRecurso,
                nombreEstudiante: nombreEst,
                fecha: fechaPub
            })
            whatsappPromises.push(sendWhatsAppMessage(telefono, variablesJSON));
        };

        // --- CASO 1: ENVIAR AL ESTUDIANTE ---
        if (target === 'STUDENT_ONLY' || target === 'BOTH') {
            if (telefonoEstudianteRaw) {
                enviar(telefonoEstudianteRaw, est.PrimerNombre); 
            } else {
                // <--- AQUÍ VA EL PRIMER CONSOLE.WARN
                console.warn(`[WhatsApp Skip] Estudiante ${est.MatrículaNo} (${est.PrimerNombre}) no tiene número registrado.`);
            }
        }

        // --- CASO 2: ENVIAR AL ACUDIENTE (Cascada) ---
        if (target === 'GUARDIAN_ONLY' || target === 'BOTH') {
            let telefonoPadre = '';
            let nombrePadre = 'Acudiente';

            // Lógica de prioridad: Acudiente -> Madre -> Padre
            if (est.TeléfonoAcudiente) {
                telefonoPadre = est.TeléfonoAcudiente;
                nombrePadre = est.NombreCompletoAcudiente || 'Acudiente';
            } else if (est.TeléfonoMadre) {
                telefonoPadre = est.TeléfonoMadre;
                nombrePadre = 'Madre de familia';
            } else if (est.TeléfonoPadre) {
                telefonoPadre = est.TeléfonoPadre;
                nombrePadre = 'Padre de familia';
            }

            if (telefonoPadre) {
                enviar(telefonoPadre, nombrePadre);
            } else {
                // <--- AQUÍ VA EL SEGUNDO CONSOLE.WARN
                console.warn(`[WhatsApp Skip] Estudiante ${est.MatrículaNo} (${est.PrimerNombre}) no tiene Acudiente/Padres con número.`);
            }
        }
    });

    // Ejecutar envíos en segundo plano
    Promise.allSettled(whatsappPromises).then((results) => {
        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[WhatsApp Resumen] Modo: ${target}. Enviados: ${sent}. Fallidos: ${failed}. Total procesados: ${results.length}`);
    });
};

export const deleteNotificaciones = async (userIdentity: UserIdentity, ids?: number[]) => {
    const pool = await sql.connect(dbConfig);
    const idPositivo = Math.abs(userIdentity.codigo);

    const request = pool.request()
        .input('idPositivo', sql.SmallInt, idPositivo)
        .input('perfilUsuario', sql.NVarChar(96), userIdentity.perfil);

    let query = `
        DELETE FROM Virtual.Notificaciones 
        WHERE (UsuarioID = @idPositivo OR UsuarioID = (@idPositivo * -1))
          AND PerfilUsuario = @perfilUsuario
    `;

    if (ids && ids.length > 0) {
        const idParams = ids.map((_, i) => `@idDelete${i}`).join(',');
        query += ` AND NotificacionID IN (${idParams})`;
        ids.forEach((id, i) => request.input(`idDelete${i}`, sql.Int, id));
    }

    await request.query(query);
};

export const notificarEstudiantesEspecificos = async (
    estudiantesIds: number[],
    recursoId: number, 
    tipo: string, 
    tituloRecurso: string, 
    actor: { codigo: number, perfil: string },
    target: WhatsAppTarget
) => {
    if (!estudiantesIds || estudiantesIds.length === 0) return;

    const pool = await sql.connect(dbConfig);
    console.log(`[WhatsApp] Iniciando proceso PERSONALIZADO para recurso "${tituloRecurso}". Target: "${target}". Estudiantes VIP: ${estudiantesIds.length}`);
    
    const queryActor = `SELECT NombreCompleto FROM dbo.Usuarios WHERE Código = @codigo AND Perfil = @perfil`;
    const resultActor = await pool.request()
        .input('codigo', sql.SmallInt, actor.codigo)
        .input('perfil', sql.NVarChar(96), actor.perfil)
        .query(queryActor);
    const nombreDocente = resultActor.recordset[0]?.NombreCompleto || 'Docente';

    const idsList = estudiantesIds.join(',');

    // Solo buscamos a los estudiantes seleccionados cruzando con su asignatura
    const querySelect = `
        SELECT 
            e.MatrículaNo, e.PrimerNombre, e.PrimerApellido,
            e.Teléfono as TelefonoEstudiante, e.TeléfonoAcudiente, e.TeléfonoMadre, e.TeléfonoPadre, e.NombreCompletoAcudiente,
            asig.Descripción as NombreAsignatura,
            MIN(u.Código) AS ID_Usuario_Real
        FROM dbo.Estudiantes e
        LEFT JOIN dbo.Usuarios u ON (e.MatrículaNo = u.Código OR e.MatrículaNo = (u.Código * -1))
        CROSS JOIN (
            SELECT TOP 1 asig2.Descripción
            FROM Virtual.Recursos r
            JOIN Virtual.Apartados ap ON r.ApartadoID = ap.ApartadoID
            JOIN Virtual.Semanas sem ON ap.SemanaID = sem.SemanaID
            JOIN dbo.Asignaturas asig2 ON sem.CodigoAsignatura = asig2.Código
            WHERE r.RecursoID = @recursoId
        ) as asig
        WHERE e.MatrículaNo IN (${idsList})
          AND (e.Estado IS NULL OR e.Estado != 'Retirado')
        GROUP BY 
            e.MatrículaNo, e.PrimerNombre, e.PrimerApellido, e.Teléfono, e.TeléfonoAcudiente, e.TeléfonoMadre, e.TeléfonoPadre, e.NombreCompletoAcudiente, asig.Descripción
    `;

    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query(querySelect);

    const estudiantes = result.recordset;

    if (estudiantes.length === 0) {
        console.warn('[WhatsApp] Estudiantes específicos no encontrados o inactivos.');
        return;
    }

    // Insertar notificaciones en BD (Campanita del Dashboard)
    const table = new sql.Table('Virtual.Notificaciones');
    table.create = false; 
    table.columns.add('UsuarioID', sql.SmallInt, { nullable: false });
    table.columns.add('PerfilUsuario', sql.NVarChar(96), { nullable: false });
    table.columns.add('Tipo', sql.VarChar(50), { nullable: false });
    table.columns.add('Mensaje', sql.NVarChar(1024), { nullable: false });
    table.columns.add('RecursoID', sql.Int, { nullable: true });
    table.columns.add('FechaCreacion', sql.DateTime, { nullable: false });
    table.columns.add('Leido', sql.Bit, { nullable: false });
    table.columns.add('ActorID', sql.SmallInt, { nullable: true });
    table.columns.add('ActorPerfil', sql.NVarChar(96), { nullable: true });

    const mensaje = `Nuevo(a) ${tipo.toLowerCase()} exclusivo publicado: "${tituloRecurso}"`;
    const now = new Date();
    let insertCount = 0;

    estudiantes.forEach((est: any) => {
        if (est.ID_Usuario_Real) {
            table.rows.add(est.ID_Usuario_Real, 'Estudiante', tipo, mensaje, recursoId, now, 0, actor.codigo, actor.perfil);
            insertCount++;
        }
    });

    if (insertCount > 0) {
        await new sql.Request(pool).bulk(table);
        console.log(`✅ [Notificación] ${insertCount} notificaciones personalizadas insertadas en BD.`);
    }

    // Disparo a WhatsApp
    if (target === 'NONE') return; 

    const whatsappPromises: Promise<any>[] = [];
    const fechaPub = now.toLocaleDateString('es-CO');

    estudiantes.forEach((est: any) => {
        const nombreEst = `${est.PrimerNombre} ${est.PrimerApellido}`;
        
        const enviar = (telefono: string, nombreDestino: string) => {
            const variablesJSON = buildResourceNotificationVariables({
                nombreDestino: nombreDestino,
                tipoRecurso: tipo.toLowerCase(),
                nombreAsignatura: est.NombreAsignatura,
                nombreDocente: nombreDocente,
                tituloRecurso: tituloRecurso,
                nombreEstudiante: nombreEst,
                fecha: fechaPub
            });
            whatsappPromises.push(sendWhatsAppMessage(telefono, variablesJSON));
        };

        if (target === 'STUDENT_ONLY' || target === 'BOTH') {
            if (est.TelefonoEstudiante) enviar(est.TelefonoEstudiante, est.PrimerNombre);
        }

        if (target === 'GUARDIAN_ONLY' || target === 'BOTH') {
            const telefonoPadre = est.TeléfonoAcudiente || est.TeléfonoMadre || est.TeléfonoPadre;
            const nombrePadre = est.TeléfonoAcudiente ? (est.NombreCompletoAcudiente || 'Acudiente') : (est.TeléfonoMadre ? 'Madre de familia' : 'Padre de familia');
            
            if (telefonoPadre) enviar(telefonoPadre, nombrePadre);
        }
    });

    Promise.allSettled(whatsappPromises).then((results) => {
        const sent = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[WhatsApp VIP] Enviados: ${sent}/${results.length}`);
    });
};
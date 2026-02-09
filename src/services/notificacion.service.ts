// src/services/notificacion.service.ts
import sql from 'mssql';
import { dbConfig } from '../config/database';
import { sendWhatsAppMessage } from './whatsapp.service';
import { buildResourceNotificationBody } from './whatsapp-templates.service';

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
        WHERE n.UsuarioID = @codigoUsuario AND n.PerfilUsuario = @perfilUsuario
        ORDER BY n.FechaCreacion DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

        SELECT COUNT(*) as total FROM Virtual.Notificaciones
        WHERE UsuarioID = @codigoUsuario AND PerfilUsuario = @perfilUsuario;
    `;

    const result = await pool.request()
        .input('codigoUsuario', sql.SmallInt, userIdentity.codigo)
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
    let query = `
        UPDATE Virtual.Notificaciones 
        SET Leido = 1 
        WHERE UsuarioID = @codigoUsuario AND PerfilUsuario = @perfilUsuario AND Leido = 0
    `;
    
    const request = pool.request()
        .input('codigoUsuario', sql.SmallInt, userIdentity.codigo)
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
    const request = pool.request()
        .input('usuarioId', sql.SmallInt, params.destinatario.codigo)
        .input('perfilUsuario', sql.NVarChar(96), params.destinatario.perfil)
        .input('tipo', sql.VarChar(50), params.tipo)
        .input('mensaje', sql.NVarChar(512), params.mensaje);

    // Añade los parámetros opcionales solo si existen
    if (params.recursoId) request.input('recursoId', sql.Int, params.recursoId);
    if (params.actor) {
        request.input('actorId', sql.SmallInt, params.actor.codigo);
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
            asig.Descripción as NombreAsignatura
        FROM Virtual.Apartados ap
        JOIN Virtual.Semanas sem ON ap.SemanaID = sem.SemanaID
        JOIN dbo.Asignaturas asig ON sem.CodigoAsignatura = asig.Código
        JOIN dbo.Estudiantes e ON asig.CódigoCurso = e.CódigoCurso
        WHERE ap.ApartadoID = @apartadoId
          AND (e.Estado IS NULL OR e.Estado != 'Retirado')
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

    estudiantes.forEach((est: any) => {
        table.rows.add(
            est.MatrículaNo, 
            'Estudiante', 
            tipo, // Ej: 'NUEVA_TAREA'
            mensaje, 
            recursoId, 
            now, 
            0, // No leido
            actor.codigo, 
            actor.perfil
        );
    });

    const req = new sql.Request(pool);
    try {
        await req.bulk(table);
        console.log(`Notificaciones enviadas a ${estudiantes.length} estudiantes.`);
    } catch (err) {
        console.error("Error enviando notificaciones masivas:", err);
        // No lanzamos error para no revertir la creación del recurso, es un proceso secundario
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
            const body = buildResourceNotificationBody({
                nombreDestino: nombreDestino,
                tipoRecurso: tipoLegible,
                nombreAsignatura: NombreAsignatura,
                nombreDocente: nombreDocente,
                tituloRecurso: tituloRecurso,
                nombreEstudiante: nombreEst,
                fecha: fechaPub
            })
            whatsappPromises.push(sendWhatsAppMessage(telefono, body));
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
    const request = pool.request()
        .input('codigoUsuario', sql.SmallInt, userIdentity.codigo)
        .input('perfilUsuario', sql.NVarChar(96), userIdentity.perfil);

    let query = `
        DELETE FROM Virtual.Notificaciones 
        WHERE UsuarioID = @codigoUsuario AND PerfilUsuario = @perfilUsuario
    `;

    // Si vienen IDs, borramos solo esos. Si no vienen, borramos TODO (Vaciar bandeja).
    if (ids && ids.length > 0) {
        // Parametrización dinámica para evitar SQL Injection en Arrays
        const idParams = ids.map((_, i) => `@idDelete${i}`).join(',');
        query += ` AND NotificacionID IN (${idParams})`;
        ids.forEach((id, i) => request.input(`idDelete${i}`, sql.Int, id));
    }

    await request.query(query);
};
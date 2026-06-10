"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buscarUsuarios = exports.getCargaDocente = exports.getEstudiantes = exports.getDocentes = exports.getAudienciaData = exports.getHierarchyData = exports.deleteAnuncioInstitucional = exports.updateAnuncioInstitucional = exports.createAnuncioInstitucional = exports.getAnunciosInstitucionales = exports.buildAnunciosInstitucionalesQuery = exports.normalizeDestinatarios = exports.hasAnuncioDestinatariosTable = void 0;
// src/services/anuncioInstitucional.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const log_service_1 = require("./log.service");
const ADMIN_PROFILES = new Set(['administrador', 'coordinador', 'coordinador general', 'master']);
const DESTINATARIOS_TABLE_CACHE_TTL_MS = 5 * 60 * 1000;
const destinatariosTableCache = new WeakMap();
const ANUNCIOS_BASE_SELECT = `
    SELECT
        a.AnuncioID as anuncioId,
        a.Titulo as titulo,
        a.ContenidoHTML as contenidoHTML,
        a.FechaPublicacion as fechaPublicacion,
        a.CodigoUsuario as codigoUsuario,
        a.PerfilUsuario as perfilUsuario,
        a.Activo as activo,
        u.NombreCompleto AS nombreUsuario
    FROM Virtual.AnunciosInstitucionales a
    LEFT JOIN dbo.Usuarios u ON a.CodigoUsuario = u.Código
`;
const ANUNCIOS_FILTRO_AUDIENCIA = `
    WHERE a.Activo = 1
      AND (
        NOT EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d0
          WHERE d0.AnuncioID = a.AnuncioID
        )
        OR EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d1
          WHERE d1.AnuncioID = a.AnuncioID
            AND d1.Tipo = 'Rol'
            AND d1.Valor = @perfilUsuario
        )
        OR EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d2
          WHERE d2.AnuncioID = a.AnuncioID
            AND d2.Tipo = 'Usuario'
            AND d2.Valor = CAST(@codigoUsuario AS NVARCHAR(100))
        )
        OR EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d3
          WHERE d3.AnuncioID = a.AnuncioID
            AND d3.Tipo = 'Grado'
            AND d3.Valor IN (
              SELECT CAST(c.CódigoGrado AS NVARCHAR(100))
              FROM dbo.Estudiantes e
              JOIN dbo.Cursos c ON e.CódigoCurso = c.Código
              WHERE e.MatrículaNo = @codigoUsuario
              UNION
              SELECT CAST(c.CódigoGrado AS NVARCHAR(100))
              FROM dbo.AsignaciónAcadémica aa
              JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
              JOIN dbo.Cursos c ON asig.CódigoCurso = c.Código
              WHERE aa.CódigoDocente = @codigoUsuario
            )
        )
        OR EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d4
          WHERE d4.AnuncioID = a.AnuncioID
            AND d4.Tipo = 'Asignatura'
            AND d4.Valor IN (
              SELECT CAST(asig.Código AS NVARCHAR(100))
              FROM dbo.Estudiantes e
              JOIN dbo.Asignaturas asig ON e.CódigoCurso = asig.CódigoCurso
              WHERE e.MatrículaNo = @codigoUsuario
              UNION
              SELECT CAST(aa.CódigoAsignatura AS NVARCHAR(100))
              FROM dbo.AsignaciónAcadémica aa
              WHERE aa.CódigoDocente = @codigoUsuario
            )
        )
        OR EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d5
          WHERE d5.AnuncioID = a.AnuncioID
            AND d5.Tipo = 'Curso'
            AND d5.Valor IN (
              SELECT CAST(e.CódigoCurso AS NVARCHAR(100))
              FROM dbo.Estudiantes e
              WHERE e.MatrículaNo = @codigoUsuario
              UNION
              SELECT CAST(asig.CódigoCurso AS NVARCHAR(100))
              FROM dbo.AsignaciónAcadémica aa
              JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
              WHERE aa.CódigoDocente = @codigoUsuario
            )
        )
        OR EXISTS (
          SELECT 1
          FROM Virtual.AnuncioDestinatarios d6
          WHERE d6.AnuncioID = a.AnuncioID
            AND d6.Tipo = 'Nivel'
            AND d6.Valor IN (
              SELECT COALESCE(g.NivelAprendizaje, 'Sin Nivel')
              FROM dbo.Estudiantes e
              JOIN dbo.Cursos c ON e.CódigoCurso = c.Código
              JOIN dbo.Grados g ON c.CódigoGrado = g.Código
              WHERE e.MatrículaNo = @codigoUsuario
              UNION
              SELECT COALESCE(g.NivelAprendizaje, 'Sin Nivel')
              FROM dbo.AsignaciónAcadémica aa
              JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
              JOIN dbo.Cursos c ON asig.CódigoCurso = c.Código
              JOIN dbo.Grados g ON c.CódigoGrado = g.Código
              WHERE aa.CódigoDocente = @codigoUsuario
            )
        )
      )
`;
const ANUNCIOS_SOLO_ACTIVOS = `
    WHERE a.Activo = 1
`;
const ALLOWED_DESTINATARIO_TYPES = new Set(['Rol', 'Nivel', 'Curso', 'Usuario', 'Grado', 'Asignatura']);
const hasAnuncioDestinatariosTable = async (pool, now = Date.now()) => {
    const cached = destinatariosTableCache.get(pool);
    if (cached && now - cached.checkedAt < DESTINATARIOS_TABLE_CACHE_TTL_MS) {
        return cached.exists;
    }
    const result = await pool.request()
        .input('schemaName', mssql_1.default.NVarChar(128), 'Virtual')
        .input('tableName', mssql_1.default.NVarChar(128), 'AnuncioDestinatarios')
        .query(`
            SELECT CASE WHEN EXISTS (
                SELECT 1
                FROM sys.tables t
                JOIN sys.schemas s ON s.schema_id = t.schema_id
                WHERE s.name = @schemaName AND t.name = @tableName
            ) THEN 1 ELSE 0 END AS [exists]
        `);
    const exists = result.recordset[0]?.exists === 1;
    destinatariosTableCache.set(pool, { checkedAt: now, exists });
    return exists;
};
exports.hasAnuncioDestinatariosTable = hasAnuncioDestinatariosTable;
const normalizeDestinatarios = (destinatarios) => {
    if (!destinatarios || destinatarios.length === 0)
        return [];
    const seen = new Set();
    const normalized = [];
    for (const item of destinatarios) {
        if (!item || !ALLOWED_DESTINATARIO_TYPES.has(item.tipo))
            continue;
        const valor = String(item.valor ?? '').trim();
        if (!valor)
            continue;
        const key = `${item.tipo}:${valor}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        normalized.push({ tipo: item.tipo, valor });
    }
    return normalized;
};
exports.normalizeDestinatarios = normalizeDestinatarios;
const buildAnunciosInstitucionalesQuery = (isAdmin, hasAudienceTable = true) => {
    return `${ANUNCIOS_BASE_SELECT}
        ${isAdmin ? '' : hasAudienceTable ? ANUNCIOS_FILTRO_AUDIENCIA : ANUNCIOS_SOLO_ACTIVOS}
        ORDER BY a.FechaPublicacion DESC`;
};
exports.buildAnunciosInstitucionalesQuery = buildAnunciosInstitucionalesQuery;
const getAnunciosInstitucionales = async (codigoUsuario, perfilUsuario) => {
    const pool = await dbPool_1.poolPromise;
    const isAdmin = ADMIN_PROFILES.has(perfilUsuario.toLowerCase());
    const hasAudienceTable = await (0, exports.hasAnuncioDestinatariosTable)(pool);
    const query = (0, exports.buildAnunciosInstitucionalesQuery)(isAdmin, hasAudienceTable);
    const request = pool.request();
    if (!isAdmin) {
        request.input('codigoUsuario', mssql_1.default.Int, codigoUsuario);
        request.input('perfilUsuario', mssql_1.default.NVarChar, perfilUsuario);
    }
    const result = await request.query(query);
    if (isAdmin && hasAudienceTable && result.recordset.length > 0) {
        const idsCsv = result.recordset.map(a => a.anuncioId).join(',');
        const destinatariosResult = await pool.request().query(`
            SELECT AnuncioID as anuncioId, Tipo as tipo, Valor as valor
            FROM Virtual.AnuncioDestinatarios
            WHERE AnuncioID IN (${idsCsv})
        `);
        const destinatariosByAnuncio = new Map();
        for (const row of destinatariosResult.recordset) {
            if (!destinatariosByAnuncio.has(row.anuncioId)) {
                destinatariosByAnuncio.set(row.anuncioId, []);
            }
            destinatariosByAnuncio.get(row.anuncioId).push({ tipo: row.tipo, valor: row.valor });
        }
        for (const anuncio of result.recordset) {
            anuncio.destinatarios = destinatariosByAnuncio.get(anuncio.anuncioId) ?? [];
        }
    }
    else if (isAdmin) {
        for (const anuncio of result.recordset) {
            anuncio.destinatarios = [];
        }
    }
    return result.recordset;
};
exports.getAnunciosInstitucionales = getAnunciosInstitucionales;
const createAnuncioInstitucional = async (titulo, contenido, codigoUsuario, perfilUsuario, destinatarios) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    const destinatariosNormalizados = (0, exports.normalizeDestinatarios)(destinatarios);
    if (destinatariosNormalizados.length > 0 && !(await (0, exports.hasAnuncioDestinatariosTable)(pool))) {
        throw new Error('La base de datos del tenant no tiene Virtual.AnuncioDestinatarios. Ejecuta la migracion de segmentacion antes de crear anuncios con destinatarios.');
    }
    try {
        await transaction.begin();
        const result = await transaction.request()
            .input('titulo', mssql_1.default.NVarChar(1024), titulo)
            .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), contenido)
            .input('codigoUsuario', mssql_1.default.SmallInt, codigoUsuario)
            .input('perfilUsuario', mssql_1.default.NVarChar(96), perfilUsuario)
            .query(`
                INSERT INTO Virtual.AnunciosInstitucionales (Titulo, ContenidoHTML, CodigoUsuario, PerfilUsuario, FechaPublicacion, Activo)
                OUTPUT INSERTED.AnuncioID
                VALUES (@titulo, @contenido, @codigoUsuario, @perfilUsuario, GETDATE(), 1);
            `);
        const insertedId = result.recordset[0].AnuncioID;
        if (destinatariosNormalizados.length > 0) {
            for (const dest of destinatariosNormalizados) {
                await transaction.request()
                    .input('anuncioId', mssql_1.default.Int, insertedId)
                    .input('tipo', mssql_1.default.NVarChar(50), dest.tipo)
                    .input('valor', mssql_1.default.NVarChar(100), dest.valor)
                    .query(`INSERT INTO Virtual.AnuncioDestinatarios (AnuncioID, Tipo, Valor) VALUES (@anuncioId, @tipo, @valor)`);
            }
        }
        await transaction.commit();
        await (0, log_service_1.registrarAccion)(codigoUsuario, perfilUsuario, 'Administración', 'Anuncios Institucionales', `Creó anuncio institucional segmentado: ${titulo}`);
        const newAnuncioResult = await pool.request()
            .input('id', mssql_1.default.Int, insertedId)
            .query(`
                SELECT 
                    a.AnuncioID as anuncioId, a.Titulo as titulo, a.ContenidoHTML as contenidoHTML, 
                    a.FechaPublicacion as fechaPublicacion, a.CodigoUsuario as codigoUsuario, 
                    a.PerfilUsuario as perfilUsuario, a.Activo as activo, u.NombreCompleto AS nombreUsuario
                FROM Virtual.AnunciosInstitucionales a
                LEFT JOIN dbo.Usuarios u ON a.CodigoUsuario = u.Código
                WHERE a.AnuncioID = @id
            `);
        const finalAnuncio = newAnuncioResult.recordset[0];
        finalAnuncio.destinatarios = destinatariosNormalizados;
        return finalAnuncio;
    }
    catch (err) {
        if (transaction)
            await transaction.rollback();
        throw err;
    }
};
exports.createAnuncioInstitucional = createAnuncioInstitucional;
const updateAnuncioInstitucional = async (id, titulo, contenido, codigoUsuario, perfilUsuario) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('id', mssql_1.default.Int, id)
        .input('titulo', mssql_1.default.NVarChar(1024), titulo)
        .input('contenido', mssql_1.default.NVarChar(mssql_1.default.MAX), contenido)
        .query(`
            UPDATE Virtual.AnunciosInstitucionales
            SET Titulo = @titulo, ContenidoHTML = @contenido
            WHERE AnuncioID = @id
        `);
    await (0, log_service_1.registrarAccion)(codigoUsuario, perfilUsuario, 'Administración', 'Anuncios Institucionales', `Editó anuncio institucional ID: ${id}`);
    const updatedAnuncioResult = await pool.request()
        .input('id', mssql_1.default.Int, id)
        .query(`
            SELECT 
                a.AnuncioID as anuncioId, a.Titulo as titulo, a.ContenidoHTML as contenidoHTML, 
                a.FechaPublicacion as fechaPublicacion, a.CodigoUsuario as codigoUsuario, 
                a.PerfilUsuario as perfilUsuario, a.Activo as activo, u.NombreCompleto AS nombreUsuario
            FROM Virtual.AnunciosInstitucionales a
            LEFT JOIN dbo.Usuarios u ON a.CodigoUsuario = u.Código
            WHERE a.AnuncioID = @id
        `);
    return updatedAnuncioResult.recordset[0];
};
exports.updateAnuncioInstitucional = updateAnuncioInstitucional;
const deleteAnuncioInstitucional = async (id, codigoUsuario, perfilUsuario) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('id', mssql_1.default.Int, id)
        .query(`DELETE FROM Virtual.AnunciosInstitucionales WHERE AnuncioID = @id`);
    await (0, log_service_1.registrarAccion)(codigoUsuario, perfilUsuario, 'Administración', 'Anuncios Institucionales', `Eliminó anuncio institucional ID: ${id}`);
};
exports.deleteAnuncioInstitucional = deleteAnuncioInstitucional;
const getHierarchyData = async (tipo) => {
    const pool = await dbPool_1.poolPromise;
    let query = '';
    if (tipo === 'Estudiantes') {
        query = `
            SELECT DISTINCT
                COALESCE(g.NivelAprendizaje, 'Sin Nivel') AS nivelNombre,
                g.Código AS gradoId, g.Descripción AS gradoNombre,
                c.Código AS cursoId, c.Curso AS cursoNombre,
                e.MatrículaNo AS finalId, 
                LTRIM(RTRIM(CONCAT(e.PrimerApellido, ' ', e.SegundoApellido, ' ', e.PrimerNombre, ' ', e.SegundoNombre))) AS finalNombre
            FROM dbo.Grados g
            JOIN dbo.Cursos c ON g.Código = c.CódigoGrado
            JOIN dbo.Estudiantes e ON c.Código = e.CódigoCurso
            WHERE (e.Estado IS NULL OR e.Estado != 'Retirado')
            ORDER BY nivelNombre, g.Descripción, c.Curso, finalNombre
        `;
    }
    else {
        query = `
            SELECT DISTINCT
                COALESCE(g.NivelAprendizaje, 'Sin Nivel') AS nivelNombre,
                g.Código AS gradoId, g.Descripción AS gradoNombre,
                c.Código AS cursoId, c.Curso AS cursoNombre,
                d.Código AS finalId, 
                LTRIM(RTRIM(CONCAT(d.PrimerNombre, ' ', d.SegundoNombre, ' ', d.PrimerApellido, ' ', d.SegundoApellido))) AS finalNombre
            FROM dbo.Grados g
            JOIN dbo.Cursos c ON g.Código = c.CódigoGrado
            JOIN dbo.Asignaturas asig ON c.Código = asig.CódigoCurso
            JOIN dbo.AsignaciónAcadémica aa ON asig.Código = aa.CódigoAsignatura
            JOIN dbo.Docentes d ON aa.CódigoDocente = d.Código
            ORDER BY nivelNombre, g.Descripción, c.Curso, finalNombre
        `;
    }
    const result = await pool.request().query(query);
    const nivelesMap = new Map();
    result.recordset.forEach(row => {
        // NIVEL: Creamos un ID de ruta único
        const nivelPathId = `Nivel-${row.nivelNombre}`;
        if (!nivelesMap.has(row.nivelNombre)) {
            nivelesMap.set(row.nivelNombre, {
                id: nivelPathId,
                entityId: row.nivelNombre, // Guardamos el valor real
                nombre: row.nivelNombre,
                tipo: 'Nivel',
                children: new Map()
            });
        }
        const nivel = nivelesMap.get(row.nivelNombre);
        // GRADO: El ID incluye su nivel padre
        const gradoPathId = `${nivelPathId}_Grado-${row.gradoId}`;
        if (!nivel.children.has(row.gradoId)) {
            nivel.children.set(row.gradoId, {
                id: gradoPathId,
                entityId: String(row.gradoId),
                nombre: `Grado ${row.gradoNombre}`,
                tipo: 'Grado',
                children: new Map()
            });
        }
        const grado = nivel.children.get(row.gradoId);
        // CURSO: El ID incluye su grado padre
        const cursoPathId = `${gradoPathId}_Curso-${row.cursoId}`;
        if (!grado.children.has(row.cursoId)) {
            grado.children.set(row.cursoId, {
                id: cursoPathId,
                entityId: String(row.cursoId),
                nombre: `Curso ${row.gradoNombre}-${row.cursoNombre}`,
                tipo: 'Curso',
                children: new Map()
            });
        }
        const curso = grado.children.get(row.cursoId);
        // USUARIO: Ruta absoluta
        if (row.finalId) {
            const usuarioPathId = `${cursoPathId}_Usuario-${row.finalId}`;
            curso.children.set(row.finalId, {
                id: usuarioPathId,
                entityId: String(row.finalId),
                nombre: row.finalNombre,
                tipo: 'Usuario'
            });
        }
    });
    const formatChildren = (map) => {
        return Array.from(map.values()).map(({ children, ...node }) => ({
            ...node,
            ...(children ? { children: formatChildren(children) } : {}),
        }));
    };
    return formatChildren(nivelesMap);
};
exports.getHierarchyData = getHierarchyData;
const getAudienciaData = async () => {
    const pool = await dbPool_1.poolPromise;
    const cursosResult = await pool.request().query(`
        SELECT g.Descripción AS grado, c.Código AS codigoCurso, c.Curso AS nombreCurso
        FROM dbo.Cursos c
        JOIN dbo.Grados g ON c.CódigoGrado = g.Código
        ORDER BY g.Código, c.Curso
    `);
    const gradosMap = new Map();
    cursosResult.recordset.forEach(row => {
        if (!gradosMap.has(row.grado)) {
            gradosMap.set(row.grado, []);
        }
        gradosMap.get(row.grado).push({ id: row.codigoCurso, nombre: row.nombreCurso });
    });
    const grados = Array.from(gradosMap.entries()).map(([nombre, cursos]) => ({ nombre, cursos }));
    const roles = ['Estudiante', 'Docente', 'Coordinador', 'Administrador'];
    return { grados, roles };
};
exports.getAudienciaData = getAudienciaData;
const getDocentes = async () => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query(`
        SELECT d.Código as codigo, 
               LTRIM(RTRIM(CONCAT(d.PrimerNombre, ' ', d.SegundoNombre, ' ', d.PrimerApellido, ' ', d.SegundoApellido))) as nombre,
               u.Perfil as perfil
        FROM dbo.Docentes d
        JOIN dbo.Usuarios u ON d.Código = u.Código
        WHERE u.Perfil IN ('Docente', 'Director de grupo')
        ORDER BY nombre
    `);
    return result.recordset;
};
exports.getDocentes = getDocentes;
const getEstudiantes = async () => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request().query(`
        SELECT MatrículaNo as codigo, 
               LTRIM(RTRIM(CONCAT(PrimerApellido, ' ', SegundoApellido, ' ', PrimerNombre, ' ', SegundoNombre))) as nombre,
               'Estudiante' as perfil
        FROM dbo.Estudiantes
        WHERE (Estado IS NULL OR Estado != 'Retirado')
        ORDER BY nombre
    `);
    return result.recordset;
};
exports.getEstudiantes = getEstudiantes;
const getCargaDocente = async (codigoDocente) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('codigoDocente', mssql_1.default.Int, codigoDocente)
        .query(`
            SELECT DISTINCT
                g.Descripción AS grado,
                c.Código AS codigoCurso,
                c.Curso AS nombreCurso
            FROM dbo.AsignaciónAcadémica aa
            JOIN dbo.Asignaturas asig ON aa.CódigoAsignatura = asig.Código
            JOIN dbo.Cursos c ON asig.CódigoCurso = c.Código
            JOIN dbo.Grados g ON c.CódigoGrado = g.Código
            WHERE aa.CódigoDocente = @codigoDocente
            ORDER BY g.Descripción, c.Curso
        `);
    const gradosMap = new Map();
    result.recordset.forEach(row => {
        if (!gradosMap.has(row.grado)) {
            gradosMap.set(row.grado, []);
        }
        gradosMap.get(row.grado).push({ id: row.codigoCurso, nombre: row.nombreCurso });
    });
    return Array.from(gradosMap.entries()).map(([nombre, cursos]) => ({ nombre, cursos }));
};
exports.getCargaDocente = getCargaDocente;
const buscarUsuarios = async (termino) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('query', mssql_1.default.NVarChar, `%${termino}%`)
        .query(`
            SELECT TOP 20 
                Código as codigo, 
                NombreCompleto as nombre, 
                Perfil as perfil,
                'Usuario' as tipo
            FROM dbo.Usuarios
            WHERE NombreCompleto LIKE @query
            UNION ALL
            SELECT TOP 20 
                MatrículaNo as codigo, 
                LTRIM(RTRIM(CONCAT(PrimerApellido, ' ', SegundoApellido, ' ', PrimerNombre, ' ', SegundoNombre))) as nombre,
                'Estudiante' as perfil,
                'Estudiante' as tipo
            FROM dbo.Estudiantes
            WHERE PrimerNombre LIKE @query OR PrimerApellido LIKE @query OR NúmeroDocumento LIKE @query
        `);
    return result.recordset;
};
exports.buscarUsuarios = buscarUsuarios;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificarPeriodoPorEntradaForo = exports.verificarPeriodoPorPreguntaPrueba = exports.verificarPeriodoPorPrueba = exports.verificarPeriodoPorRecurso = exports.verificarPeriodoPorApartado = void 0;
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const roles_1 = require("../constants/roles");
const ADMIN_ROLES = [
    roles_1.ROLES.COORDINADOR,
    roles_1.ROLES.COORDINADOR_GENERAL,
    roles_1.ROLES.ADMINISTRADOR,
    roles_1.ROLES.MASTER,
];
/**
 * Resuelve el NumeroPeriodo a partir de un apartadoId.
 * Cadena: apartadoId → Virtual.Apartados.SemanaID → Virtual.Semanas.NumeroPeriodo
 */
const resolverPeriodoPorApartado = async (pool, apartadoId) => {
    const result = await pool.request()
        .input('apartadoId', mssql_1.default.Int, apartadoId)
        .query(`
            SELECT s.NumeroPeriodo
            FROM Virtual.Apartados a
            JOIN Virtual.Semanas s ON a.SemanaID = s.SemanaID
            WHERE a.ApartadoID = @apartadoId
        `);
    return result.recordset.length > 0 ? result.recordset[0].NumeroPeriodo : null;
};
/**
 * Resuelve el NumeroPeriodo a partir de un recursoId.
 * Cadena: recursoId → Virtual.Recursos.ApartadoID → Apartados → Semanas
 */
const resolverPeriodoPorRecurso = async (pool, recursoId) => {
    const result = await pool.request()
        .input('recursoId', mssql_1.default.Int, recursoId)
        .query(`
            SELECT s.NumeroPeriodo
            FROM Virtual.Recursos r
            JOIN Virtual.Apartados a ON r.ApartadoID = a.ApartadoID
            JOIN Virtual.Semanas s ON a.SemanaID = s.SemanaID
            WHERE r.RecursoID = @recursoId
        `);
    return result.recordset.length > 0 ? result.recordset[0].NumeroPeriodo : null;
};
/**
 * Verifica si un periodo está abierto para un docente específico.
 */
const verificarPeriodoAbierto = async (pool, numeroPeriodo, codigoDocente) => {
    const result = await pool.request()
        .input('numeroPeriodo', mssql_1.default.SmallInt, numeroPeriodo)
        .input('codigoDocente', mssql_1.default.SmallInt, codigoDocente)
        .query(`
            SELECT
                cp.NumeroPeriodo,
                ISNULL(cp.BloqueadoManualmente, 0) as BloqueadoManualmente,
                cp.FechaApertura,
                cp.FechaCierre,
                CASE
                    WHEN ex.ExcepcionID IS NOT NULL AND ex.FechaLimiteExcepcion > GETDATE() THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END as TieneExcepcion
            FROM Virtual.ControlPeriodos cp
            LEFT JOIN Virtual.ExcepcionesPeriodo ex
                ON cp.NumeroPeriodo = ex.NumeroPeriodo AND ex.CodigoDocente = @codigoDocente
            WHERE cp.NumeroPeriodo = @numeroPeriodo
        `);
    // Si no existe configuracion en ControlPeriodos, el periodo está abierto por retrocompatibilidad
    if (result.recordset.length === 0) {
        return { abierto: true, razon: '' };
    }
    const row = result.recordset[0];
    // Si tiene excepcion activa, siempre puede operar
    if (row.TieneExcepcion) {
        return { abierto: true, razon: '' };
    }
    // Si está bloqueado manualmente
    if (row.BloqueadoManualmente) {
        return { abierto: false, razon: 'El periodo se encuentra bloqueado manualmente por el coordinador.' };
    }
    // Si tiene fechas configuradas, verificar rango
    if (row.FechaApertura && row.FechaCierre) {
        const ahora = new Date();
        const apertura = new Date(row.FechaApertura);
        const cierre = new Date(row.FechaCierre);
        if (ahora < apertura) {
            return { abierto: false, razon: 'El periodo aun no ha abierto.' };
        }
        if (ahora > cierre) {
            return { abierto: false, razon: 'El periodo ya cerro. Solicita una prorroga al coordinador.' };
        }
    }
    return { abierto: true, razon: '' };
};
/**
 * Middleware factory: verifica que el periodo esté abierto antes de crear un recurso.
 * Extrae apartadoId del body (JSON o jsonData para multipart).
 */
const verificarPeriodoPorApartado = () => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }
        // Admins/coordinadores no están sujetos a control de periodo
        if (ADMIN_ROLES.includes(req.user.perfil)) {
            return next();
        }
        try {
            // Extraer apartadoId del body (JSON directo o multipart jsonData)
            let apartadoId;
            if (req.body.apartadoId) {
                apartadoId = Number(req.body.apartadoId);
            }
            else if (req.body.jsonData) {
                try {
                    const parsed = JSON.parse(req.body.jsonData);
                    apartadoId = parsed.apartadoId ? Number(parsed.apartadoId) : undefined;
                }
                catch {
                    // jsonData no es JSON valido, dejar pasar al controller que manejara el error
                    return next();
                }
            }
            if (!apartadoId || isNaN(apartadoId)) {
                // Sin apartadoId no podemos determinar el periodo, dejamos pasar
                return next();
            }
            const pool = await dbPool_1.poolPromise;
            const numeroPeriodo = await resolverPeriodoPorApartado(pool, apartadoId);
            if (numeroPeriodo === null) {
                return next(); // Apartado no encontrado, el controller manejara
            }
            const { abierto, razon } = await verificarPeriodoAbierto(pool, numeroPeriodo, req.user.codigo);
            if (!abierto) {
                return res.status(403).json({
                    message: `No puedes realizar esta accion. ${razon}`,
                    code: 'PERIODO_CERRADO'
                });
            }
            next();
        }
        catch (error) {
            console.error('Error en middleware verificarPeriodoPorApartado:', error);
            next();
        }
    };
};
exports.verificarPeriodoPorApartado = verificarPeriodoPorApartado;
/**
 * Resuelve el NumeroPeriodo a partir de un pruebaId.
 * Cadena: pruebaId → Virtual.Pruebas.RecursoID → Recursos → Apartados → Semanas
 */
const resolverPeriodoPorPrueba = async (pool, pruebaId) => {
    const result = await pool.request()
        .input('pruebaId', mssql_1.default.Int, pruebaId)
        .query(`
            SELECT s.NumeroPeriodo
            FROM Virtual.Pruebas p
            JOIN Virtual.Recursos r ON p.RecursoID = r.RecursoID
            JOIN Virtual.Apartados a ON r.ApartadoID = a.ApartadoID
            JOIN Virtual.Semanas s ON a.SemanaID = s.SemanaID
            WHERE p.PruebaID = @pruebaId
        `);
    return result.recordset.length > 0 ? result.recordset[0].NumeroPeriodo : null;
};
/**
 * Resuelve el NumeroPeriodo a partir de una pregunta de prueba.
 * Cadena: preguntaId -> Pruebas_Preguntas.PruebaID -> Pruebas -> Recursos -> Apartados -> Semanas
 */
const resolverPeriodoPorPreguntaPrueba = async (pool, preguntaId) => {
    const result = await pool.request()
        .input('preguntaId', mssql_1.default.Int, preguntaId)
        .query(`
            SELECT s.NumeroPeriodo
            FROM Virtual.Pruebas_Preguntas pp
            JOIN Virtual.Pruebas p ON pp.PruebaID = p.PruebaID
            JOIN Virtual.Recursos r ON p.RecursoID = r.RecursoID
            JOIN Virtual.Apartados a ON r.ApartadoID = a.ApartadoID
            JOIN Virtual.Semanas s ON a.SemanaID = s.SemanaID
            WHERE pp.PreguntaID = @preguntaId
        `);
    return result.recordset.length > 0 ? result.recordset[0].NumeroPeriodo : null;
};
/**
 * Resuelve el NumeroPeriodo a partir de un entradaId de foro.
 * Cadena: entradaId → Virtual.ForoEntradas.RecursoID → Recursos → Apartados → Semanas
 */
const resolverPeriodoPorEntradaForo = async (pool, entradaId) => {
    const result = await pool.request()
        .input('entradaId', mssql_1.default.Int, entradaId)
        .query(`
            SELECT s.NumeroPeriodo
            FROM Virtual.ForoEntradas e
            JOIN Virtual.Recursos r ON e.RecursoID = r.RecursoID
            JOIN Virtual.Apartados a ON r.ApartadoID = a.ApartadoID
            JOIN Virtual.Semanas s ON a.SemanaID = s.SemanaID
            WHERE e.EntradaID = @entradaId
        `);
    return result.recordset.length > 0 ? result.recordset[0].NumeroPeriodo : null;
};
/**
 * Middleware factory: verifica que el periodo esté abierto usando el recursoId del param.
 * Para rutas PUT/DELETE de recursos existentes (/:id).
 */
const verificarPeriodoPorRecurso = () => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }
        if (ADMIN_ROLES.includes(req.user.perfil)) {
            return next();
        }
        try {
            const recursoId = Number(req.params.id || req.params.recursoId);
            if (!recursoId || isNaN(recursoId)) {
                return next();
            }
            const pool = await dbPool_1.poolPromise;
            const numeroPeriodo = await resolverPeriodoPorRecurso(pool, recursoId);
            if (numeroPeriodo === null) {
                return next();
            }
            const { abierto, razon } = await verificarPeriodoAbierto(pool, numeroPeriodo, req.user.codigo);
            if (!abierto) {
                return res.status(403).json({
                    message: `No puedes realizar esta accion. ${razon}`,
                    code: 'PERIODO_CERRADO'
                });
            }
            next();
        }
        catch (error) {
            console.error('Error en middleware verificarPeriodoPorRecurso:', error);
            next();
        }
    };
};
exports.verificarPeriodoPorRecurso = verificarPeriodoPorRecurso;
/**
 * Middleware factory: verifica que el periodo esté abierto usando el pruebaId del param.
 * Para rutas de escritura en pruebas (/:pruebaId).
 */
const verificarPeriodoPorPrueba = () => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }
        if (ADMIN_ROLES.includes(req.user.perfil)) {
            return next();
        }
        try {
            const pruebaId = Number(req.params.pruebaId);
            if (!pruebaId || isNaN(pruebaId)) {
                return next();
            }
            const pool = await dbPool_1.poolPromise;
            const numeroPeriodo = await resolverPeriodoPorPrueba(pool, pruebaId);
            if (numeroPeriodo === null) {
                return next();
            }
            const { abierto, razon } = await verificarPeriodoAbierto(pool, numeroPeriodo, req.user.codigo);
            if (!abierto) {
                return res.status(403).json({
                    message: `No puedes realizar esta accion. ${razon}`,
                    code: 'PERIODO_CERRADO'
                });
            }
            next();
        }
        catch (error) {
            console.error('Error en middleware verificarPeriodoPorPrueba:', error);
            next();
        }
    };
};
exports.verificarPeriodoPorPrueba = verificarPeriodoPorPrueba;
/**
 * Middleware factory: verifica periodo abierto usando preguntaId en params.
 * Para rutas PUT/DELETE sobre /pruebas/preguntas/:preguntaId.
 */
const verificarPeriodoPorPreguntaPrueba = () => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }
        if (ADMIN_ROLES.includes(req.user.perfil)) {
            return next();
        }
        try {
            const preguntaId = Number(req.params.preguntaId);
            if (!preguntaId || isNaN(preguntaId)) {
                return next();
            }
            const pool = await dbPool_1.poolPromise;
            const numeroPeriodo = await resolverPeriodoPorPreguntaPrueba(pool, preguntaId);
            if (numeroPeriodo === null) {
                return next();
            }
            const { abierto, razon } = await verificarPeriodoAbierto(pool, numeroPeriodo, req.user.codigo);
            if (!abierto) {
                return res.status(403).json({
                    message: `No puedes realizar esta accion. ${razon}`,
                    code: 'PERIODO_CERRADO'
                });
            }
            next();
        }
        catch (error) {
            console.error('Error en middleware verificarPeriodoPorPreguntaPrueba:', error);
            next();
        }
    };
};
exports.verificarPeriodoPorPreguntaPrueba = verificarPeriodoPorPreguntaPrueba;
/**
 * Middleware factory: verifica que el periodo esté abierto usando el entradaId de foro.
 * Para rutas PUT/DELETE de entradas de foro.
 */
const verificarPeriodoPorEntradaForo = () => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }
        if (ADMIN_ROLES.includes(req.user.perfil)) {
            return next();
        }
        try {
            const entradaId = Number(req.params.entradaId);
            if (!entradaId || isNaN(entradaId)) {
                return next();
            }
            const pool = await dbPool_1.poolPromise;
            const numeroPeriodo = await resolverPeriodoPorEntradaForo(pool, entradaId);
            if (numeroPeriodo === null) {
                return next();
            }
            const { abierto, razon } = await verificarPeriodoAbierto(pool, numeroPeriodo, req.user.codigo);
            if (!abierto) {
                return res.status(403).json({
                    message: `No puedes realizar esta accion. ${razon}`,
                    code: 'PERIODO_CERRADO'
                });
            }
            next();
        }
        catch (error) {
            console.error('Error en middleware verificarPeriodoPorEntradaForo:', error);
            next();
        }
    };
};
exports.verificarPeriodoPorEntradaForo = verificarPeriodoPorEntradaForo;

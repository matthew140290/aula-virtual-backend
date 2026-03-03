// src/middleware/periodo.middleware.ts
// Middleware que verifica si el periodo asociado a un recurso está abierto
// antes de permitir operaciones de escritura (crear, editar, eliminar).
import { Request, Response, NextFunction } from 'express';
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { ROLES, type Role } from '../constants/roles';

const ADMIN_ROLES: readonly string[] = [
    ROLES.COORDINADOR,
    ROLES.COORDINADOR_GENERAL,
    ROLES.ADMINISTRADOR,
    ROLES.MASTER,
];

interface PeriodoCheckResult {
    NumeroPeriodo: number;
    BloqueadoManualmente: boolean;
    FechaApertura: Date | null;
    FechaCierre: Date | null;
    TieneExcepcion: boolean;
}

/**
 * Resuelve el NumeroPeriodo a partir de un apartadoId.
 * Cadena: apartadoId → Virtual.Apartados.SemanaID → Virtual.Semanas.NumeroPeriodo
 */
const resolverPeriodoPorApartado = async (pool: sql.ConnectionPool, apartadoId: number): Promise<number | null> => {
    const result = await pool.request()
        .input('apartadoId', sql.Int, apartadoId)
        .query<{ NumeroPeriodo: number }>(`
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
const resolverPeriodoPorRecurso = async (pool: sql.ConnectionPool, recursoId: number): Promise<number | null> => {
    const result = await pool.request()
        .input('recursoId', sql.Int, recursoId)
        .query<{ NumeroPeriodo: number }>(`
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
const verificarPeriodoAbierto = async (
    pool: sql.ConnectionPool,
    numeroPeriodo: number,
    codigoDocente: number
): Promise<{ abierto: boolean; razon: string }> => {
    const result = await pool.request()
        .input('numeroPeriodo', sql.SmallInt, numeroPeriodo)
        .input('codigoDocente', sql.SmallInt, codigoDocente)
        .query<PeriodoCheckResult>(`
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
export const verificarPeriodoPorApartado = () => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }

        // Admins/coordinadores no están sujetos a control de periodo
        if (ADMIN_ROLES.includes(req.user.perfil)) {
            return next();
        }

        try {
            // Extraer apartadoId del body (JSON directo o multipart jsonData)
            let apartadoId: number | undefined;

            if (req.body.apartadoId) {
                apartadoId = Number(req.body.apartadoId);
            } else if (req.body.jsonData) {
                try {
                    const parsed = JSON.parse(req.body.jsonData);
                    apartadoId = parsed.apartadoId ? Number(parsed.apartadoId) : undefined;
                } catch {
                    // jsonData no es JSON valido, dejar pasar al controller que manejara el error
                    return next();
                }
            }

            if (!apartadoId || isNaN(apartadoId)) {
                // Sin apartadoId no podemos determinar el periodo, dejamos pasar
                return next();
            }

            const pool = await poolPromise;
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
        } catch (error: unknown) {
            console.error('Error en middleware verificarPeriodoPorApartado:', error);
            next();
        }
    };
};

/**
 * Resuelve el NumeroPeriodo a partir de un pruebaId.
 * Cadena: pruebaId → Virtual.Pruebas.RecursoID → Recursos → Apartados → Semanas
 */
const resolverPeriodoPorPrueba = async (pool: sql.ConnectionPool, pruebaId: number): Promise<number | null> => {
    const result = await pool.request()
        .input('pruebaId', sql.Int, pruebaId)
        .query<{ NumeroPeriodo: number }>(`
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
 * Resuelve el NumeroPeriodo a partir de un entradaId de foro.
 * Cadena: entradaId → Virtual.ForoEntradas.RecursoID → Recursos → Apartados → Semanas
 */
const resolverPeriodoPorEntradaForo = async (pool: sql.ConnectionPool, entradaId: number): Promise<number | null> => {
    const result = await pool.request()
        .input('entradaId', sql.Int, entradaId)
        .query<{ NumeroPeriodo: number }>(`
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
export const verificarPeriodoPorRecurso = () => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
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

            const pool = await poolPromise;
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
        } catch (error: unknown) {
            console.error('Error en middleware verificarPeriodoPorRecurso:', error);
            next();
        }
    };
};

/**
 * Middleware factory: verifica que el periodo esté abierto usando el pruebaId del param.
 * Para rutas de escritura en pruebas (/:pruebaId).
 */
export const verificarPeriodoPorPrueba = () => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
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

            const pool = await poolPromise;
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
        } catch (error: unknown) {
            console.error('Error en middleware verificarPeriodoPorPrueba:', error);
            next();
        }
    };
};

/**
 * Middleware factory: verifica que el periodo esté abierto usando el entradaId de foro.
 * Para rutas PUT/DELETE de entradas de foro.
 */
export const verificarPeriodoPorEntradaForo = () => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
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

            const pool = await poolPromise;
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
        } catch (error: unknown) {
            console.error('Error en middleware verificarPeriodoPorEntradaForo:', error);
            next();
        }
    };
};

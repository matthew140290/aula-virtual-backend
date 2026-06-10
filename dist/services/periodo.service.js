"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otorgarExcepcionDocentes = exports.configurarControlPeriodo = exports.findAllPeriods = void 0;
// src/services/periodo.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const roles_1 = require("../constants/roles");
const log_service_1 = require("./log.service");
const ADMIN_ROLES = [
    roles_1.ROLES.COORDINADOR,
    roles_1.ROLES.COORDINADOR_GENERAL,
    roles_1.ROLES.ADMINISTRADOR,
    roles_1.ROLES.MASTER,
];
const findAllPeriods = async (actor) => {
    const pool = await dbPool_1.poolPromise;
    const esAdminOCoordinador = ADMIN_ROLES
        .map(roles_1.normalizeRole)
        .includes((0, roles_1.normalizeRole)(actor.perfil));
    const result = await pool.request()
        .input('codigoUsuario', mssql_1.default.SmallInt, actor.codigo)
        .input('esAdmin', mssql_1.default.Bit, esAdminOCoordinador ? 1 : 0)
        .query(`
            SELECT 
                p.Número as numero, 
                p.Descripción as descripcion,
                cp.FechaApertura as fechaInicial,
                cp.FechaCierre as fechaFinal,
                ISNULL(cp.BloqueadoManualmente, 0) as bloqueadoManualmente,
                
                CASE 
                    WHEN ex.ExcepcionID IS NOT NULL AND ex.FechaLimiteExcepcion > GETDATE() THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END as tieneExcepcion,

                -- 💡 LÓGICA DE NEGOCIO CORREGIDA A PRUEBA DE NULOS
                CASE 
                    -- 1. Los admins siempre lo ven activo
                    WHEN @esAdmin = 1 THEN CAST(1 AS BIT)
                    
                    -- 2. Si tiene excepción, pasa
                    WHEN ex.ExcepcionID IS NOT NULL AND ex.FechaLimiteExcepcion > GETDATE() THEN CAST(1 AS BIT)
                    
                    -- 3. Si se bloqueó el switch rojo de emergencia, se cierra todo
                    WHEN cp.BloqueadoManualmente = 1 THEN CAST(0 AS BIT)
                    
                    -- 4. Si el colegio es nuevo y nunca se ha configurado el periodo
                    WHEN cp.ControlPeriodoID IS NULL THEN CAST(1 AS BIT)

                    -- 5. LA MAGIA: Si no tiene fecha de apertura, asume que ya abrió. 
                    -- Si no tiene fecha de cierre, asume que nunca cierra.
                    WHEN (cp.FechaApertura IS NULL OR GETDATE() >= cp.FechaApertura) 
                     AND (cp.FechaCierre IS NULL OR GETDATE() <= cp.FechaCierre) 
                    THEN CAST(1 AS BIT)
                    
                    -- 6. Si no cumplió nada de lo anterior, está cerrado
                    ELSE CAST(0 AS BIT)
                END as activo

            FROM dbo.Períodos p
            LEFT JOIN Virtual.ControlPeriodos cp ON p.Número = cp.NumeroPeriodo
            LEFT JOIN Virtual.ExcepcionesPeriodo ex ON p.Número = ex.NumeroPeriodo AND ex.CodigoDocente = @codigoUsuario
            WHERE p.Descripción != 'Final'
            ORDER BY p.Número
        `);
    return result.recordset;
};
exports.findAllPeriods = findAllPeriods;
const configurarControlPeriodo = async (numeroPeriodo, fechaApertura, fechaCierre, bloqueadoManualmente, actor) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('numero', mssql_1.default.SmallInt, numeroPeriodo)
        .input('apertura', mssql_1.default.DateTime, fechaApertura)
        .input('cierre', mssql_1.default.DateTime, fechaCierre)
        .input('bloqueado', mssql_1.default.Bit, bloqueadoManualmente)
        .query(`
            MERGE INTO Virtual.ControlPeriodos AS target
            USING (SELECT @numero AS NumeroPeriodo) AS source
            ON target.NumeroPeriodo = source.NumeroPeriodo
            WHEN MATCHED THEN
                UPDATE SET FechaApertura = @apertura, FechaCierre = @cierre, BloqueadoManualmente = @bloqueado
            WHEN NOT MATCHED THEN
                INSERT (NumeroPeriodo, FechaApertura, FechaCierre, BloqueadoManualmente)
                VALUES (@numero, @apertura, @cierre, @bloqueado);
        `);
    await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Administración', 'Control de Períodos', `Configuró el período ${numeroPeriodo}`);
};
exports.configurarControlPeriodo = configurarControlPeriodo;
// 3. DAR UNA EXCEPCIÓN A UN DOCENTE (Solo Coordinador/Admin)
const otorgarExcepcionDocentes = async (numeroPeriodo, docentesIds, fechaLimite, comentario, actor) => {
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        // Iteramos para hacer Upsert de cada docente seleccionado
        for (const docenteId of docentesIds) {
            await new mssql_1.default.Request(tx)
                .input('numero', mssql_1.default.SmallInt, numeroPeriodo)
                .input('docente', mssql_1.default.SmallInt, docenteId)
                .input('limite', mssql_1.default.DateTime, fechaLimite)
                .input('comentario', mssql_1.default.NVarChar(512), comentario)
                .query(`
                    MERGE INTO Virtual.ExcepcionesPeriodo AS target
                    USING (SELECT @numero AS NumeroPeriodo, @docente AS CodigoDocente) AS source
                    ON target.NumeroPeriodo = source.NumeroPeriodo AND target.CodigoDocente = source.CodigoDocente
                    WHEN MATCHED THEN
                        UPDATE SET FechaLimiteExcepcion = @limite, Comentario = @comentario
                    WHEN NOT MATCHED THEN
                        INSERT (NumeroPeriodo, CodigoDocente, FechaLimiteExcepcion, Comentario)
                        VALUES (@numero, @docente, @limite, @comentario);
                `);
        }
        await tx.commit();
        await (0, log_service_1.registrarAccion)(actor.codigo, actor.perfil, 'Administración', 'Excepciones', `Otorgó prórroga en periodo ${numeroPeriodo} a ${docentesIds.length} docentes`);
    }
    catch (error) {
        await tx.rollback();
        throw error;
    }
};
exports.otorgarExcepcionDocentes = otorgarExcepcionDocentes;

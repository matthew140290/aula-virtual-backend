// src/services/periodo.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';
import { ROLES, type Role } from '../constants/roles';
import { UserActor } from './recurso.service';
import { registrarAccion } from './log.service';

const ADMIN_ROLES: readonly Role[] = [
    ROLES.COORDINADOR,
    ROLES.COORDINADOR_GENERAL,
    ROLES.ADMINISTRADOR,
    ROLES.MASTER,
] as const;

export interface PeriodoRow {
    numero: number;
    descripcion: string;
    activo: boolean;
    fechaInicial: Date | null;
    fechaFinal: Date | null;
    bloqueadoManualmente: boolean;
    tieneExcepcion: boolean;
}

export const findAllPeriods = async (actor: UserActor): Promise<PeriodoRow[]> => {
    const pool = await poolPromise;
    const esAdminOCoordinador = [ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER].includes(actor.perfil as any);

    const result = await pool.request()
        .input('codigoUsuario', sql.SmallInt, actor.codigo)
        .input('esAdmin', sql.Bit, esAdminOCoordinador ? 1 : 0)
        .query<PeriodoRow>(`
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

export const configurarControlPeriodo = async (
    numeroPeriodo: number,
    fechaApertura: Date | null,
    fechaCierre: Date | null,
    bloqueadoManualmente: boolean,
    actor: UserActor
): Promise<void> => {
    const pool = await poolPromise;
    await pool.request()
        .input('numero', sql.SmallInt, numeroPeriodo)
        .input('apertura', sql.DateTime, fechaApertura)
        .input('cierre', sql.DateTime, fechaCierre)
        .input('bloqueado', sql.Bit, bloqueadoManualmente)
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

    await registrarAccion(actor.codigo, actor.perfil, 'Administración', 'Control de Períodos', `Configuró el período ${numeroPeriodo}`);
};

// 3. DAR UNA EXCEPCIÓN A UN DOCENTE (Solo Coordinador/Admin)
export const otorgarExcepcionDocentes = async (
    numeroPeriodo: number,
    docentesIds: number[],
    fechaLimite: Date,
    comentario: string,
    actor: UserActor
): Promise<void> => {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    
    try {
        await tx.begin();
        
        // Iteramos para hacer Upsert de cada docente seleccionado
        for (const docenteId of docentesIds) {
            await new sql.Request(tx)
                .input('numero', sql.SmallInt, numeroPeriodo)
                .input('docente', sql.SmallInt, docenteId)
                .input('limite', sql.DateTime, fechaLimite)
                .input('comentario', sql.NVarChar(512), comentario)
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
        await registrarAccion(actor.codigo, actor.perfil, 'Administración', 'Excepciones', `Otorgó prórroga en periodo ${numeroPeriodo} a ${docentesIds.length} docentes`);
    } catch (error) {
        await tx.rollback();
        throw error;
    }
};
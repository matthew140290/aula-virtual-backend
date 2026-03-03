// src/services/auditoria.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';

export interface DocenteAuditoriaRow {
    codigoDocente: number;
    nombreCompleto: string;
    documento: string;
    perfil: string;
    ultimoIngreso: Date | null;
    totalAsignaturas: number;
}

export const getDocentesAuditoriaStats = async (): Promise<DocenteAuditoriaRow[]> => {
    const pool = await poolPromise;
    const result = await pool.request().query<DocenteAuditoriaRow>(`
        SET DATEFORMAT mdy;
        SELECT
            d.Código as codigoDocente,
            LTRIM(RTRIM(CONCAT(d.PrimerNombre, ' ', d.SegundoNombre, ' ', d.PrimerApellido, ' ', d.SegundoApellido))) as nombreCompleto,
            d.NúmeroDocumento as documento,
            u.Perfil as perfil,
            (
                SELECT MAX(TRY_CAST(r.Fecha + ' ' + r.Hora AS DATETIME))
                FROM dbo.RegistroOperacionesUsuarios r
                WHERE r.CódigoUsuario = d.Código
                  AND (r.Menú = 'Login' OR r.Opción = 'Login')
            ) as ultimoIngreso,
            (
                SELECT COUNT(*)
                FROM dbo.AsignaciónAcadémica aa
                WHERE aa.CódigoDocente = d.Código
            ) as totalAsignaturas
        FROM dbo.Docentes d
        JOIN dbo.Usuarios u ON d.Código = u.Código
        WHERE u.Perfil IN ('Docente', 'Director de grupo')
        ORDER BY nombreCompleto;
    `);

    return result.recordset;
};
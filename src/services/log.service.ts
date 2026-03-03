// src/services/log.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';


export const registrarAccion = async (
    codigoUsuario: number,
    perfil: string,
    menu: string,
    opcion: string,
    operacion: string
) => {
    if (!codigoUsuario && codigoUsuario !== 0) {
        console.warn('--- LOGGING ABORTADO: Código de usuario inválido ---');
        return;
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        // 1. Iniciar una transacción para asegurar la integridad de los datos.
        await transaction.begin();

        // 2. Obtener el último 'Código' usado.
        const request = new sql.Request(transaction);
        console.log('--- LOGGING: Buscando MAX(Código)... ---');
        const maxIdResult = await request.query('SELECT MAX(Código) as maxCodigo FROM dbo.RegistroOperacionesUsuarios');
        
        // 3. Calcular el nuevo código. Manejamos el caso de que la tabla esté vacía.
        const maxCodigo = maxIdResult.recordset[0].maxCodigo || 0;
        const newCodigo = maxCodigo + 1;

        const idPositivo = Math.abs(codigoUsuario);
        const userLookup = await new sql.Request(transaction)
            .input('idPos', sql.Int, idPositivo)
            .input('perfil', sql.NVarChar(96), perfil)
            .query<{ Código: number }>(`
                SELECT TOP 1 Código FROM dbo.Usuarios 
                WHERE (Código = @idPos OR Código = (@idPos * -1)) AND Perfil = @perfil
            `);
        const codigoReal = userLookup.recordset.length > 0 ? userLookup.recordset[0].Código : codigoUsuario;


        await request
            .input('codigo', sql.Int, newCodigo)
            .input('codigoUsuario', sql.SmallInt, codigoReal)
            .input('perfilUsuario', sql.NVarChar(96), perfil)
            .input('menu', sql.NVarChar(96), menu)
            .input('opcion', sql.NVarChar(512), opcion)
            .input('operacion', sql.NVarChar(1024), operacion)
            .query(`
                INSERT INTO dbo.RegistroOperacionesUsuarios 
                    ([Código], [CódigoUsuario], [PerfilUsuario], [Fecha], [Hora], [Menú], [Opción], [Operación])
                VALUES 
                    (@codigo, @codigoUsuario, @perfilUsuario, FORMAT(GETDATE(), 'M/d/yyyy'), FORMAT(GETDATE(), 'h:mm tt'), @menu, @opcion, @operacion);
            `);

            
        
        // 5. Confirmar la transacción.
        await transaction.commit();
        console.log(`--- LOGGING: Acción registrada exitosamente para el usuario ${codigoUsuario}. ---`);

    } catch (error) {
        try { await transaction.rollback(); } catch(e) {}
       console.error('--- ERROR NO LETAL EN LOGGING ---');
        console.error('Mensaje:', error);
        console.error('Causa probable: El usuario ID ' + codigoUsuario + ' no existe en la tabla dbo.Usuarios (Fallo de FK).');
    }
};
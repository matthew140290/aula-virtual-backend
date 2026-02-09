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

        // console.log(`--- LOGGING: El último código es ${maxCodigo}. El nuevo código será ${newCodigo}. ---`);

        // 4. Realizar la inserción, AHORA INCLUYENDO el 'Código' que calculamos.
        await request
            .input('codigo', sql.SmallInt, newCodigo)
            .input('codigoUsuario', sql.SmallInt, codigoUsuario)
            .input('perfilUsuario', sql.NVarChar(96), perfil)
            .input('menu', sql.NVarChar(96), menu)
            .input('opcion', sql.NVarChar(512), opcion)
            .input('operacion', sql.NVarChar(1024), operacion)
            .query(`
                INSERT INTO dbo.RegistroOperacionesUsuarios 
                    ([Código], [CódigoUsuario], [PerfilUsuario], [Fecha], [Hora], [Menú], [Opción], [Operación])
                VALUES 
                    (@codigo, @codigoUsuario, @perfilUsuario, FORMAT(GETUTCDATE(), 'M/d/yyyy'), FORMAT(GETDATE(), 'h:mm tt'), @menu, @opcion, @operacion);
            `);

            
        
        // 5. Confirmar la transacción.
        await transaction.commit();
        console.log(`--- LOGGING: Acción registrada exitosamente para el usuario ${codigoUsuario}. ---`);

    } catch (error) {
        await transaction.rollback();
       console.error('--- ERROR FATAL AL REGISTRAR ACCIÓN ---:', error);
    }
};
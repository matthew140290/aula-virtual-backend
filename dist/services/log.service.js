"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarAccion = void 0;
// src/services/log.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const registrarAccion = async (codigoUsuario, perfil, menu, opcion, operacion) => {
    if (!codigoUsuario && codigoUsuario !== 0) {
        console.warn('--- LOGGING ABORTADO: Código de usuario inválido ---');
        return;
    }
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        // 1. Iniciar una transacción para asegurar la integridad de los datos.
        await transaction.begin();
        // 2. Obtener el último 'Código' usado.
        const request = new mssql_1.default.Request(transaction);
        console.log('--- LOGGING: Buscando MAX(Código)... ---');
        const maxIdResult = await request.query('SELECT MAX(Código) as maxCodigo FROM dbo.RegistroOperacionesUsuarios');
        // 3. Calcular el nuevo código. Manejamos el caso de que la tabla esté vacía.
        const maxCodigo = maxIdResult.recordset[0].maxCodigo || 0;
        const newCodigo = maxCodigo + 1;
        const idPositivo = Math.abs(codigoUsuario);
        const userLookup = await new mssql_1.default.Request(transaction)
            .input('idPos', mssql_1.default.Int, idPositivo)
            .input('perfil', mssql_1.default.NVarChar(96), perfil)
            .query(`
                SELECT TOP 1 Código FROM dbo.Usuarios 
                WHERE (Código = @idPos OR Código = (@idPos * -1)) AND Perfil = @perfil
            `);
        const codigoReal = userLookup.recordset.length > 0 ? userLookup.recordset[0].Código : codigoUsuario;
        await request
            .input('codigo', mssql_1.default.Int, newCodigo)
            .input('codigoUsuario', mssql_1.default.SmallInt, codigoReal)
            .input('perfilUsuario', mssql_1.default.NVarChar(96), perfil)
            .input('menu', mssql_1.default.NVarChar(96), menu)
            .input('opcion', mssql_1.default.NVarChar(512), opcion)
            .input('operacion', mssql_1.default.NVarChar(1024), operacion)
            .query(`
                INSERT INTO dbo.RegistroOperacionesUsuarios 
                    ([Código], [CódigoUsuario], [PerfilUsuario], [Fecha], [Hora], [Menú], [Opción], [Operación])
                VALUES 
                    (@codigo, @codigoUsuario, @perfilUsuario, FORMAT(GETDATE(), 'M/d/yyyy'), FORMAT(GETDATE(), 'h:mm tt'), @menu, @opcion, @operacion);
            `);
        // 5. Confirmar la transacción.
        await transaction.commit();
        console.log(`--- LOGGING: Acción registrada exitosamente para el usuario ${codigoUsuario}. ---`);
    }
    catch (error) {
        try {
            await transaction.rollback();
        }
        catch (e) { }
        console.error('--- ERROR NO LETAL EN LOGGING ---');
        console.error('Mensaje:', error);
        console.error('Causa probable: El usuario ID ' + codigoUsuario + ' no existe en la tabla dbo.Usuarios (Fallo de FK).');
    }
};
exports.registrarAccion = registrarAccion;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneApartadoById = exports.toggleApartadoPin = exports.deleteApartadoById = exports.updateApartadoName = exports.findApartadosByAsignatura = exports.createApartado = void 0;
// src/services/apartado.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
const createApartado = async (params) => {
    const { semanaId, nombre, tipoApartado = 'custom' } = params;
    const pool = await dbPool_1.poolPromise;
    const tx = new mssql_1.default.Transaction(pool);
    try {
        await tx.begin();
        // 1) Orden siguiente dentro de la semana
        const maxRes = await new mssql_1.default.Request(tx)
            .input('semanaId', mssql_1.default.Int, semanaId)
            .query(`SELECT MAX(Orden) AS maxOrden FROM Virtual.Apartados WHERE SemanaID = @semanaId;`);
        const nextOrder = (maxRes.recordset[0]?.maxOrden || 0) + 1;
        // 2) Insertar apartado
        const ins = await new mssql_1.default.Request(tx)
            .input('semanaId', mssql_1.default.Int, semanaId)
            .input('nombre', mssql_1.default.NVarChar(255), nombre)
            .input('tipoApartado', mssql_1.default.NVarChar(100), tipoApartado)
            .input('orden', mssql_1.default.Int, nextOrder)
            .query(`
        INSERT INTO Virtual.Apartados (SemanaID, Nombre, TipoApartado, Orden, Fijado)
        OUTPUT INSERTED.ApartadoID AS newApartadoId
        VALUES (@semanaId,  @nombre, @tipoApartado, @orden, 0);
      `);
        const newApartadoId = ins.recordset[0].newApartadoId;
        await tx.commit();
        return { newApartadoId };
    }
    catch (e) {
        await tx.rollback();
        console.error('Error al crear apartado:', e);
        throw new Error('Error de base de datos al crear el apartado.');
    }
};
exports.createApartado = createApartado;
// OBTENER apartados de una asignatura
const findApartadosByAsignatura = async (codigoAsignatura) => {
    const pool = await dbPool_1.poolPromise;
    const result = await pool.request()
        .input('codigoAsignatura', mssql_1.default.SmallInt, codigoAsignatura)
        .query(`
            SELECT ApartadoID as id, Nombre as title, Fijado as isPinned 
            FROM Virtual.Apartados 
            WHERE CodigoAsignatura = @codigoAsignatura
            ORDER BY Orden
        `);
    return result.recordset;
};
exports.findApartadosByAsignatura = findApartadosByAsignatura;
// ACTUALIZAR nombre de un apartado
const updateApartadoName = async (apartadoId, newName) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('apartadoId', mssql_1.default.Int, apartadoId)
        .input('newName', mssql_1.default.NVarChar(255), newName)
        .query('UPDATE Virtual.Apartados SET Nombre = @newName WHERE ApartadoID = @apartadoId');
};
exports.updateApartadoName = updateApartadoName;
// BORRAR un apartado
const deleteApartadoById = async (apartadoId) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        // Nota importante: Primero borramos los 'hijos' (recursos) para evitar errores.
        await transaction.request()
            .input('apartadoId', mssql_1.default.Int, apartadoId)
            .query('DELETE FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
        // Ahora borramos el 'padre' (el apartado)
        await transaction.request()
            .input('apartadoId', mssql_1.default.Int, apartadoId)
            .query('DELETE FROM Virtual.Apartados WHERE ApartadoID = @apartadoId');
        await transaction.commit();
    }
    catch (error) {
        await transaction.rollback();
        console.error('Error al borrar el apartado y sus recursos:', error);
        throw new Error('Error de base de datos al borrar el apartado.');
    }
};
exports.deleteApartadoById = deleteApartadoById;
// FIJAR/DESFIJAR un apartado
const toggleApartadoPin = async (apartadoId) => {
    const pool = await dbPool_1.poolPromise;
    await pool.request()
        .input('apartadoId', mssql_1.default.Int, apartadoId)
        .query('UPDATE Virtual.Apartados SET Fijado = CASE WHEN Fijado = 1 THEN 0 ELSE 1 END WHERE ApartadoID = @apartadoId');
};
exports.toggleApartadoPin = toggleApartadoPin;
// CLONAR un apartado
const cloneApartadoById = async (apartadoId) => {
    const pool = await dbPool_1.poolPromise;
    const transaction = new mssql_1.default.Transaction(pool);
    try {
        await transaction.begin();
        // 1. Obtenemos los datos del apartado original
        const originalResult = await transaction.request()
            .input('apartadoId', mssql_1.default.Int, apartadoId)
            .query('SELECT SemanaID, Nombre, TipoApartado FROM Virtual.Apartados WHERE ApartadoID = @apartadoId');
        if (originalResult.recordset.length === 0) {
            throw new Error('El apartado que intentas clonar no existe.');
        }
        const original = originalResult.recordset[0];
        // 2. Encontramos el orden más alto en esa semana para poner la copia al final
        const maxOrderResult = await transaction.request()
            .input('semanaId', mssql_1.default.Int, original.SemanaID)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Apartados WHERE SemanaID = @semanaId');
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;
        // 3. Insertamos la copia en la base de datos
        await transaction.request()
            .input('semanaId', mssql_1.default.Int, original.SemanaID)
            .input('nombre', mssql_1.default.NVarChar(255), `${original.Nombre} (Copia)`)
            .input('tipoApartado', mssql_1.default.NVarChar(100), original.TipoApartado)
            .input('orden', mssql_1.default.Int, newOrder)
            .query(`
                INSERT INTO Virtual.Apartados (SemanaID, Nombre, TipoApartado, Orden, Fijado)
                VALUES (@semanaId, @nombre, @tipoApartado, @orden, 0)
            `);
        await transaction.commit();
        // Nota: Esta versión simple clona el apartado. Una versión más avanzada
        // también podría clonar todos los recursos que contiene.
    }
    catch (error) {
        await transaction.rollback();
        console.error('Error al clonar el apartado:', error);
        throw new Error('Error de base de datos al clonar el apartado.');
    }
};
exports.cloneApartadoById = cloneApartadoById;

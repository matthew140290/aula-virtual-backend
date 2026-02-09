// src/services/apartado.service.ts
import sql from 'mssql';
import { dbConfig } from '../config/database';


export const createApartado = async (params: {
  semanaId: number;
  nombre: string;
  tipoApartado?: string; 
}) => {
  const { semanaId, nombre, tipoApartado = 'custom' } = params;

  const pool = await sql.connect(dbConfig);
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1) Orden siguiente dentro de la semana
    const maxRes = await new sql.Request(tx)
      .input('semanaId', sql.Int, semanaId)
      .query(`SELECT MAX(Orden) AS maxOrden FROM Virtual.Apartados WHERE SemanaID = @semanaId;`);
    const nextOrder = (maxRes.recordset[0]?.maxOrden || 0) + 1;

    // 2) Insertar apartado
    const ins = await new sql.Request(tx)
      .input('semanaId', sql.Int, semanaId)
      .input('nombre', sql.NVarChar(255), nombre)
      .input('tipoApartado', sql.NVarChar(100), tipoApartado)
      .input('orden', sql.Int, nextOrder)
      .query(`
        INSERT INTO Virtual.Apartados (SemanaID, Nombre, TipoApartado, Orden, Fijado)
        OUTPUT INSERTED.ApartadoID AS newApartadoId
        VALUES (@semanaId,  @nombre, @tipoApartado, @orden, 0);
      `);

    const newApartadoId: number = ins.recordset[0].newApartadoId;
    await tx.commit();
    return { newApartadoId };
  } catch (e) {
    await tx.rollback();
    console.error('Error al crear apartado:', e);
    throw new Error('Error de base de datos al crear el apartado.');
  }
};

// OBTENER apartados de una asignatura
export const findApartadosByAsignatura = async (codigoAsignatura: number) => {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('codigoAsignatura', sql.SmallInt, codigoAsignatura)
        .query(`
            SELECT ApartadoID as id, Nombre as title, Fijado as isPinned 
            FROM Virtual.Apartados 
            WHERE CodigoAsignatura = @codigoAsignatura
            ORDER BY Orden
        `);
    return result.recordset;
};

// ACTUALIZAR nombre de un apartado
export const updateApartadoName = async (apartadoId: number, newName: string) => {
    const pool = await sql.connect(dbConfig);
    await pool.request()
        .input('apartadoId', sql.Int, apartadoId)
        .input('newName', sql.NVarChar(255), newName)
        .query('UPDATE Virtual.Apartados SET Nombre = @newName WHERE ApartadoID = @apartadoId');
};

// BORRAR un apartado
export const deleteApartadoById = async (apartadoId: number) => {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        
        // Nota importante: Primero borramos los 'hijos' (recursos) para evitar errores.
        await transaction.request()
            .input('apartadoId', sql.Int, apartadoId)
            .query('DELETE FROM Virtual.Recursos WHERE ApartadoID = @apartadoId');
            
        // Ahora borramos el 'padre' (el apartado)
        await transaction.request()
            .input('apartadoId', sql.Int, apartadoId)
            .query('DELETE FROM Virtual.Apartados WHERE ApartadoID = @apartadoId');
            
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        console.error('Error al borrar el apartado y sus recursos:', error);
        throw new Error('Error de base de datos al borrar el apartado.');
    }
};

// FIJAR/DESFIJAR un apartado
export const toggleApartadoPin = async (apartadoId: number) => {
    const pool = await sql.connect(dbConfig);
    await pool.request()
        .input('apartadoId', sql.Int, apartadoId)
        .query('UPDATE Virtual.Apartados SET Fijado = CASE WHEN Fijado = 1 THEN 0 ELSE 1 END WHERE ApartadoID = @apartadoId');
};

// CLONAR un apartado
export const cloneApartadoById = async (apartadoId: number) => {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // 1. Obtenemos los datos del apartado original
        const originalResult = await transaction.request()
            .input('apartadoId', sql.Int, apartadoId)
            .query('SELECT SemanaID, Nombre, TipoApartado FROM Virtual.Apartados WHERE ApartadoID = @apartadoId');

        if (originalResult.recordset.length === 0) {
            throw new Error('El apartado que intentas clonar no existe.');
        }
        const original = originalResult.recordset[0];

        // 2. Encontramos el orden más alto en esa semana para poner la copia al final
        const maxOrderResult = await transaction.request()
            .input('semanaId', sql.Int, original.SemanaID)
            .query('SELECT MAX(Orden) as maxOrden FROM Virtual.Apartados WHERE SemanaID = @semanaId');
        
        const newOrder = (maxOrderResult.recordset[0].maxOrden || 0) + 1;

        // 3. Insertamos la copia en la base de datos
        await transaction.request()
            .input('semanaId', sql.Int, original.SemanaID)
            .input('nombre', sql.NVarChar(255), `${original.Nombre} (Copia)`)
            .input('tipoApartado', sql.NVarChar(100), original.TipoApartado)
            .input('orden', sql.Int, newOrder)
            .query(`
                INSERT INTO Virtual.Apartados (SemanaID, Nombre, TipoApartado, Orden, Fijado)
                VALUES (@semanaId, @nombre, @tipoApartado, @orden, 0)
            `);
            
        await transaction.commit();
        // Nota: Esta versión simple clona el apartado. Una versión más avanzada
        // también podría clonar todos los recursos que contiene.

    } catch (error) {
        await transaction.rollback();
        console.error('Error al clonar el apartado:', error);
        throw new Error('Error de base de datos al clonar el apartado.');
    }
};
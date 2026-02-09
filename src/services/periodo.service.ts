// src/services/periodo.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool';

export const findAllPeriods = async () => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT 
          Número as numero, 
          Descripción as descripcion,
          CAST(1 as bit) as activo,       
          GETDATE() as fechaInicial,      
          DATEADD(year, 1, GETDATE()) as fechaFinal 
        FROM dbo.Períodos
        WHERE Descripción != 'Final'
        ORDER BY Número
      `);
    return result.recordset;
  } catch (error) {
    console.error('Error al obtener los períodos desde la base de datos:', error);
    throw new Error('Error de base de datos al obtener períodos.');
  }
};
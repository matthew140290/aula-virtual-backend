// src/config/dbPool.ts
import sql from 'mssql';
import { dbConfig } from './database';

// Creamos el pool de conexiones usando tu configuración.
// ConnectionPool se encargará de gestionar las conexiones de forma eficiente.
const pool = new sql.ConnectionPool(dbConfig);

// Exportamos una promesa que se resuelve cuando el pool se conecta exitosamente.
// El 'await pool.connect()' solo se ejecuta UNA VEZ en toda la vida de la aplicación.
export const poolPromise = pool.connect()
  .then(p => {
    console.log('🚀 Conectado exitosamente al Pool de SQL Server.');
    return p;
  })
  .catch(err => {
    console.error('❌ Error al conectar con el Pool de SQL Server:', err);
    throw err;
  });



 


// src/services/auth.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool'; // Crearemos este archivo ahora

// Interfaz para definir la estructura de un usuario de nuestra BD
export interface User {
  Codigo: number;
  CodigoLog: number;
  Nombre: string;
  NombreCompleto: string;
  Contrasena: string; 
  Perfil: string;
  NumeroDocumento?: number;
}

export const findUserByName = async (nombre: string): Promise<User[]> => {
    
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .query('SELECT Código, Nombre, NombreCompleto, Contraseña, Perfil FROM dbo.Usuarios WHERE Nombre = @nombre');

    if (result.recordset.length === 0) {
      return [];
    }

    
    
    const users: User[] = result.recordset.map(dbUser => ({
        Codigo: dbUser.Código,
        CodigoLog: dbUser.Código,
        Nombre: dbUser.Nombre,
        NombreCompleto: dbUser.NombreCompleto,
        Contrasena: dbUser.Contraseña,
        Perfil: dbUser.Perfil
    }));

    return users;
  } catch (error) {
    console.error('Error al buscar usuario en la base de datos:', error);
    throw new Error('Error al acceder a la base de datos.');
  }
};

export const findUserById = async (codigo: number): Promise<User | null> => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('codigo', sql.SmallInt, codigo)
            .query('SELECT Código, Nombre, NombreCompleto, Contraseña, Perfil FROM dbo.Usuarios WHERE Código = @codigo');

        if (result.recordset.length === 0) {
            return null;
        }
        
        const dbUser = result.recordset[0];
        const user: User = {
            Codigo: dbUser.Código,
            CodigoLog: dbUser.Código,
            Nombre: dbUser.Nombre,
            NombreCompleto: dbUser.NombreCompleto,
            Contrasena: dbUser.Contraseña,
            Perfil: dbUser.Perfil
        };

        return user;
    } catch (error) {
        console.error('Error al buscar usuario por ID:', error);
        throw new Error('Error al acceder a la base de datos.');
    }
};

export const findStudentForLogin = async (nombre: string, matricula: string): Promise<User | null> => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            // 💡 1. El parámetro 'nombre' ahora se usa para buscar en la columna 'PrimerNombre'.
            .input('primerNombre', sql.NVarChar(96), nombre) 
            .input('matriculaNo', sql.Int, Number(matricula))
            // 💡 2. La consulta SQL ahora busca por 'PrimerNombre' en lugar del nombre completo.
            .query(`
                SELECT 
                    E.[MatrículaNo],
                    LTRIM(RTRIM(CONCAT(PrimerApellido, ' ', SegundoApellido, ' ', PrimerNombre, ' ', SegundoNombre))) AS NombreCompleto,
                    E.PrimerNombre AS Nombre,
                    U.Perfil,
                    E.NúmeroDocumento,
                    U.Código AS CodigoUsuarioReal
                FROM dbo.Estudiantes E
                LEFT JOIN dbo.Usuarios U ON (E.[MatrículaNo] = U.Código OR E.[MatrículaNo] = (U.Código * -1))
                WHERE E.PrimerNombre = @primerNombre
                  AND (
                      E.[MatrículaNo] = @matriculaNo 
                      OR 
                      E.[MatrículaNo] = (@matriculaNo * -1)
                  )
                  AND (E.Estado IS NULL OR E.Estado != 'Retirado');
            `);

        if (result.recordset.length === 0) {
            return null; // No se encontró al estudiante
        }

        const dbStudent = result.recordset[0];

        const perfil = dbStudent.Perfil || 'Estudiante';

        const codigoLog = dbStudent.CodigoUsuarioReal ? dbStudent.CodigoUsuarioReal : 0;

        const studentUser: User = {
            Codigo: dbStudent.MatrículaNo,
            CodigoLog: codigoLog,
            Nombre: dbStudent.Nombre,
            NombreCompleto: dbStudent.NombreCompleto,
            Perfil: perfil,
            Contrasena: '',
            NumeroDocumento: dbStudent.NúmeroDocumento
        };

        return studentUser;

    } catch (error) {
        console.error('Error al buscar estudiante en la base de datos:', error);
        throw new Error('Error al acceder a la base de datos.');
    }
};
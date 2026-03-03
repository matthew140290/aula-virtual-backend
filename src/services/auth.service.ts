// src/services/auth.service.ts
import sql from 'mssql';
import { poolPromise } from '../config/dbPool'; // Crearemos este archivo ahora
import jwt from 'jsonwebtoken';
import { DecodedUserToken } from '../middleware/auth.middleware';
import { registrarAccion } from './log.service';

const JWT_SECRET = process.env.JWT_SECRET!;

// Interfaz para definir la estructura de un usuario de nuestra BD
export interface AuthUser {
    Codigo: number;
    CodigoLog: number;
    Nombre: string;
    NombreCompleto: string;
    Contrasena: string; 
    Perfil: string;
    NumeroDocumento?: number;
}

export interface AuthResponse {
    token: string;
    user: DecodedUserToken;
}

interface DbUserRow {
    Codigo: number;
    Nombre: string;
    NombreCompleto: string;
    Contrasena: string;
    Perfil: string;
}

interface DbUserByIdRow {
    Código: number;
    Nombre: string;
    NombreCompleto: string;
    Contraseña: string;
    Perfil: string;
}

interface DbStudentRow {
    Codigo: number;
    NombreCompleto: string;
    Nombre: string;
    Perfil: string;
    NumeroDocumento: number;
    CodigoLog: number;
}

const stringToHex = (str: string): string => Buffer.from(str, 'utf8').toString('hex').toUpperCase();
const hexToString = (hex: string): string => Buffer.from(hex, 'hex').toString('utf8');

export const processLogin = async (nombre: string, contrasena: string): Promise<AuthResponse> => {
    const pool = await poolPromise;
    const hexNombre = stringToHex(nombre);

    // 1. Buscar como Docente/Administrativo/Director
    const resultUser = await pool.request()
        .input('nombre', sql.NVarChar, hexNombre)
        .query<AuthUser>('SELECT Código as Codigo, Nombre, NombreCompleto, Contraseña as Contrasena, Perfil FROM dbo.Usuarios WHERE Nombre = @nombre');

    const validUser = resultUser.recordset.find(u => hexToString(u.Contrasena).trim() === contrasena);

    if (validUser) {
        const tokenPayload: DecodedUserToken = {
            codigo: validUser.Codigo,
            nombre: hexToString(validUser.Nombre),
            nombreCompleto: validUser.NombreCompleto,
            perfil: validUser.Perfil
        };

        // Fire and forget logging
        registrarAccion(validUser.Codigo, validUser.Perfil, 'Sistema Aula', 'Login', 'Inicio exitoso Docente/Admin').catch(console.error);
        
        return {
            token: jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' }),
            user: tokenPayload
        };
    }

    // 2. Buscar como Estudiante si falla lo anterior
    const resultStudent = await pool.request()
        .input('primerNombre', sql.NVarChar(96), nombre)
        .input('matriculaNo', sql.Int, Number(contrasena))
        .query(`
            SELECT 
                E.[MatrículaNo] as Codigo,
                LTRIM(RTRIM(CONCAT(PrimerApellido, ' ', SegundoApellido, ' ', PrimerNombre, ' ', SegundoNombre))) AS NombreCompleto,
                E.PrimerNombre AS Nombre,
                ISNULL(U.Perfil, 'Estudiante') as Perfil,
                E.NúmeroDocumento as NumeroDocumento,
                ISNULL(U.Código, 0) AS CodigoLog
            FROM dbo.Estudiantes E
            LEFT JOIN dbo.Usuarios U ON (E.[MatrículaNo] = U.Código OR E.[MatrículaNo] = (U.Código * -1))
            WHERE E.PrimerNombre = @primerNombre
                AND (E.[MatrículaNo] = @matriculaNo OR E.[MatrículaNo] = (@matriculaNo * -1))
                AND (E.Estado IS NULL OR E.Estado != 'Retirado');
        `);

    if (resultStudent.recordset.length > 0) {
        const student = resultStudent.recordset[0];
        const tokenPayload: DecodedUserToken = {
            codigo: student.Codigo,
            nombre: student.Nombre,
            nombreCompleto: student.NombreCompleto,
            perfil: student.Perfil
        };

        registrarAccion(student.CodigoLog, student.Perfil, 'Sistema Aula', 'Login', 'Inicio exitoso Estudiante').catch(console.error);

        return {
            token: jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' }),
            user: tokenPayload
        };
    }

    registrarAccion(0, 'Desconocido', 'Sistema Aula', 'Login', `Fallo login: ${nombre}`).catch(() => {});
    throw new Error('CredencialesIncorrectas');
};

export const findUserById = async (codigo: number): Promise<AuthUser | null> => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('codigo', sql.SmallInt, codigo)
            .query('SELECT Código, Nombre, NombreCompleto, Contraseña, Perfil FROM dbo.Usuarios WHERE Código = @codigo');

        if (result.recordset.length === 0) {
            return null;
        }
        
        const dbUser = result.recordset[0];
        const user: AuthUser = {
            Codigo: dbUser.Código,
            CodigoLog: dbUser.Código,
            Nombre: dbUser.Nombre,
            NombreCompleto: dbUser.NombreCompleto,
            Contrasena: dbUser.Contraseña,
            Perfil: dbUser.Perfil
        };

        return user;
    } catch (error: unknown) {
        console.error('Error al buscar usuario por ID:', error instanceof Error ? error.message : error);
        throw new Error('Error al acceder a la base de datos.');
    }
};

export const findStudentForLogin = async (nombre: string, matricula: string): Promise<AuthUser | null> => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            // 💡 1. El parámetro 'nombre' ahora se usa para buscar en la columna 'PrimerNombre'.
            .input('primerNombre', sql.NVarChar(96), nombre) 
            .input('matriculaNo', sql.Int, Number(matricula))
            // 💡 2. La consulta SQL ahora busca por 'PrimerNombre' en lugar del nombre completo.
            .query<DbStudentRow>(`
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

        const studentUser: AuthUser = {
            Codigo: dbStudent.Codigo,
            CodigoLog: dbStudent.CodigoLog,
            Nombre: dbStudent.Nombre,
            NombreCompleto: dbStudent.NombreCompleto,
            Perfil: dbStudent.Perfil,
            Contrasena: '',
            NumeroDocumento: dbStudent.NumeroDocumento
        };

        return studentUser;

    } catch (error: unknown) {
        console.error('Error al buscar estudiante en la base de datos:', error instanceof Error ? error.message : error);
        throw new Error('Error al acceder a la base de datos.');
    }
};
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findStudentForLogin = exports.findUserById = exports.processLogin = void 0;
// src/services/auth.service.ts
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool"); // Crearemos este archivo ahora
const log_service_1 = require("./log.service");
const tenantContext_1 = require("../config/tenantContext");
const authToken_1 = require("../config/authToken");
const stringToHex = (str) => Buffer.from(str, 'utf8').toString('hex').toUpperCase();
const hexToString = (hex) => Buffer.from(hex, 'hex').toString('utf8');
const processLogin = async (nombre, contrasena) => {
    const pool = await dbPool_1.poolPromise;
    const hexNombre = stringToHex(nombre);
    // 1. Buscar como Docente/Administrativo/Director
    const resultUser = await pool.request()
        .input('nombre', mssql_1.default.NVarChar, hexNombre)
        .query('SELECT Código as Codigo, Nombre, NombreCompleto, Contraseña as Contrasena, Perfil FROM dbo.Usuarios WHERE Nombre = @nombre');
    const validUser = resultUser.recordset.find(u => hexToString(u.Contrasena).trim() === contrasena);
    if (validUser) {
        const tokenPayload = {
            codigo: validUser.Codigo,
            nombre: hexToString(validUser.Nombre),
            nombreCompleto: validUser.NombreCompleto,
            perfil: validUser.Perfil,
            tenantId: (0, tenantContext_1.getTenantId)(),
        };
        // Fire and forget logging
        (0, log_service_1.registrarAccion)(validUser.Codigo, validUser.Perfil, 'Sistema Aula', 'Login', 'Inicio exitoso Docente/Admin').catch(console.error);
        return {
            token: (0, authToken_1.signUserToken)(tokenPayload, '8h'),
            user: tokenPayload
        };
    }
    // 2. Buscar como Estudiante si falla lo anterior
    const resultStudent = await pool.request()
        .input('primerNombre', mssql_1.default.NVarChar(96), nombre)
        .input('matriculaNo', mssql_1.default.Int, Number(contrasena))
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
        const tokenPayload = {
            codigo: student.Codigo,
            nombre: student.Nombre,
            nombreCompleto: student.NombreCompleto,
            perfil: student.Perfil,
            tenantId: (0, tenantContext_1.getTenantId)(),
        };
        (0, log_service_1.registrarAccion)(student.CodigoLog, student.Perfil, 'Sistema Aula', 'Login', 'Inicio exitoso Estudiante').catch(console.error);
        return {
            token: (0, authToken_1.signUserToken)(tokenPayload, '8h'),
            user: tokenPayload
        };
    }
    (0, log_service_1.registrarAccion)(0, 'Desconocido', 'Sistema Aula', 'Login', `Fallo login: ${nombre}`).catch(() => { });
    throw new Error('CredencialesIncorrectas');
};
exports.processLogin = processLogin;
const findUserById = async (codigo) => {
    try {
        const pool = await dbPool_1.poolPromise;
        const result = await pool.request()
            .input('codigo', mssql_1.default.SmallInt, codigo)
            .query('SELECT Código, Nombre, NombreCompleto, Contraseña, Perfil FROM dbo.Usuarios WHERE Código = @codigo');
        if (result.recordset.length === 0) {
            return null;
        }
        const dbUser = result.recordset[0];
        const user = {
            Codigo: dbUser.Código,
            CodigoLog: dbUser.Código,
            Nombre: dbUser.Nombre,
            NombreCompleto: dbUser.NombreCompleto,
            Contrasena: dbUser.Contraseña,
            Perfil: dbUser.Perfil
        };
        return user;
    }
    catch (error) {
        console.error('Error al buscar usuario por ID:', error instanceof Error ? error.message : error);
        throw new Error('Error al acceder a la base de datos.');
    }
};
exports.findUserById = findUserById;
const findStudentForLogin = async (nombre, matricula) => {
    try {
        const pool = await dbPool_1.poolPromise;
        const result = await pool.request()
            // 💡 1. El parámetro 'nombre' ahora se usa para buscar en la columna 'PrimerNombre'.
            .input('primerNombre', mssql_1.default.NVarChar(96), nombre)
            .input('matriculaNo', mssql_1.default.Int, Number(matricula))
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
        const studentUser = {
            Codigo: dbStudent.Codigo,
            CodigoLog: dbStudent.CodigoLog,
            Nombre: dbStudent.Nombre,
            NombreCompleto: dbStudent.NombreCompleto,
            Perfil: dbStudent.Perfil,
            Contrasena: '',
            NumeroDocumento: dbStudent.NumeroDocumento
        };
        return studentUser;
    }
    catch (error) {
        console.error('Error al buscar estudiante en la base de datos:', error instanceof Error ? error.message : error);
        throw new Error('Error al acceder a la base de datos.');
    }
};
exports.findStudentForLogin = findStudentForLogin;

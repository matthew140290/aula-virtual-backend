"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserPhotoById = exports.updateUserPhoto = exports.findUserById = void 0;
//src/service/usuario.service
const mssql_1 = __importDefault(require("mssql"));
const dbPool_1 = require("../config/dbPool");
// Obtiene todos los datos de un usuario por su código
const findUserById = async (codigo, perfil) => {
    const perfilNorm = perfil ? perfil.toLowerCase().trim() : '';
    const codigoBusqueda = Math.abs(codigo);
    console.log(`🔍 [SERVICE PERFIL] Inicio análisis...`);
    console.log(`   - Input Original: ID=${codigo}, Perfil='${perfil}'`);
    console.log(`   - Input Normalizado: ID=${codigoBusqueda}, Perfil='${perfilNorm}'`);
    const pool = await dbPool_1.poolPromise;
    let query;
    let idType;
    if (perfilNorm === 'estudiante') {
        // Si es estudiante, buscamos en la tabla Estudiantes.
        query = `
            SELECT 
                LTRIM(RTRIM(CONCAT(PrimerApellido, ' ', SegundoApellido, ' ', PrimerNombre, ' ', SegundoNombre))) AS NombreCompleto,
                PrimerNombre AS Nombre,
                'Estudiante' as Perfil,
                TipoDocumento,
                NúmeroDocumento,
                MunicipioExpedición,
                DirecciónResidencia,
                Teléfono,
                CorreoElectrónico,
                Género,
                FechaNacimiento,
                MunicipioNacimiento,
                TipoSangre
            FROM dbo.Estudiantes
            WHERE MatrículaNo = @codigo;
        `;
        idType = mssql_1.default.Int();
    }
    else if (perfilNorm.includes('docente') || perfilNorm.includes('director')) {
        // Si es docente, buscamos en la tabla Docentes.
        query = `
            SELECT 
                u.NombreCompleto, u.Nombre, u.Perfil,
                d.TipoDocumento, d.NúmeroDocumento, d.CorreoElectrónico,
                d.Teléfono, d.DirecciónResidencia, d.TipoVinculación, d.Escalafón,
                d.FechaNacimiento, d.MunicipioNacimiento, d.EstadoCivil, d.TipoSangre,
                d.MunicipioExpedición, d.Género, d.TipoNombramiento, d.FechaVinculación,
                d.FechaPosesión, d.ActoAdministrativo, d.ActaPosesión, d.Estado
            FROM dbo.Usuarios as u
            LEFT JOIN dbo.Docentes as d ON u.Código = d.Código
            WHERE u.Código = @codigo;
        `;
        idType = mssql_1.default.SmallInt();
    }
    else {
        query = `
            SELECT NombreCompleto, Nombre, Perfil 
            FROM dbo.Usuarios 
            WHERE Código = @codigo;
        `;
        idType = mssql_1.default.SmallInt();
    }
    console.log(`--- Servicio findUserById: Usando tipo de ID: ${idType.constructor.name}`);
    console.log('--- Servicio findUserById: Ejecutando la siguiente consulta ---');
    console.log(query);
    const result = await pool.request()
        // 💡 2. Usamos el tipo de dato SQL determinado por el perfil.
        .input('codigo', idType, codigoBusqueda)
        .query(query);
    return result.recordset[0];
};
exports.findUserById = findUserById;
// Actualiza o inserta la foto de perfil (lógica de "UPSERT")
const updateUserPhoto = async (codigo, perfil, photoBuffer) => {
    const pool = await dbPool_1.poolPromise;
    const codigoBusqueda = Math.abs(codigo);
    const esDocente = perfil.includes('Docente') || perfil.includes('Director');
    const photoTable = esDocente ? 'dbo.FotografíasDocentes' : 'dbo.FotografíasEstudiantes';
    const idColumn = esDocente ? 'CódigoDocente' : 'MatrículaNo';
    const idType = esDocente ? mssql_1.default.SmallInt() : mssql_1.default.Int();
    await pool.request()
        .input('id', idType, codigoBusqueda)
        .input('imagen', mssql_1.default.VarBinary, photoBuffer)
        .query(`
            MERGE INTO ${photoTable} AS T
            USING (SELECT @id AS id) AS S
            ON T.${idColumn} = S.id
            WHEN MATCHED THEN
                UPDATE SET Imagen = @imagen
            WHEN NOT MATCHED THEN
                INSERT (${idColumn}, Imagen) VALUES (@id, @imagen);
        `);
};
exports.updateUserPhoto = updateUserPhoto;
const findUserPhotoById = async (codigo, perfil) => {
    const pool = await dbPool_1.poolPromise;
    const codigoBusqueda = Math.abs(codigo);
    const esDocente = perfil.includes('Docente') || perfil.includes('Director');
    const photoTable = esDocente ? 'dbo.FotografíasDocentes' : 'dbo.FotografíasEstudiantes';
    const idColumn = esDocente ? 'CódigoDocente' : 'MatrículaNo';
    const idType = esDocente ? mssql_1.default.SmallInt() : mssql_1.default.Int();
    const result = await pool.request()
        .input('id', idType, codigoBusqueda)
        .query(`SELECT Imagen FROM ${photoTable} WHERE ${idColumn} = @id`);
    if (result.recordset.length > 0) {
        return result.recordset[0].Imagen;
    }
    return null;
};
exports.findUserPhotoById = findUserPhotoById;

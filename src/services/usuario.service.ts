//src/service/usuario.service
import sql from 'mssql';
import { dbConfig } from '../config/database';

// Obtiene todos los datos de un usuario por su código
export const findUserById = async (codigo: number, perfil: string) => {
    const perfilNorm = perfil ? perfil.toLowerCase().trim() : '';
    const codigoBusqueda = Math.abs(codigo);

    console.log(`🔍 [SERVICE PERFIL] Inicio análisis...`);
    console.log(`   - Input Original: ID=${codigo}, Perfil='${perfil}'`);
    console.log(`   - Input Normalizado: ID=${codigoBusqueda}, Perfil='${perfilNorm}'`);

    
    const pool = await sql.connect(dbConfig);
    let query: string;
    let idType: sql.ISqlType;
    

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
        idType = sql.Int();
    } else if (perfilNorm.includes('docente') || perfilNorm.includes('director')) {
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
        idType = sql.SmallInt();
    } else {
        query = `
            SELECT NombreCompleto, Nombre, Perfil 
            FROM dbo.Usuarios 
            WHERE Código = @codigo;
        `;
        idType = sql.SmallInt();
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

// Actualiza o inserta la foto de perfil (lógica de "UPSERT")
export const updateUserPhoto = async (codigo: number, perfil: string, photoBuffer: Buffer) => {
    const pool = await sql.connect(dbConfig);
    const codigoBusqueda = Math.abs(codigo);
    
    const esDocente = perfil.includes('Docente') || perfil.includes('Director');
    const photoTable = esDocente ? 'dbo.FotografíasDocentes' : 'dbo.FotografíasEstudiantes';
    const idColumn = esDocente ? 'CódigoDocente' : 'MatrículaNo';
    const idType = esDocente ? sql.SmallInt() : sql.Int();

    await pool.request()
        .input('id', idType, codigoBusqueda)
        .input('imagen', sql.VarBinary, photoBuffer)
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

export const findUserPhotoById = async (codigo: number, perfil: string) => {
    const pool = await sql.connect(dbConfig);
    const codigoBusqueda = Math.abs(codigo);
    const esDocente = perfil.includes('Docente') || perfil.includes('Director');
    const photoTable = esDocente ? 'dbo.FotografíasDocentes' : 'dbo.FotografíasEstudiantes';
    const idColumn = esDocente ? 'CódigoDocente' : 'MatrículaNo';
    const idType = esDocente ? sql.SmallInt() : sql.Int();

    const result = await pool.request()
        .input('id', idType, codigoBusqueda)
        .query(`SELECT Imagen FROM ${photoTable} WHERE ${idColumn} = @id`);

    if (result.recordset.length > 0) {
        return result.recordset[0].Imagen; 
    }
    return null;
};
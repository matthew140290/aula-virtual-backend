import { poolPromise } from '../config/dbPool';

let schemaEnsured = false;

export const ensureIcfesSchema = async () => {
  if (schemaEnsured) return;

  const pool = await poolPromise;
  await pool.request().query(`
    IF OBJECT_ID('Virtual.ICFES_ExamenesGlobales', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_ExamenesGlobales (
        ExamenGlobalID INT IDENTITY(1,1) PRIMARY KEY,
        Titulo NVARCHAR(255) NOT NULL,
        Descripcion NVARCHAR(MAX) NULL,
        Periodicidad NVARCHAR(20) NOT NULL,
        Trimestre TINYINT NULL,
        Anio SMALLINT NOT NULL,
        DuracionMinutos SMALLINT NOT NULL,
        NumeroIntentos SMALLINT NOT NULL,
        FechaInicio DATETIME NOT NULL,
        FechaCierre DATETIME NOT NULL,
        Estado NVARCHAR(20) NOT NULL DEFAULT 'Borrador',
        Publicado BIT NOT NULL DEFAULT 0,
        CreadoPorCodigo INT NOT NULL,
        CreadoPorPerfil NVARCHAR(100) NOT NULL,
        FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        FechaActualizacion DATETIME NULL
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_CompetenciasExamen', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_CompetenciasExamen (
        CompetenciaID INT IDENTITY(1,1) PRIMARY KEY,
        ExamenGlobalID INT NOT NULL,
        NombreCompetencia NVARCHAR(100) NOT NULL,
        Peso DECIMAL(5,2) NOT NULL,
        CONSTRAINT FK_ICFES_Competencias_Examen
          FOREIGN KEY (ExamenGlobalID)
          REFERENCES Virtual.ICFES_ExamenesGlobales(ExamenGlobalID)
          ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_Preguntas', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_Preguntas (
        PreguntaGlobalID INT IDENTITY(1,1) PRIMARY KEY,
        ExamenGlobalID INT NOT NULL,
        CompetenciaID INT NULL,
        TextoPregunta NVARCHAR(MAX) NOT NULL,
        Peso DECIMAL(5,2) NOT NULL,
        ExplicacionRespuesta NVARCHAR(MAX) NULL,
        TipoPregunta NVARCHAR(50) NOT NULL DEFAULT 'SeleccionUnica',
        Fuente NVARCHAR(20) NOT NULL DEFAULT 'IA',
        Orden INT NOT NULL,
        CONSTRAINT FK_ICFES_Preguntas_Examen
          FOREIGN KEY (ExamenGlobalID)
          REFERENCES Virtual.ICFES_ExamenesGlobales(ExamenGlobalID)
          ON DELETE CASCADE,
        CONSTRAINT FK_ICFES_Preguntas_Competencia
          FOREIGN KEY (CompetenciaID)
          REFERENCES Virtual.ICFES_CompetenciasExamen(CompetenciaID)
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_OpcionesPregunta', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_OpcionesPregunta (
        OpcionID INT IDENTITY(1,1) PRIMARY KEY,
        PreguntaGlobalID INT NOT NULL,
        Letra CHAR(1) NOT NULL,
        TextoOpcion NVARCHAR(MAX) NOT NULL,
        EsCorrecta BIT NOT NULL,
        CONSTRAINT FK_ICFES_Opciones_Pregunta
          FOREIGN KEY (PreguntaGlobalID)
          REFERENCES Virtual.ICFES_Preguntas(PreguntaGlobalID)
          ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_GeneracionesIA', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_GeneracionesIA (
        GeneracionID INT IDENTITY(1,1) PRIMARY KEY,
        ExamenGlobalID INT NOT NULL,
        Tema NVARCHAR(200) NOT NULL,
        TextoBase NVARCHAR(MAX) NOT NULL,
        Dificultad NVARCHAR(20) NOT NULL,
        Cantidad INT NOT NULL,
        Modelo NVARCHAR(100) NOT NULL,
        PromptSistema NVARCHAR(MAX) NULL,
        CreadoPorCodigo INT NOT NULL,
        FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ICFES_Generaciones_Examen
          FOREIGN KEY (ExamenGlobalID)
          REFERENCES Virtual.ICFES_ExamenesGlobales(ExamenGlobalID)
          ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_IntentosGlobales', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_IntentosGlobales (
        IntentoGlobalID INT IDENTITY(1,1) PRIMARY KEY,
        ExamenGlobalID INT NOT NULL,
        MatriculaNo INT NOT NULL,
        Estado NVARCHAR(20) NOT NULL DEFAULT 'Iniciado',
        FechaInicio DATETIME NOT NULL DEFAULT GETDATE(),
        FechaEntrega DATETIME NULL,
        Calificacion DECIMAL(4,2) NULL,
        DuracionSegundos INT NULL,
        CONSTRAINT FK_ICFES_Intentos_Examen
          FOREIGN KEY (ExamenGlobalID)
          REFERENCES Virtual.ICFES_ExamenesGlobales(ExamenGlobalID)
          ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_RespuestasIntento', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_RespuestasIntento (
        RespuestaIntentoID INT IDENTITY(1,1) PRIMARY KEY,
        IntentoGlobalID INT NOT NULL,
        PreguntaGlobalID INT NOT NULL,
        OpcionIDSeleccionada INT NULL,
        EsCorrecta BIT NULL,
        PuntajeObtenido DECIMAL(5,2) NULL,
        CONSTRAINT FK_ICFES_RespIntento_Intento
          FOREIGN KEY (IntentoGlobalID)
          REFERENCES Virtual.ICFES_IntentosGlobales(IntentoGlobalID)
          ON DELETE CASCADE,
        CONSTRAINT FK_ICFES_RespIntento_Pregunta
          FOREIGN KEY (PreguntaGlobalID)
          REFERENCES Virtual.ICFES_Preguntas(PreguntaGlobalID)
      );
    END;

    IF OBJECT_ID('Virtual.ICFES_ExplicacionesIA', 'U') IS NULL
    BEGIN
      CREATE TABLE Virtual.ICFES_ExplicacionesIA (
        ExplicacionID INT IDENTITY(1,1) PRIMARY KEY,
        IntentoGlobalID INT NOT NULL,
        PreguntaGlobalID INT NOT NULL,
        Explicacion NVARCHAR(MAX) NOT NULL,
        Modelo NVARCHAR(100) NOT NULL,
        FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ICFES_Exp_Intento
          FOREIGN KEY (IntentoGlobalID)
          REFERENCES Virtual.ICFES_IntentosGlobales(IntentoGlobalID)
          ON DELETE CASCADE,
        CONSTRAINT FK_ICFES_Exp_Pregunta
          FOREIGN KEY (PreguntaGlobalID)
          REFERENCES Virtual.ICFES_Preguntas(PreguntaGlobalID)
      );
    END;
  `);

  schemaEnsured = true;
};

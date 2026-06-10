const inputMock = jest.fn();
const queryMock = jest.fn();
const requestMock = jest.fn();

jest.mock('mssql', () => ({
  __esModule: true,
  default: {
    Int: 'Int',
  },
}));

jest.mock('../config/dbPool', () => ({
  poolPromise: Promise.resolve({
    request: requestMock,
  }),
}));

import { getVistaRecursoEstudiante } from './estudiante.service';

describe('estudiante.service signed matricula handling', () => {
  beforeEach(() => {
    inputMock.mockReset();
    queryMock.mockReset();
    requestMock.mockReset();

    inputMock.mockReturnThis();
    queryMock.mockResolvedValue({
      recordset: [
        {
          RecursoID: 7,
          Titulo: 'Tarea',
          Contenido: '<p>Instrucciones</p>',
          TipoRecurso: 'tarea',
          UrlExterna: null,
          FechaVencimiento: new Date('2026-01-01T00:00:00.000Z'),
          PermiteEntregasTardias: true,
          TiposArchivoPermitidos: '.pdf',
          PuntajeMaximo: 5,
          AdjuntoID: null,
          AdjuntoNombre: null,
          AdjuntoMime: null,
          FechaEntrega: null,
          NotaTarea: null,
          ComentariosProfesor: null,
          ComentariosEstudiante: null,
          FechaCalificacion: null,
          UrlArchivoEntregado: null,
          EstadoEntregaCalculado: 'Pendiente',
        },
      ],
    });

    requestMock.mockReturnValue({
      input: inputMock,
      query: queryMock,
    });
  });

  it('normalizes negative matricula and uses ABS filters in tarea joins', async () => {
    await getVistaRecursoEstudiante(7, -456);

    expect(inputMock).toHaveBeenCalledWith('matriculaNo', 'Int', 456);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ABS(et.MatriculaNo) = @matriculaNo')
    );
  });
});

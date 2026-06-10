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

import { findEntregasByRecursoId } from './tarea.service';

describe('tarea.service signed matricula handling', () => {
  beforeEach(() => {
    inputMock.mockReset();
    queryMock.mockReset();
    requestMock.mockReset();

    inputMock.mockReturnThis();
    queryMock.mockResolvedValue({
      recordsets: [
        [
          {
            Titulo: 'Tarea de prueba',
            InstruccionesHTML: '<p>Contenido</p>',
            PuntajeMaximo: 5,
            FechaVencimiento: new Date('2026-01-01T00:00:00.000Z'),
            FechaPublicacion: new Date('2025-12-01T00:00:00.000Z'),
          },
        ],
        [],
        [],
      ],
    });

    requestMock.mockReturnValue({
      input: inputMock,
      query: queryMock,
    });
  });

  it('uses ABS join so docente can see entregas saved with signed matricula', async () => {
    await findEntregasByRecursoId(99);

    expect(inputMock).toHaveBeenCalledWith('recursoId', 'Int', 99);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ABS(e.MatrículaNo) = ABS(et.MatriculaNo)')
    );
  });
});

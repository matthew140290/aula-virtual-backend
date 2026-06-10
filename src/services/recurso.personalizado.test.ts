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

jest.mock('./log.service', () => ({
  registrarAccion: jest.fn(),
}));

jest.mock('./notificacion.service', () => ({}));

import { estudiantePuedeAccederRecurso } from './recurso.service';

describe('recurso.service personalized audience access', () => {
  beforeEach(() => {
    inputMock.mockReset();
    queryMock.mockReset();
    requestMock.mockReset();

    inputMock.mockReturnThis();
    requestMock.mockReturnValue({
      input: inputMock,
      query: queryMock,
    });
  });

  it('allows access to non-personalized resources', async () => {
    queryMock.mockResolvedValue({
      recordset: [{ recursoExiste: 1, esPersonalizado: 0, permitido: 0 }],
    });

    await expect(estudiantePuedeAccederRecurso(10, 123)).resolves.toBe(true);
  });

  it('allows access to selected students for personalized resources', async () => {
    queryMock.mockResolvedValue({
      recordset: [{ recursoExiste: 1, esPersonalizado: 1, permitido: 1 }],
    });

    await expect(estudiantePuedeAccederRecurso(10, -123)).resolves.toBe(true);

    expect(inputMock).toHaveBeenCalledWith('matriculaNo', 'Int', 123);
  });

  it('denies access to non-selected students for personalized resources', async () => {
    queryMock.mockResolvedValue({
      recordset: [{ recursoExiste: 1, esPersonalizado: 1, permitido: 0 }],
    });

    await expect(estudiantePuedeAccederRecurso(10, 999)).resolves.toBe(false);
  });

  it('denies access for invalid identifiers', async () => {
    await expect(estudiantePuedeAccederRecurso(Number.NaN, 123)).resolves.toBe(false);

    expect(requestMock).not.toHaveBeenCalled();
  });
});

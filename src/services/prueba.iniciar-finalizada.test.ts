const queryMock = jest.fn();
const inputMock = jest.fn();
const beginMock = jest.fn();
const commitMock = jest.fn();
const rollbackMock = jest.fn();

const transactionInstance = {
  begin: beginMock,
  commit: commitMock,
  rollback: rollbackMock,
};

const poolRequestMock = jest.fn();
const transactionCtorMock = jest.fn();
const sqlRequestCtorMock = jest.fn();

jest.mock('mssql', () => ({
  __esModule: true,
  default: {
    Int: 'Int',
    SmallInt: 'SmallInt',
    DateTime: 'DateTime',
    Bit: 'Bit',
    NVarChar: 'NVarChar',
    MAX: 'MAX',
    Transaction: transactionCtorMock,
    Request: sqlRequestCtorMock,
  },
}));

jest.mock('../config/dbPool', () => ({
  poolPromise: Promise.resolve({
    request: poolRequestMock,
  }),
}));

import { iniciarPrueba } from './prueba.service';

describe('prueba.service iniciarPrueba with finalizada flag', () => {
  beforeEach(() => {
    queryMock.mockReset();
    inputMock.mockReset();
    beginMock.mockReset();
    commitMock.mockReset();
    rollbackMock.mockReset();
    poolRequestMock.mockReset();
    transactionCtorMock.mockReset();
    sqlRequestCtorMock.mockReset();

    inputMock.mockReturnThis();
    beginMock.mockResolvedValue(undefined);
    commitMock.mockResolvedValue(undefined);
    rollbackMock.mockResolvedValue(undefined);

    transactionCtorMock.mockReturnValue(transactionInstance);
    poolRequestMock.mockReturnValue({ input: inputMock, query: queryMock });
    sqlRequestCtorMock.mockReturnValue({ input: inputMock, query: queryMock });

    queryMock.mockImplementation(async (sqlText: string) => {
      if (sqlText.includes("COL_LENGTH('Virtual.PruebasResultados', 'UltimoHeartbeat')")) {
        return { recordset: [] };
      }

      if (sqlText.includes('UPDATE r') && sqlText.includes('AbandonadoPorInactividad')) {
        return { recordset: [] };
      }

      if (
        sqlText.includes('FROM Virtual.Pruebas\n') &&
        sqlText.includes('WHERE PruebaID = @pruebaId')
      ) {
        return {
          recordset: [
            {
              PruebaID: 1,
              RecursoID: 88,
              NumeroIntentos: 1,
              FechaInicio: new Date('2026-01-01T00:00:00.000Z'),
              FechaCierre: new Date('2027-01-01T00:00:00.000Z'),
              Publicado: true,
              Finalizada: true,
              Contrasena: null,
            },
          ],
        };
      }

      if (sqlText.includes('AS EsPersonalizado') && sqlText.includes('AS Permitido')) {
        return { recordset: [{ EsPersonalizado: 0, Permitido: 1 }] };
      }

      if (sqlText.includes("AND Estado = 'Iniciado'")) {
        return { recordset: [] };
      }

      if (sqlText.includes('SELECT COUNT(*) as count')) {
        return { recordset: [{ count: 0 }] };
      }

      if (sqlText.includes('INSERT INTO Virtual.PruebasResultados')) {
        return { recordset: [{ ResultadoID: 1234 }] };
      }

      return { recordset: [] };
    });
  });

  it('allows students to start while finalizada=true if published and in window', async () => {
    const data = await iniciarPrueba(1, 9001);

    expect(data).toEqual({ resultadoId: 1234, retomado: false });
    expect(beginMock).toHaveBeenCalledTimes(1);
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(rollbackMock).not.toHaveBeenCalled();
  });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inputMock = jest.fn();
const queryMock = jest.fn();
const requestMock = jest.fn();
jest.mock('mssql', () => ({
    __esModule: true,
    default: {
        Int: 'Int',
        SmallInt: 'SmallInt',
    },
}));
jest.mock('../config/dbPool', () => ({
    poolPromise: Promise.resolve({
        request: requestMock,
    }),
}));
const prueba_service_1 = require("./prueba.service");
describe('prueba.service personalized audience', () => {
    beforeEach(() => {
        inputMock.mockReset();
        queryMock.mockReset();
        requestMock.mockReset();
        inputMock.mockReturnThis();
        queryMock
            .mockResolvedValueOnce({ recordset: [{ CodigoAsignatura: 77 }] })
            .mockResolvedValueOnce({ recordset: [] });
        requestMock.mockReturnValue({
            input: inputMock,
            query: queryMock,
        });
    });
    it('limits available students to the personalized resource audience', async () => {
        await (0, prueba_service_1.getEstudiantesParaPrueba)(12);
        const studentQuery = queryMock.mock.calls[1][0];
        expect(studentQuery).toContain('Virtual.RecursosEstudiantes');
        expect(studentQuery).toContain('NOT EXISTS');
        expect(studentQuery).toContain('re.RecursoID IS NOT NULL');
        expect(studentQuery).toContain('ABS(re.MatriculaNo)');
    });
});

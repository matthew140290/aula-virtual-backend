"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const tarea_service_1 = require("./tarea.service");
describe('tarea.service personalized audience', () => {
    beforeEach(() => {
        inputMock.mockReset();
        queryMock.mockReset();
        requestMock.mockReset();
        inputMock.mockReturnThis();
        queryMock.mockResolvedValue({
            recordsets: [
                [
                    {
                        Titulo: 'Tarea personalizada',
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
    it('limits the grading list to selected students for personalized resources', async () => {
        await (0, tarea_service_1.findEntregasByRecursoId)(99);
        const query = queryMock.mock.calls[0][0];
        expect(query).toContain('Virtual.RecursosEstudiantes');
        expect(query).toContain('NOT EXISTS');
        expect(query).toContain('ABS(re.MatriculaNo)');
    });
});

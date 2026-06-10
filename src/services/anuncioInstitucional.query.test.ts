jest.mock('../config/dbPool', () => ({
    poolPromise: Promise.resolve({
        request: jest.fn(),
    }),
}));

jest.mock('./log.service', () => ({
    registrarAccion: jest.fn(),
}));

import {
    buildAnunciosInstitucionalesQuery,
    hasAnuncioDestinatariosTable,
    normalizeDestinatarios,
    type Destinatario,
} from './anuncioInstitucional.service';

describe('anuncioInstitucional query builder', () => {
    test('non-admin query includes audience filters and closes Curso/Nivel blocks correctly', () => {
        const query = buildAnunciosInstitucionalesQuery(false);

        expect(query).toContain("AND d5.Tipo = 'Curso'");
        expect(query).toContain("AND d6.Tipo = 'Nivel'");
        expect(query).toContain('OR EXISTS (');
        expect(query).toContain('ORDER BY a.FechaPublicacion DESC');
    });

    test('admin query omits audience filter and keeps ordering', () => {
        const query = buildAnunciosInstitucionalesQuery(true);

        expect(query).not.toContain('d5.Tipo = \'Curso\'');
        expect(query).not.toContain('d6.Tipo = \'Nivel\'');
        expect(query).toContain('ORDER BY a.FechaPublicacion DESC');
    });

    test('legacy tenant query avoids missing audience table references', () => {
        const query = buildAnunciosInstitucionalesQuery(false, false);

        expect(query).toContain('WHERE a.Activo = 1');
        expect(query).not.toContain('Virtual.AnuncioDestinatarios');
        expect(query).toContain('ORDER BY a.FechaPublicacion DESC');
    });
});

describe('normalizeDestinatarios', () => {
    test('deduplicates and removes invalid entries', () => {
        const input: Destinatario[] = [
            { tipo: 'Curso', valor: ' 1001 ' },
            { tipo: 'Curso', valor: '1001' },
            { tipo: 'Nivel', valor: 'Secundaria' },
            { tipo: 'Rol', valor: '' },
            { tipo: 'Rol', valor: 'Docente' },
            { tipo: 'Rol', valor: 'Docente' },
            { tipo: 'Invalido', valor: 'x' } as unknown as Destinatario,
        ];

        expect(normalizeDestinatarios(input)).toEqual([
            { tipo: 'Curso', valor: '1001' },
            { tipo: 'Nivel', valor: 'Secundaria' },
            { tipo: 'Rol', valor: 'Docente' },
        ]);
    });

    test('returns empty array when destinatarios is undefined', () => {
        expect(normalizeDestinatarios()).toEqual([]);
    });
});

describe('hasAnuncioDestinatariosTable', () => {
    const createPool = (exists: boolean) => {
        const query = jest.fn().mockResolvedValue({ recordset: [{ exists: exists ? 1 : 0 }] });
        const input = jest.fn().mockReturnThis();
        const request = jest.fn(() => ({ input, query }));

        return {
            pool: { request },
            request,
            input,
            query,
        };
    };

    test('checks metadata once and reuses cached table presence', async () => {
        const { pool, request } = createPool(true);

        await expect(hasAnuncioDestinatariosTable(pool as never, 1_000)).resolves.toBe(true);
        await expect(hasAnuncioDestinatariosTable(pool as never, 1_500)).resolves.toBe(true);

        expect(request).toHaveBeenCalledTimes(1);
    });

    test('refreshes metadata after cache ttl', async () => {
        const { pool, request } = createPool(false);

        await expect(hasAnuncioDestinatariosTable(pool as never, 1_000)).resolves.toBe(false);
        await expect(hasAnuncioDestinatariosTable(pool as never, 302_000)).resolves.toBe(false);

        expect(request).toHaveBeenCalledTimes(2);
    });
});

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const anuncioService = __importStar(require("./anuncioInstitucional.service"));
describe('AnuncioInstitucionalService - Segmentación', () => {
    // Datos de prueba
    const mockAdmin = { codigo: 1, perfil: 'Administrador' };
    const mockEstudiante = { codigo: 1234, perfil: 'Estudiante' };
    const mockDocente = { codigo: 5678, perfil: 'Docente' };
    test('Un administrador debe ver todos los anuncios', async () => {
        const anuncios = await anuncioService.getAnunciosInstitucionales(mockAdmin.codigo, mockAdmin.perfil);
        expect(Array.isArray(anuncios)).toBe(true);
        // Los admins no tienen filtros aplicados en el WHERE
    });
    test('Un estudiante no debe ver anuncios dirigidos exclusivamente a docentes', async () => {
        // 1. Crear anuncio para docentes
        const nuevoAnuncio = await anuncioService.createAnuncioInstitucional('Solo Docentes', '<p>Contenido</p>', mockAdmin.codigo, mockAdmin.perfil, [{ tipo: 'Rol', valor: 'Docente' }]);
        // 2. Intentar obtenerlo como estudiante
        const anunciosEstudiante = await anuncioService.getAnunciosInstitucionales(mockEstudiante.codigo, mockEstudiante.perfil);
        const encontrado = anunciosEstudiante.find(a => a.anuncioId === nuevoAnuncio.anuncioId);
        expect(encontrado).toBeUndefined();
        await anuncioService.deleteAnuncioInstitucional(nuevoAnuncio.anuncioId, mockAdmin.codigo, mockAdmin.perfil);
    });
    test('getDocentes debe devolver una lista de docentes', async () => {
        const docentes = await anuncioService.getDocentes();
        expect(Array.isArray(docentes)).toBe(true);
        if (docentes.length > 0) {
            expect(docentes[0]).toHaveProperty('codigo');
            expect(docentes[0]).toHaveProperty('nombre');
        }
    });
    test('getEstudiantes debe devolver una lista de estudiantes', async () => {
        const estudiantes = await anuncioService.getEstudiantes();
        expect(Array.isArray(estudiantes)).toBe(true);
        if (estudiantes.length > 0) {
            expect(estudiantes[0]).toHaveProperty('codigo');
            expect(estudiantes[0]).toHaveProperty('nombre');
        }
    });
    test('getCargaDocente debe devolver la carga jerárquica de un docente', async () => {
        const docentes = await anuncioService.getDocentes();
        if (docentes.length > 0) {
            const carga = await anuncioService.getCargaDocente(docentes[0].codigo);
            expect(Array.isArray(carga)).toBe(true);
            if (carga.length > 0) {
                expect(carga[0]).toHaveProperty('nombre'); // Grado
                expect(carga[0]).toHaveProperty('cursos');
                expect(Array.isArray(carga[0].cursos)).toBe(true);
            }
        }
    });
});

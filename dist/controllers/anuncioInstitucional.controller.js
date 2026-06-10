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
exports.buscarUsuarios = exports.getCargaDocente = exports.getEstudiantes = exports.getDocentes = exports.getHierarchyData = exports.getAudienciaData = exports.deleteAnuncioInstitucional = exports.updateAnuncioInstitucional = exports.createAnuncioInstitucional = exports.getAnunciosInstitucionales = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const anuncioInstitucionalService = __importStar(require("../services/anuncioInstitucional.service"));
exports.getAnunciosInstitucionales = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { codigo, perfil } = req.user;
    const anuncios = await anuncioInstitucionalService.getAnunciosInstitucionales(codigo, perfil);
    res.status(200).json(anuncios);
});
exports.createAnuncioInstitucional = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { titulo, contenido, destinatarios } = req.body;
    const { codigo, perfil } = req.user;
    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    const nuevoAnuncio = await anuncioInstitucionalService.createAnuncioInstitucional(titulo, contenido, codigo, perfil, destinatarios);
    res.status(201).json(nuevoAnuncio);
});
exports.updateAnuncioInstitucional = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = Number(req.params.id);
    const { titulo, contenido } = req.body;
    const { codigo, perfil } = req.user;
    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de anuncio inválido.' });
    }
    const anuncioActualizado = await anuncioInstitucionalService.updateAnuncioInstitucional(id, titulo, contenido, codigo, perfil);
    res.status(200).json(anuncioActualizado);
});
exports.deleteAnuncioInstitucional = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = Number(req.params.id);
    const { codigo, perfil } = req.user;
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de anuncio inválido.' });
    }
    await anuncioInstitucionalService.deleteAnuncioInstitucional(id, codigo, perfil);
    res.status(204).send();
});
exports.getAudienciaData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await anuncioInstitucionalService.getAudienciaData();
    res.status(200).json(data);
});
exports.getHierarchyData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const tipo = req.query.tipo;
    if (!tipo)
        return res.status(400).json({ message: 'El tipo es requerido.' });
    const data = await anuncioInstitucionalService.getHierarchyData(tipo);
    res.status(200).json(data);
});
exports.getDocentes = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const docentes = await anuncioInstitucionalService.getDocentes();
    res.status(200).json(docentes);
});
exports.getEstudiantes = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const estudiantes = await anuncioInstitucionalService.getEstudiantes();
    res.status(200).json(estudiantes);
});
exports.getCargaDocente = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const codigo = Number(req.params.codigo);
    if (isNaN(codigo)) {
        return res.status(400).json({ message: 'Código de docente inválido.' });
    }
    const carga = await anuncioInstitucionalService.getCargaDocente(codigo);
    res.status(200).json(carga);
});
exports.buscarUsuarios = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const termino = req.query.q;
    if (!termino || termino.length < 2) {
        return res.status(200).json([]);
    }
    const usuarios = await anuncioInstitucionalService.buscarUsuarios(termino);
    res.status(200).json(usuarios);
});

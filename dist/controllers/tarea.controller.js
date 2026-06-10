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
exports.descargarEntrega = exports.crearEntrega = exports.guardarCalificacion = exports.getEntregasPorTarea = void 0;
const tareaService = __importStar(require("../services/tarea.service"));
const multer_config_1 = require("../config/multer.config");
const notificacion_service_1 = require("../services/notificacion.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const errors_1 = require("../utils/errors");
const getContenidoHtml = (value) => {
    if (typeof value !== 'object' || value === null)
        return '';
    const contenidoHTML = value.contenidoHTML;
    return typeof contenidoHTML === 'string' ? contenidoHTML : '';
};
exports.getEntregasPorTarea = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recursoId = Number(req.params.id);
    if (isNaN(recursoId)) {
        return res.status(400).json({ message: 'El ID del recurso-tarea debe ser un número válido.' });
    }
    const datosCalificacion = await tareaService.findEntregasByRecursoId(recursoId);
    res.status(200).json(datosCalificacion);
});
exports.guardarCalificacion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tareaId, matriculaNo } = req.params;
    const { calificacion, comentariosProfesor } = req.body;
    await tareaService.upsertCalificacion({
        recursoId: Number(tareaId),
        matriculaNo: Number(matriculaNo),
        calificacion,
        comentariosProfesor
    });
    res.status(200).json({ message: 'Calificación guardada con éxito.' });
});
const crearEntrega = (req, res) => {
    const upload = multer_config_1.uploadDiskGeneral.single('archivo');
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: (0, errors_1.getErrorMessage)(err, 'Error al subir archivo') });
        }
        try {
            const recursoId = Number(req.params.id);
            const usuario = req.user;
            if (!usuario)
                return res.status(401).json({ message: 'No autorizado' });
            let bodyData = {};
            if (req.body.jsonData) {
                try {
                    bodyData = JSON.parse(req.body.jsonData);
                }
                catch (e) {
                    console.error("Error parseando JSON", e);
                }
            }
            await tareaService.guardarEntregaEstudiante({
                recursoId: recursoId,
                matriculaNo: usuario.codigo,
                contenidoHTML: getContenidoHtml(bodyData),
                archivo: req.file // Pasamos el buffer
            });
            (0, notificacion_service_1.notificarDocentePorInteraccion)(recursoId, { codigo: usuario.codigo, nombreCompleto: usuario.nombreCompleto }, 'TAREA_ENTREGADA').catch(console.error);
            res.status(201).json({ message: 'Entrega realizada con éxito.' });
        }
        catch (error) {
            console.error('Error al crear entrega:', error);
            res.status(500).json({ message: (0, errors_1.getErrorMessage)(error, 'Error interno') });
        }
    });
};
exports.crearEntrega = crearEntrega;
exports.descargarEntrega = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const entregaId = Number(req.params.id);
    if (isNaN(entregaId))
        return res.status(400).json({ message: 'ID inválido' });
    const archivo = await tareaService.getArchivoEntregaById(entregaId);
    if (!archivo || !archivo.ArchivoData) {
        return res.status(404).json({ message: 'El archivo no existe o está dañado.' });
    }
    res.setHeader('Content-Type', archivo.ArchivoMimeType || 'application/octet-stream');
    // encodeURIComponent evita errores con tildes o espacios
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(archivo.NombreArchivo)}"`);
    res.setHeader('Content-Length', archivo.ArchivoData.length);
    res.end(archivo.ArchivoData);
});

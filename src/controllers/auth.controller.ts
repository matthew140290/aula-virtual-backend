// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import * as authService from '../services/auth.service';
import * as estudianteService from '../services/estudiante.service';
import { DecodedUserToken } from '../middleware/auth.middleware'; // Importar la interfaz
import { asyncHandler } from '../utils/asyncHandler';
import { ROLES } from '../constants/roles';

const JWT_SECRET = process.env.JWT_SECRET!;



export const login = asyncHandler(async (req: Request, res: Response) => {
    const { nombre, contrasena } = req.body; 

    try {
        const { token, user } = await authService.processLogin(nombre, contrasena);
        
        console.log(`✅ [AUTH_SUCCESS] ${user.perfil} ${user.nombre} inició sesión.`);
        res.status(200).json({ message: 'Inicio de sesión exitoso.', token, user });
        
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'CredencialesIncorrectas') {
            console.warn(`🔒 [AUTH_FAILED] Intento fallido para el usuario: "${nombre}". IP: ${req.ip}`);
            res.status(401).json({ message: 'Usuario o contraseña incorrecta.' });
        } else {
            // Si es un error de Base de Datos (ej. SQL Server offline), lo lanzamos al Global Error Handler
            throw error; 
        }
    }
});


export const ssoLogin = asyncHandler(async (req: Request, res: Response) => {
    const { token: ssoToken } = req.body;

    try {
        const decoded = jwt.verify(ssoToken, JWT_SECRET) as { codigo: number, perfil: string, nombre: string };
        
        const sessionTokenPayload: DecodedUserToken = {
            codigo: decoded.codigo,
            perfil: decoded.perfil,
            nombre: decoded.nombre,
            nombreCompleto: decoded.nombre
        };
        
        const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, { expiresIn: '8h' });

        console.log(`✅ [SSO_SUCCESS] ${decoded.nombre} autenticado vía SSO.`);
        res.status(200).json({
            message: 'Autenticación SSO exitosa.',
            token: sessionToken,
            user: sessionTokenPayload
        });
    } catch (error: unknown) {
        console.warn(`🔒 [SSO_FAILED] Intento de SSO fallido con token inválido/expirado. IP: ${req.ip}`);
        res.status(401).json({ message: 'Token de SSO inválido o expirado.' });
    }
});

export const toggleStudentView = asyncHandler(async (req: Request, res: Response) => {
    const originalToken = req.cookies.originalToken;

    // --- VOLVER A LA VISTA ORIGINAL ---
    if (originalToken) {
        res.cookie('originalToken', '', { expires: new Date(0) });
        const decodedOriginal = jwt.verify(originalToken, JWT_SECRET) as DecodedUserToken;
        return res.status(200).json({ token: originalToken, user: decodedOriginal });
    }

    // --- CAMBIAR A VISTA DE ESTUDIANTE ---
    const allowedRolesToToggle = [ROLES.DOCENTE, ROLES.DIRECTOR_GRUPO, ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER];
    
    // Validamos usando nuestras constantes estrictas
    if (allowedRolesToToggle.includes(req.user!.perfil as any)) {
        const currentToken = req.headers.authorization?.split(' ')[1];
        if (!currentToken) throw new Error('Token actual no encontrado.');

        const contexto = await estudianteService.findContextoAcademicoByDocente(req.user!.codigo);

        const studentViewPayload: DecodedUserToken & { contexto: any } = {
            codigo: req.user!.codigo,
            nombre: req.user!.nombre,
            nombreCompleto: req.user!.nombreCompleto,
            perfil: ROLES.ESTUDIANTE,
            originalPerfil: req.user!.perfil, 
            contexto: contexto || { NombreGrado: 'Grado General', NombreCurso: 'Institucional' }
        };

        const studentToken = jwt.sign(studentViewPayload, JWT_SECRET, { expiresIn: '1h' });
        
        res.cookie('originalToken', currentToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 // 1 hora
        });

        console.log(`🔄 [VIEW_TOGGLE] ${req.user!.nombre} cambió a vista de estudiante.`);
        return res.status(200).json({ token: studentToken, user: studentViewPayload });
    }

    console.warn(`🛑 [VIEW_TOGGLE_DENIED] El usuario ${req.user!.nombre} (${req.user!.perfil}) intentó cambiar de vista sin permisos.`);
    return res.status(403).json({ message: 'Función no permitida para tu perfil actual.' });
});
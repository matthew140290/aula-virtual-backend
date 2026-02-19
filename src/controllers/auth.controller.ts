// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import * as authService from '../services/auth.service';
import * as estudianteService from '../services/estudiante.service';
import { registrarAccion } from '../services/log.service';
import { DecodedUserToken } from '../middleware/auth.middleware'; // Importar la interfaz

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

const stringToHex = (str: string): string => {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase();
};
// Convierte un string Hexadecimal de vuelta a texto.
const hexToString = (hex: string): string => {
  return Buffer.from(hex, 'hex').toString('utf8');
};

export const login = async (req: Request, res: Response) => {
    const { nombre: rawNombre, contrasena: rawContrasena } = req.body;
    if (!rawNombre || !rawContrasena) {
        return res.status(400).json({ message: 'El nombre y la contraseña son requeridos.' });
    }

    const nombre = rawNombre.trim();
    const contrasena = rawContrasena.trim();

    try {
        const hexNombre = stringToHex(nombre);
        const user = await authService.findUserByName(hexNombre);


        const validUser = user.find(user => {
            return hexToString(user.Contrasena).trim() == contrasena;
        });

        if (validUser) {
           const tokenPayload = {
            codigo: validUser.Codigo,
            nombre: hexToString(validUser.Nombre),
            nombreCompleto: validUser.NombreCompleto,
            perfil: validUser.Perfil
           };

        registrarAccion(validUser.Codigo, validUser.Perfil, 'Sistema Aula', 'Login', 'Inicio exitoso Docente')
                .catch(err => console.error("Error no bloqueante en log:", err.message));
        

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: tokenPayload
        });

        }
      
        const student = await authService.findStudentForLogin(nombre, contrasena);

        if (student) {
            // Éxito como Estudiante
            const tokenPayload = {
                codigo: student.Codigo, // Este es el MatrículaNo
                nombre: student.Nombre,
                nombreCompleto: student.NombreCompleto,
                perfil: student.Perfil,
                numeroDocumento: student.NumeroDocumento
            };

            registrarAccion(student.CodigoLog, student.Perfil, 'Sistema Aula', 'Login', 'Inicio exitoso Estudiante')
                .catch(err => console.error("⚠️ Error al registrar log (Login continúa):", err.message));

            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
            return res.status(200).json({
                message: 'Inicio de sesión exitoso.',
                token,
                user: tokenPayload
            });
        }
        
        registrarAccion(0, 'Desconocido', 'Sistema Aula', 'Login', `Fallo login: ${nombre}`)
            .catch(() => {});
        return res.status(401).json({ message: 'Usuario o contraseña incorrecta.' });

    } catch (error) {
        console.error("Error en el proceso de login:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};


export const ssoLogin = (req: Request, res: Response) => {
    const { token: ssoToken } = req.body;

    if (!ssoToken) {
        return res.status(400).json({ message: 'Token de SSO no proporcionado.' });
    }

    try {
        // Verificamos el token de un solo uso generado por ASP.NET
        const decoded = jwt.verify(ssoToken, JWT_SECRET) as { codigo: number, perfil: string, nombre: string };

        // Generamos un nuevo token de sesión estándar para nuestra aplicación React
        const sessionTokenPayload = {
            codigo: decoded.codigo,
            perfil: decoded.perfil,
            nombre: decoded.nombre
            
        };
        const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            message: 'Autenticación SSO exitosa.',
            token: sessionToken,
            user: sessionTokenPayload
        });

    } catch (error) {
        // Si el token es inválido o expiró
        return res.status(401).json({ message: 'Token de SSO inválido o expirado.' });
    }
};

export const toggleStudentView = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }

        const originalToken = req.cookies.originalToken;

        // --- Lógica para VOLVER A LA VISTA DE DOCENTE ---
        if (originalToken) {
            // Limpiamos la cookie
            res.cookie('originalToken', '', { expires: new Date(0) });
            const decodedOriginal = jwt.verify(originalToken, JWT_SECRET) as DecodedUserToken;
            return res.status(200).json({ token: originalToken, user: decodedOriginal });
        }

        // --- Lógica para CAMBIAR A VISTA DE ESTUDIANTE ---
        if (req.user.perfil.includes('Docente')) {
            const currentToken = req.headers.authorization?.split(' ')[1];
            if (!currentToken) {
                return res.status(400).json({ message: 'Token actual no encontrado.' });
            }

            // Buscamos un contexto académico para el docente
            const contexto = await estudianteService.findContextoAcademicoByDocente(req.user.codigo);

            const studentViewPayload = {
                codigo: req.user.codigo,
                nombre: req.user.nombre,
                nombreCompleto: req.user.nombreCompleto,
                perfil: 'Estudiante',
                originalPerfil: req.user.perfil, 
                contexto: contexto || { NombreGrado: 'Grado', NombreCurso: 'Ejemplo' }
            };

            const studentToken = jwt.sign(studentViewPayload, JWT_SECRET, { expiresIn: '1h' });
            
            // Guardamos el token original del docente en una cookie segura
            res.cookie('originalToken', currentToken, {
                httpOnly: true, // El frontend no puede acceder a esta cookie
                secure: process.env.NODE_ENV === 'production', // Usar HTTPS en producción
                sameSite: 'strict',
                maxAge: 3600000 // 1 hora
            });

            return res.status(200).json({ token: studentToken, user: studentViewPayload });
        }

        return res.status(403).json({ message: 'Función solo para docentes.' });

    } catch (error) {
        console.error("Error al cambiar de vista:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
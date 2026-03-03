// src/routes/curso.routes.ts
import { Router } from 'express';
import * as cursoController from '../controllers/curso.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { ROLES } from '../constants/roles'; 

const router = Router();


router.get(
    '/mis-cursos', 
    protect, 
    authorize([
        ROLES.DOCENTE, 
        ROLES.ESTUDIANTE, 
        ROLES.DIRECTOR_GRUPO, 
        ROLES.COORDINADOR,
        ROLES.COORDINADOR_GENERAL, 
        ROLES.ADMINISTRADOR, 
        ROLES.MASTER
    ]), 
    cursoController.getMisCursos
);

export default router;
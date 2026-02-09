// src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Ruta para el login tradicional
// POST /api/auth/login
router.post('/login', authController.login);

// Ruta para el Single Sign-On
// POST /api/auth/sso
router.post('/sso', authController.ssoLogin);

router.post('/toggle-student-view', protect, authController.toggleStudentView);

export default router;
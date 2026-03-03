// src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validateSchema } from '../middleware/validate.middleware';
import { loginSchema, ssoSchema } from '../schemas/auth.schema';

const router = Router();


router.post('/login', validateSchema(loginSchema), authController.login);

router.post('/sso', validateSchema(ssoSchema), authController.ssoLogin);

router.post('/toggle-student-view', protect, authController.toggleStudentView);

export default router;
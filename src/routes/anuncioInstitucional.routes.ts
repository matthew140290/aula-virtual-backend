//src/routes/anuncioInstitucional.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { ROLES } from '../constants/roles';
import {
  createAnuncioInstitucional,
  deleteAnuncioInstitucional,
  getAnunciosInstitucionales,
  updateAnuncioInstitucional,
} from '../controllers/anuncioInstitucional.controller';

const router = Router();

router.use(protect);


router.get(
  '/anuncios-institucionales',
  getAnunciosInstitucionales
);

router.post(
  '/anuncios-institucionales',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  createAnuncioInstitucional
);

router.put(
  '/anuncios-institucionales/:id',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  updateAnuncioInstitucional
);

router.delete(
  '/anuncios-institucionales/:id',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  deleteAnuncioInstitucional
);

export default router;

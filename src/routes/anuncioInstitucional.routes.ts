//src/routes/anuncioInstitucional.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { ROLES } from '../constants/roles';
import {
  createAnuncioInstitucional,
  deleteAnuncioInstitucional,
  getAnunciosInstitucionales,
  updateAnuncioInstitucional,
  getAudienciaData,
  buscarUsuarios,
  getDocentes,
  getEstudiantes,
  getCargaDocente,
  getHierarchyData
} from '../controllers/anuncioInstitucional.controller';

const router = Router();

router.use(protect);

router.get(
  '/anuncios-institucionales',
  getAnunciosInstitucionales
);

router.get(
  '/anuncios-institucionales/audiencia-data',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  getAudienciaData
);

router.get(
  '/anuncios-institucionales/hierarchy-data',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  getHierarchyData
);

router.get(
  '/anuncios-institucionales/docentes',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  getDocentes
);

router.get(
  '/anuncios-institucionales/estudiantes',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  getEstudiantes
);

router.get(
  '/anuncios-institucionales/carga-docente/:codigo',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  getCargaDocente
);

router.get(
  '/anuncios-institucionales/buscar-usuarios',
  authorize([ROLES.COORDINADOR, ROLES.COORDINADOR_GENERAL, ROLES.ADMINISTRADOR, ROLES.MASTER]),
  buscarUsuarios
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

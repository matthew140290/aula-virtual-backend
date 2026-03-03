//src/routes/usuario.routes
import { Router } from 'express';
import multer from 'multer';
import * as usuarioController from '../controllers/usuario.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Configura multer para guardar la imagen en memoria

router.use(protect);

router.get('/:codigo/foto', usuarioController.getFotoByUsuario);

// Ruta para obtener los datos del perfil
router.get('/mi-perfil', usuarioController.getMiPerfil);
router.get('/mi-perfil/foto', usuarioController.getMiFoto);
// Ruta para subir la foto. 'profilePhoto' es el nombre del campo en el FormData.
router.post('/mi-perfil/foto', upload.single('profilePhoto'), usuarioController.uploadMiFoto);

export default router;
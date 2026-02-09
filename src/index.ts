//src/index.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors'; 
import path from 'path';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import cursoRoutes from './routes/curso.routes';
import periodoRoutes from './routes/periodo.routes';
import semanaRoutes from './routes/semana.routes';
import apartadoRoutes from './routes/apartado.routes';
import estudianteRoutes from './routes/estudiante.routes';
import recursoRoutes from './routes/recurso.routes';
import usuarioRoutes from './routes/usuario.routes';
import notificacionRoutes from './routes/notificacion.routes';
import tareaRoutes from './routes/tarea.routes';
import archivoRoutes from './routes/archivo.routes';
import foroRoutes from './routes/foro.routes';
import pruebaRoutes from './routes/prueba.routes';
import anuncioRoutes from './routes/anuncio.routes';

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3001;


// Define las URLs que tendrán permiso para acceder a tu API
// const whitelist = ['http://localhost:3001', 'http://localhost:5173'];
// const whitelist = ['https://aula-vitual.plataformaangela.com'];
const whitelist = ['https://jerusalen.aula-virtual.plataformaangela.com'];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // La comprobación `!origin` permite peticiones sin origen (ej. Postman o apps móviles)
    if (whitelist.indexOf(origin!) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Acceso denegado por la política de CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']

};

// --- Middlewares ---
app.use(cors(corsOptions)); 
app.use(express.json()); 

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(cookieParser());

// Una ruta de prueba para verificar que el servidor funciona
app.get('/api/ping', (req: Request, res: Response) => {
  res.status(200).json({ message: '¡Pong! El servidor del Aula Virtual está activo. ✨' });
});

// --- Rutas de la API ---
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/periodos', periodoRoutes);
app.use('/api/semanas', semanaRoutes); 
app.use('/api/apartados', apartadoRoutes);
app.use('/api/estudiantes', estudianteRoutes);
app.use('/api/recursos', recursoRoutes);
app.use('/api/anuncios', anuncioRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/archivos', archivoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/foros', foroRoutes);
app.use('/api/pruebas', pruebaRoutes); 

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
//src/index.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors'; 
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
import anuncioInstitucionalRoutes from './routes/anuncioInstitucional.routes';
import auditoriaRoutes from './routes/auditoria.routes';
import dashboardRoutes from './routes/dashboard.routes';
import icfesGlobalRoutes from './routes/icfesGlobal.routes';
import { errorHandler } from './middleware/error.middleware';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { tenantManager } from './config/tenantManager';
import {
  assertTenantConfiguration,
  getAllowedTenantIds,
  normalizeTenantId,
} from './config/tenantRegistry';
import { assertAuthConfiguration } from './config/authToken';

dotenv.config();
assertTenantConfiguration();
assertAuthConfiguration();


const app = express();
const PORT = process.env.PORT || 3002;

const whitelist = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedTenantOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;

    const domain = (process.env.TENANT_FRONTEND_DOMAIN ?? 'aula-virtual.plataformaangela.com')
      .trim()
      .toLowerCase();
    const suffix = `.${domain}`;
    if (!url.hostname.toLowerCase().endsWith(suffix)) return false;

    const tenantId = normalizeTenantId(url.hostname.slice(0, -suffix.length));
    return getAllowedTenantIds().has(tenantId);
  } catch {
    return false;
  }
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // La comprobación `!origin` permite peticiones sin origen (ej. Postman o apps móviles)
    if (!origin || whitelist.includes(origin) || isAllowedTenantOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Acceso denegado por la política de CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization', 'x-tenant-id']

};

// --- Middlewares ---
app.use(cors(corsOptions)); 
app.use(express.json({ limit: '1mb' }));

app.use(cookieParser());

// Una ruta de prueba para verificar que el servidor funciona
app.get('/api/ping', (req: Request, res: Response) => {
  res.status(200).json({ message: '¡Pong! El servidor del Aula Virtual está activo. ✨' });
});

// Middleware Multi-Tenant: aplica para TODAS las rutas /api/* excepto el ping
app.use('/api', tenantMiddleware);

// --- Rutas de la API ---
app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/periodos', periodoRoutes);
app.use('/api/semanas', semanaRoutes); 
app.use('/api/apartados', apartadoRoutes);
app.use('/api/estudiantes', estudianteRoutes);
app.use('/api/recursos', recursoRoutes);
app.use('/api/anuncios', anuncioRoutes);
app.use('/api', anuncioInstitucionalRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/archivos', archivoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/foros', foroRoutes);
app.use('/api/pruebas', pruebaRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/icfes-global', icfesGlobalRoutes);
//app.use('/api/anuncio-institucionales', anuncioInstitucionalRoutes); // Asegúrate de que esta ruta esté registrada

app.use(errorHandler); // Middleware de manejo de errores global, debe ir después de las rutas

// Iniciar el servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[Shutdown] ${signal} recibido. Cerrando conexiones.`);
  server.close(() => {
    tenantManager.closeAll()
      .catch((error: unknown) => console.error('[Shutdown] Error cerrando pools:', error))
      .finally(() => process.exit(0));
  });
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//src/index.ts
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const curso_routes_1 = __importDefault(require("./routes/curso.routes"));
const periodo_routes_1 = __importDefault(require("./routes/periodo.routes"));
const semana_routes_1 = __importDefault(require("./routes/semana.routes"));
const apartado_routes_1 = __importDefault(require("./routes/apartado.routes"));
const estudiante_routes_1 = __importDefault(require("./routes/estudiante.routes"));
const recurso_routes_1 = __importDefault(require("./routes/recurso.routes"));
const usuario_routes_1 = __importDefault(require("./routes/usuario.routes"));
const notificacion_routes_1 = __importDefault(require("./routes/notificacion.routes"));
const tarea_routes_1 = __importDefault(require("./routes/tarea.routes"));
const archivo_routes_1 = __importDefault(require("./routes/archivo.routes"));
const foro_routes_1 = __importDefault(require("./routes/foro.routes"));
const prueba_routes_1 = __importDefault(require("./routes/prueba.routes"));
const anuncio_routes_1 = __importDefault(require("./routes/anuncio.routes"));
const anuncioInstitucional_routes_1 = __importDefault(require("./routes/anuncioInstitucional.routes"));
const auditoria_routes_1 = __importDefault(require("./routes/auditoria.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const icfesGlobal_routes_1 = __importDefault(require("./routes/icfesGlobal.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const tenant_middleware_1 = require("./middleware/tenant.middleware");
const tenantManager_1 = require("./config/tenantManager");
const tenantRegistry_1 = require("./config/tenantRegistry");
const authToken_1 = require("./config/authToken");
dotenv_1.default.config();
(0, tenantRegistry_1.assertTenantConfiguration)();
(0, authToken_1.assertAuthConfiguration)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
const whitelist = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const isAllowedTenantOrigin = (origin) => {
    try {
        const url = new URL(origin);
        if (url.protocol !== 'https:')
            return false;
        const domain = (process.env.TENANT_FRONTEND_DOMAIN ?? 'aula-virtual.plataformaangela.com')
            .trim()
            .toLowerCase();
        const suffix = `.${domain}`;
        if (!url.hostname.toLowerCase().endsWith(suffix))
            return false;
        const tenantId = (0, tenantRegistry_1.normalizeTenantId)(url.hostname.slice(0, -suffix.length));
        return (0, tenantRegistry_1.getAllowedTenantIds)().has(tenantId);
    }
    catch {
        return false;
    }
};
const corsOptions = {
    origin: (origin, callback) => {
        // La comprobación `!origin` permite peticiones sin origen (ej. Postman o apps móviles)
        if (!origin || whitelist.includes(origin) || isAllowedTenantOrigin(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Acceso denegado por la política de CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
};
// --- Middlewares ---
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
// Una ruta de prueba para verificar que el servidor funciona
app.get('/api/ping', (req, res) => {
    res.status(200).json({ message: '¡Pong! El servidor del Aula Virtual está activo. ✨' });
});
// Middleware Multi-Tenant: aplica para TODAS las rutas /api/* excepto el ping
app.use('/api', tenant_middleware_1.tenantMiddleware);
// --- Rutas de la API ---
app.use('/api/auth', auth_routes_1.default);
app.use('/api/cursos', curso_routes_1.default);
app.use('/api/periodos', periodo_routes_1.default);
app.use('/api/semanas', semana_routes_1.default);
app.use('/api/apartados', apartado_routes_1.default);
app.use('/api/estudiantes', estudiante_routes_1.default);
app.use('/api/recursos', recurso_routes_1.default);
app.use('/api/anuncios', anuncio_routes_1.default);
app.use('/api', anuncioInstitucional_routes_1.default);
app.use('/api/tareas', tarea_routes_1.default);
app.use('/api/archivos', archivo_routes_1.default);
app.use('/api/usuarios', usuario_routes_1.default);
app.use('/api/notificaciones', notificacion_routes_1.default);
app.use('/api/foros', foro_routes_1.default);
app.use('/api/pruebas', prueba_routes_1.default);
app.use('/api/auditoria', auditoria_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/icfes-global', icfesGlobal_routes_1.default);
//app.use('/api/anuncio-institucionales', anuncioInstitucionalRoutes); // Asegúrate de que esta ruta esté registrada
app.use(error_middleware_1.errorHandler); // Middleware de manejo de errores global, debe ir después de las rutas
// Iniciar el servidor
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
const shutdown = (signal) => {
    console.log(`[Shutdown] ${signal} recibido. Cerrando conexiones.`);
    server.close(() => {
        tenantManager_1.tenantManager.closeAll()
            .catch((error) => console.error('[Shutdown] Error cerrando pools:', error))
            .finally(() => process.exit(0));
    });
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

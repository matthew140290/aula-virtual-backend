// src/config/database.ts
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

function parseServerAndInstance(raw?: string) {
  if (!raw) return { host: '', instance: undefined as string | undefined };
  // Soporta "host\instancia" o solo "host"
  const idx = raw.indexOf('\\');
  if (idx === -1) return { host: raw, instance: undefined };
  return { host: raw.slice(0, idx), instance: raw.slice(idx + 1) };
}

const fromEnv = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_DATABASE!,
  encrypt: String(process.env.DB_ENCRYPT ?? 'true').toLowerCase() === 'true',
  trust: String(process.env.DB_TRUST_CERT ?? 'true').toLowerCase() === 'true',
  serverRaw: process.env.DB_SERVER!,           // puede venir como "host" o "host\instancia"
  instanceEnv: process.env.DB_INSTANCE,        // opcional
  portEnv: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
};

const { host, instance } = parseServerAndInstance(fromEnv.serverRaw);

// Preferimos puerto si está presente
const usePort = typeof fromEnv.portEnv === 'number' && !Number.isNaN(fromEnv.portEnv);

export const dbConfig: sql.config = {
  user: fromEnv.user,
  password: fromEnv.password,
  server: host,                 // ¡sin "\instancia" aquí!
  database: fromEnv.database,
  ...(usePort
    ? { port: fromEnv.portEnv }
    : { options: { instanceName: fromEnv.instanceEnv ?? instance } as any }),
  options: {
    // Mezclamos con opciones previas (si no usamos puerto, arriba ya pusimos instanceName)
    ...(usePort ? {} : { instanceName: fromEnv.instanceEnv ?? instance }),
    encrypt: fromEnv.encrypt,
    trustServerCertificate: fromEnv.trust,
  },
  connectionTimeout: 30000,  // 30s
  requestTimeout: 30000,     // 30s
};

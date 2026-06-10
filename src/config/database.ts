import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
};

const parseServerAndInstance = (
  raw: string,
): { host: string; instance?: string } => {
  const separator = raw.indexOf('\\');
  if (separator === -1) return { host: raw };
  return {
    host: raw.slice(0, separator),
    instance: raw.slice(separator + 1),
  };
};

const parseOptionalPort = (raw: string | undefined): number | undefined => {
  if (!raw?.trim()) return undefined;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT debe ser un puerto TCP valido.');
  }
  return port;
};

const { host, instance } = parseServerAndInstance(requireEnv('DB_SERVER'));
const port = parseOptionalPort(process.env.DB_PORT);
const instanceName = process.env.DB_INSTANCE?.trim() || instance;
const options: NonNullable<sql.config['options']> = {
  encrypt: String(process.env.DB_ENCRYPT ?? 'true').toLowerCase() === 'true',
  trustServerCertificate: String(process.env.DB_TRUST_CERT ?? 'false').toLowerCase() === 'true',
  ...(port ? {} : instanceName ? { instanceName } : {}),
};

export const dbConfig: sql.config = {
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  server: host,
  ...(port ? { port } : {}),
  options,
  connectionTimeout: 30_000,
  requestTimeout: 30_000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

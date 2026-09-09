import { z } from 'zod';

/**
 * Environment contract. The process refuses to start on a bad value rather than
 * discovering it at the first request — the legacy app fell back to a hardcoded
 * "dev-only-insecure-secret" in production, which made every session forgeable.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /** Optional. Enables the Socket.IO Redis adapter and shared rate-limit state. */
  REDIS_URL: z.string().optional(),

  /** Must be at least 32 bytes of entropy. deploy.sh generates it. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** Domain for auth cookies; leave empty for host-only cookies. */
  COOKIE_DOMAIN: z.string().optional(),
  /** Set when the API is served over HTTPS so cookies get the Secure flag. */
  SECURE_COOKIES: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Turn the simulation loop off for maintenance or a read-only replica. */
  ENGINE_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),

  /** Trust X-Forwarded-For — true behind nginx, false when directly exposed. */
  TRUST_PROXY: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),

  /** Bootstraps the first admin account on startup if the table is empty. */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
});

export type Config = z.infer<typeof schema> & { corsOrigins: string[]; isProduction: boolean };

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const value = parsed.data;

  if (value.NODE_ENV === 'production' && /^(changeme|secret|dev)/i.test(value.JWT_SECRET)) {
    throw new Error('JWT_SECRET looks like a placeholder; generate a real one.');
  }

  cached = {
    ...value,
    corsOrigins: value.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    isProduction: value.NODE_ENV === 'production',
  };
  return cached;
}

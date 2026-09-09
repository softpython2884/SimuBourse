import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { ERROR_CODES, LIMITS } from '@alvora/shared';
import type { AppDeps } from './deps.js';
import { authPlugin } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerRoutes } from './routes/index.js';

export async function buildServer(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.isProduction
        ? undefined
        : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.newPassword'],
        remove: true,
      },
    },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 512 * 1024,
    disableRequestLogging: config.isProduction,
    genReqId: () => crypto.randomUUID(),
  });

  app.decorate('deps', deps);

  await app.register(sensible);
  await app.register(helmet, {
    // The API serves JSON only; the web app sets its own CSP.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, {
    origin(origin, callback) {
      // Same-origin and server-to-server requests arrive without an Origin header.
      if (!origin) return callback(null, true);
      callback(null, config.corsOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(cookie, { parseOptions: { httpOnly: true, sameSite: 'lax', path: '/' } });

  await app.register(rateLimit, {
    global: true,
    max: LIMITS.requestsPerMinute,
    timeWindow: '1 minute',
    // Rate-limit per account when authenticated so one office NAT is not one bucket.
    keyGenerator: (request) => {
      const auth = (request as { user?: { id: number } }).user;
      return auth ? `u:${auth.id}` : `ip:${request.ip}`;
    },
    errorResponseBuilder: () => ({
      error: { code: ERROR_CODES.RATE_LIMITED, message: 'Trop de requêtes, réessayez dans un instant.' },
    }),
  });

  await app.register(authPlugin, { db: deps.db, tokens: deps.tokens });

  registerErrorHandler(app);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  await app.register(registerRoutes, { prefix: '/api' });

  return app;
}

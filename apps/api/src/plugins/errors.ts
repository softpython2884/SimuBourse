import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError, ERROR_CODES } from '@alvora/shared';

/**
 * One error shape for the whole API: `{ error: { code, message, details? } }`.
 * Unexpected errors are logged with their stack but answered with a generic
 * message, so internals never leak to a client.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: ERROR_CODES.VALIDATION,
          message: 'Données invalides.',
          details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }

    const status = error.statusCode ?? 500;

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: { code: ERROR_CODES.RATE_LIMITED, message: 'Trop de requêtes, réessayez dans un instant.' },
      });
    }

    if (status >= 500) {
      request.log.error({ err: error, url: request.url, method: request.method }, 'unhandled error');
      return reply.status(500).send({
        error: { code: ERROR_CODES.INTERNAL, message: 'Erreur interne, réessayez.' },
      });
    }

    return reply.status(status).send({
      error: { code: error.code ?? ERROR_CODES.VALIDATION, message: error.message },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: ERROR_CODES.NOT_FOUND, message: 'Route introuvable.' } });
  });
}

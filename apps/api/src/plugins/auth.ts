import { and, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '@alvora/shared';
import { sessions, users, type Database } from '@alvora/db';
import { COOKIE_ACCESS, type TokenService } from '../lib/tokens.js';

export interface AuthUser {
  id: number;
  displayName: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  sessionId: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
  interface FastifyInstance {
    /** Populates request.user when a valid token is present; never throws. */
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Rejects the request unless a healthy, non-suspended account is attached. */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireModerator: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  db: Database;
  tokens: TokenService;
}

function extractToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  const cookie = request.cookies?.[COOKIE_ACCESS];
  return cookie ?? null;
}

export const authPlugin = fp<AuthPluginOptions>(async (app: FastifyInstance, options) => {
  const { db, tokens } = options;

  app.decorateRequest('user', null);

  async function resolve(request: FastifyRequest): Promise<AuthUser | null> {
    const token = extractToken(request);
    if (!token) return null;

    const claims = await tokens.verifyAccessToken(token);
    if (!claims) return null;

    const userId = Number(claims.sub);
    if (!Number.isInteger(userId)) return null;

    // The session row is checked on every request so a logout, a password change
    // or an admin ban takes effect immediately rather than at token expiry.
    const [row] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        status: users.status,
        sessionId: sessions.id,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.id, claims.sid),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) return null;
    return row as AuthUser;
  }

  app.decorate('optionalAuth', async (request: FastifyRequest) => {
    request.user = await resolve(request);
  });

  app.decorate('requireAuth', async (request: FastifyRequest) => {
    const user = await resolve(request);
    if (!user) throw AppError.unauthenticated();
    if (user.status === 'banned') throw new AppError('ACCOUNT_SUSPENDED', 'Ce compte est banni.', 403);
    if (user.status === 'suspended') throw new AppError('ACCOUNT_SUSPENDED', 'Ce compte est suspendu.', 403);
    request.user = user;
  });

  app.decorate('requireModerator', async (request: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(request, reply);
    if (request.user?.role !== 'admin' && request.user?.role !== 'moderator') {
      throw AppError.forbidden('Réservé à la modération.');
    }
  });

  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(request, reply);
    if (request.user?.role !== 'admin') throw AppError.forbidden('Réservé aux administrateurs.');
  });
});

/** Narrowing helper for route handlers behind `requireAuth`. */
export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw AppError.unauthenticated();
  return request.user;
}

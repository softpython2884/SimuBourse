import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { LIMITS } from '@alvora/shared';

export interface AccessClaims extends JWTPayload {
  sub: string;
  role: string;
  /** Session row id, so revoking a session invalidates its access tokens too. */
  sid: number;
}

const ISSUER = 'alvora';
const AUDIENCE = 'alvora-web';

export class TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async signAccessToken(userId: number, role: string, sessionId: number): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = LIMITS.accessTokenMinutes * 60;
    const token = await new SignJWT({ role, sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(String(userId))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.key);
    return { token, expiresIn };
  }

  async verifyAccessToken(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'number') return null;
      return payload as AccessClaims;
    } catch {
      return null;
    }
  }

  /**
   * Refresh tokens are opaque random strings. Only their SHA-256 is stored, so a
   * database dump cannot be replayed into live sessions.
   */
  createRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: hashToken(token) };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const COOKIE_ACCESS = 'alv_at';
export const COOKIE_REFRESH = 'alv_rt';

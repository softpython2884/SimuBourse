'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users } from './db/schema';

const COOKIE_NAME = 'sb_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    // Fall back to a stable derived value so dev doesn't crash, but warn loudly.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production.');
    }
    return 'dev-only-insecure-secret-please-set-SESSION_SECRET-in-env';
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return base64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

type TokenPayload = { uid: number; exp: number };

function encodeToken(payload: TokenPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = sign(body);
  return `${body}.${sig}`;
}

function decodeToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = sign(body);
  if (!timingSafeEqualStr(sig, expectedSig)) return null;
  try {
    const json = JSON.parse(base64urlDecode(body).toString('utf8')) as TokenPayload;
    if (typeof json.uid !== 'number' || typeof json.exp !== 'number') return null;
    if (json.exp < Math.floor(Date.now() / 1000)) return null;
    return json;
  } catch {
    return null;
  }
}

export async function setSession(userId: number) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = encodeToken({ uid: userId, exp });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export type SessionUser = {
  id: number;
  displayName: string;
  email: string;
  role: 'user' | 'admin';
};

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = decodeToken(token);
    if (!payload) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.uid),
      columns: {
        id: true,
        displayName: true,
        email: true,
        role: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: (user.role as 'user' | 'admin') ?? 'user',
    };
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('Non autorisé. Veuillez vous reconnecter.');
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== 'admin') {
    throw new Error("Accès réservé aux administrateurs.");
  }
  return session;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect('/login');
}

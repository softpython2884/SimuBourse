'use server';

import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import * as d from 'dotenv';
d.config({ path: '.env' });

const secretKey = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Set expiration to 1 day
    .sign(key);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function setSession(userId: number) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  const session = await encrypt({ userId, expires });

  cookies().set('session', session, {
    expires,
    httpOnly: true,
    path: '/',
  });
}

export async function getSession() {
  const cookie = cookies().get('session')?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    return null;
  }
  
  const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId as number),
      columns: {
          id: true,
          displayName: true,
          email: true,
      }
  });

  return user || null;
}

export async function deleteSession() {
  cookies().delete('session');
  redirect('/login');
}

'use server';

import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { users } from './db/schema';

const secretKey = process.env.JWT_SECRET_KEY;
if (!secretKey) {
    throw new Error('JWT_SECRET_KEY is not set in environment variables');
}
const key = new TextEncoder().encode(secretKey);

const SESSION_COOKIE_NAME = 'session';

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (e) {
        return null;
    }
}

export async function setSession(userId: number) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({ userId, expires });
    await (await cookies()).set(SESSION_COOKIE_NAME, session, { expires, httpOnly: true, path: '/' });
}

export async function getSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    const sessionPayload = await decrypt(sessionCookie);
    if (!sessionPayload?.userId) return null;
    
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, sessionPayload.userId),
            columns: {
                id: true,
                displayName: true,
                email: true,
            }
        });
        return user || null;
    } catch (error) {
        console.error("Session user retrieval error:", error);
        return null;
    }
}

export async function deleteSession() {
    (await cookies()).set(SESSION_COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' });
    redirect('/login');
}

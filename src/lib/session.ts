'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import * as d from 'dotenv';
d.config({ path: '.env' });

export async function setSession(userId: number) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  const sessionPayload = { userId };

  cookies().set('session', JSON.stringify(sessionPayload), {
    expires,
    httpOnly: true,
    path: '/',
  });
}

export async function getSession() {
  const cookie = cookies().get('session')?.value;
  if (!cookie) {
    return null;
  }

  try {
    const session = JSON.parse(cookie);
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
  } catch (error) {
    console.error("Session parsing error:", error);
    return null;
  }
}

export async function deleteSession() {
  cookies().delete('session');
  redirect('/login');
}

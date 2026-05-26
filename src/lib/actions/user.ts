'use server';

import { z } from 'zod';
import { users } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { runTransaction } from '@/lib/db/tx';
import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { setSession } from '@/lib/session';

const signupSchema = z.object({
  displayName: z.string().min(3, "Le nom d'utilisateur doit comporter au moins 3 caractères.").max(50),
  email: z.string().email('Adresse e-mail invalide.').max(254),
  password: z.string().min(6, 'Le mot de passe doit comporter au moins 6 caractères.').max(200),
});

export type SignupInput = z.infer<typeof signupSchema>;

export async function signup(values: SignupInput): Promise<{ success?: string; error?: string }> {
  const validatedFields = signupSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: 'Champs invalides.' };
  }

  const { displayName, password } = validatedFields.data;
  const email = validatedFields.data.email.toLowerCase();

  try {
    // Hash outside the transaction (bcrypt is genuinely async/CPU-bound).
    const passwordHash = await bcrypt.hash(password, 10);

    // Uniqueness check, "first user = admin" count, and insert all run inside one
    // serialized transaction so two concurrent signups can't both become admin
    // (or both insert the same email).
    const newUser = await runTransaction(async (tx) => {
      const existingUser = await tx.query.users.findFirst({ where: eq(users.email, email) });
      if (existingUser) throw new Error('EMAIL_TAKEN');

      const userCountRow = await tx.select({ c: sql<number>`cast(count(*) as int)` }).from(users);
      const isFirstUser = (userCountRow[0]?.c ?? 0) === 0;

      const [created] = await tx.insert(users).values({
        displayName,
        email,
        passwordHash,
        role: isFirstUser ? 'admin' : 'user',
      }).returning({ id: users.id });
      return created;
    });

    // Auto-login after signup so the user lands on a real session.
    await setSession(newUser.id);

    return { success: 'Compte créé avec succès ! Redirection...' };
  } catch (error: any) {
    if (error?.message === 'EMAIL_TAKEN' || /UNIQUE constraint/i.test(error?.message ?? '')) {
      return { error: 'Un compte avec cet e-mail existe déjà.' };
    }
    console.error('Signup error:', error);
    return { error: 'Une erreur est survenue lors de la création du compte.' };
  }
}

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export async function login(values: LoginInput): Promise<{ error?: string }> {
  const validatedFields = loginSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: 'Champs invalides.' };
  }
  const email = validatedFields.data.email.toLowerCase();
  const { password } = validatedFields.data;

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!existingUser) {
      return { error: 'Email ou mot de passe incorrect.' };
    }

    const passwordMatch = await bcrypt.compare(password, existingUser.passwordHash);

    if (!passwordMatch) {
      return { error: 'Email ou mot de passe incorrect.' };
    }

    await setSession(existingUser.id);

  } catch (error) {
    console.error('Login error:', error);
    return { error: 'Une erreur est survenue lors de la connexion.' };
  }

  return {};
}

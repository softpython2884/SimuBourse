'use server';

import { z } from 'zod';
import { users } from '@/lib/db/schema';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

const signupSchema = z.object({
  displayName: z.string().min(3, "Le nom d'utilisateur doit comporter au moins 3 caractères."),
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(6, 'Le mot de passe doit comporter au moins 6 caractères.'),
});

export type SignupInput = z.infer<typeof signupSchema>;

export async function signup(values: SignupInput): Promise<{ success?: string; error?: string }> {
  const validatedFields = signupSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: 'Champs invalides.' };
  }

  const { displayName, email, password } = validatedFields.data;

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return { error: 'Un compte avec cet e-mail existe déjà.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(users).values({
      displayName,
      email,
      passwordHash,
    });

    return { success: 'Compte créé avec succès ! Redirection...' };
  } catch (error) {
    console.error('Signup error:', error);
    return { error: 'Une erreur est survenue lors de la création du compte.' };
  }
}

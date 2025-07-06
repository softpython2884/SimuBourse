'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { companies, companyMembers } from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';

const createCompanySchema = z.object({
  name: z.string().min(3, "Le nom doit faire au moins 3 caractères.").max(50),
  industry: z.string().min(3, "L'industrie doit faire au moins 3 caractères.").max(50),
  description: z.string().min(10, "La description doit faire au moins 10 caractères.").max(200),
});

export async function createCompany(values: z.infer<typeof createCompanySchema>): Promise<{ success?: string; error?: string }> {
  const session = await getSession();
  if (!session?.id) {
    return { error: "Vous devez être connecté pour créer une entreprise." };
  }

  const validatedFields = createCompanySchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Données invalides." };
  }
  const { name, industry, description } = validatedFields.data;

  try {
    await db.transaction(async (tx) => {
      // Create the company
      const [newCompany] = await tx.insert(companies).values({
        name,
        industry,
        description,
        creatorId: session.id,
      }).returning();

      // Add the creator as the CEO
      await tx.insert(companyMembers).values({
        companyId: newCompany.id,
        userId: session.id,
        role: 'ceo',
      });
    });

    revalidatePath('/companies');
    return { success: `L'entreprise "${name}" a été créée avec succès !` };
  } catch (error: any) {
    // Check for unique constraint violation
    if (error?.code === '23505') {
        return { error: "Une entreprise avec ce nom existe déjà." };
    }
    console.error("Error creating company:", error);
    return { error: "Une erreur est survenue lors de la création de l'entreprise." };
  }
}

export async function getCompanies() {
  try {
    const allCompanies = await db.query.companies.findMany();
    return allCompanies;
  } catch (error) {
    console.error("Error fetching companies:", error);
    return [];
  }
}

export type Company = Awaited<ReturnType<typeof getCompanies>>[0];

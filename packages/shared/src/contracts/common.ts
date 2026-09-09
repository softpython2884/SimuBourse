import { z } from 'zod';
import { LIMITS } from '../constants.js';

/** A fixed-point value on the wire: the decimal string of a 1e8-scaled integer. */
export const zFixed = z
  .string()
  .regex(/^-?\d{1,40}$/, 'Expected a fixed-point integer string');

/** A human decimal the user typed, e.g. "12.5" — parsed with parseDecimal(). */
export const zDecimalInput = z
  .string()
  .trim()
  .regex(/^\d{1,18}(?:\.\d{1,8})?$/, 'Montant invalide')
  .refine((v) => Number(v) > 0, 'Le montant doit être positif');

export const zId = z.number().int().positive();
export const zTicker = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9.\-]{1,12}$/, 'Ticker invalide');

export const zPagination = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
});
export type Pagination = z.infer<typeof zPagination>;

export const zSort = z.enum(['asc', 'desc']).default('desc');

export const zIsoDate = z.string().datetime();

/** Shape every error response takes, so the client can branch on `code`. */
export const zApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof zApiError>;

export const zDisplayName = z
  .string()
  .trim()
  .min(LIMITS.displayNameMin, `Au moins ${LIMITS.displayNameMin} caractères`)
  .max(LIMITS.displayNameMax, `Au plus ${LIMITS.displayNameMax} caractères`)
  .regex(/^[\p{L}\p{N}_\- ]+$/u, 'Caractères non autorisés');

export const zEmail = z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(254);

export const zPassword = z
  .string()
  .min(LIMITS.passwordMin, `Au moins ${LIMITS.passwordMin} caractères`)
  .max(LIMITS.passwordMax)
  .refine((v) => /[a-z]/.test(v), 'Doit contenir une minuscule')
  .refine((v) => /[A-Z]/.test(v), 'Doit contenir une majuscule')
  .refine((v) => /\d/.test(v), 'Doit contenir un chiffre');

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

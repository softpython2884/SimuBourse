import { z } from 'zod';
import { zDisplayName, zEmail, zId, zPassword } from './common.js';

export const zSignupInput = z.object({
  displayName: zDisplayName,
  email: zEmail,
  password: zPassword,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les conditions' }) }),
});
export type SignupInput = z.infer<typeof zSignupInput>;

export const zLoginInput = z.object({
  email: zEmail,
  password: z.string().min(1, 'Mot de passe requis').max(200),
});
export type LoginInput = z.infer<typeof zLoginInput>;

export const zChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: zPassword,
});

export const zUserRole = z.enum(['user', 'moderator', 'admin']);
export type UserRole = z.infer<typeof zUserRole>;

export const zSessionUser = z.object({
  id: zId,
  displayName: z.string(),
  email: z.string(),
  role: zUserRole,
  avatarColor: z.string(),
  createdAt: z.string(),
});
export type SessionUser = z.infer<typeof zSessionUser>;

export const zAuthResponse = z.object({
  user: zSessionUser,
  /** Short-lived token, also set as an httpOnly cookie. Sent so the socket can authenticate. */
  accessToken: z.string(),
  expiresIn: z.number().int(),
});
export type AuthResponse = z.infer<typeof zAuthResponse>;

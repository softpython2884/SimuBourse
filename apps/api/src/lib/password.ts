import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with Node's built-in scrypt.
 *
 * bcrypt (used by the legacy app) needs a native build step that breaks on every
 * Node upgrade and silently truncates inputs at 72 bytes. scrypt ships with Node,
 * is memory-hard, and needs no compiler on the deployment host.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Refuse absurd parameters from a tampered row instead of exhausting memory.
  if (N > 2 ** 17 || r > 16 || p > 4) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashRaw ?? '', 'base64url');
  } catch {
    return false;
  }
  const derived = await scrypt(password.normalize('NFKC'), Buffer.from(saltRaw ?? '', 'base64url'), expected.length, {
    N,
    r,
    p,
    maxmem: 96 * 1024 * 1024,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Burn roughly the same time as a real verification when the account does not
 * exist, so response timing does not leak which e-mails are registered.
 */
export async function fakeVerify(): Promise<void> {
  await scrypt('timing-equalizer', randomBytes(SALT_LENGTH), KEY_LENGTH, PARAMS);
}

import { createHash, randomBytes, randomInt } from 'node:crypto';
import { CHAINS, type ChainSymbol } from '@alvora/shared';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const HEX = '0123456789abcdef';

function randomFrom(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** Generate a chain-shaped wallet address. Uniqueness is enforced by the DB index. */
export function generateAddress(chain: ChainSymbol): string {
  const spec = CHAINS[chain];
  const bodyLength = Math.max(8, spec.addressLength - spec.addressPrefix.length);
  const alphabet = spec.addressPrefix.startsWith('0x') ? HEX : BASE58;
  return spec.addressPrefix + randomFrom(alphabet, bodyLength);
}

/** Deterministic-looking transaction hash. */
export function generateTxHash(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex');
}

export function generateBlockHash(chain: string, height: number): string {
  return createHash('sha256').update(`${chain}:${height}:${randomBytes(8).toString('hex')}`).digest('hex');
}

/** Basic shape check before hitting the database on a user-supplied address. */
export function looksLikeAddress(address: string): boolean {
  return Object.values(CHAINS).some(
    (spec) => address.startsWith(spec.addressPrefix) && address.length === spec.addressLength,
  );
}

export function chainForAddress(address: string): ChainSymbol | null {
  for (const [symbol, spec] of Object.entries(CHAINS)) {
    if (address.startsWith(spec.addressPrefix) && address.length === spec.addressLength) {
      return symbol as ChainSymbol;
    }
  }
  return null;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Directional class for a signed value, paired with a sign in the label. */
export function trendClass(value: string | bigint | number | null | undefined): string {
  const n = typeof value === 'bigint' ? value : BigInt(String(value ?? '0').split('.')[0] || '0');
  if (n > 0n) return 'val-up';
  if (n < 0n) return 'val-down';
  return 'val-flat';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

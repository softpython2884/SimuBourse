import { CURRENCY_SYMBOL } from './constants.js';
import { DECIMALS, fromWire, toDecimalString, toNumber, type Fixed, type FixedString } from './decimal.js';

type Input = Fixed | FixedString | null | undefined;

const toFixedValue = (value: Input): Fixed => fromWire(value as FixedString);

/** Number of decimals worth showing for a price of this magnitude. */
export function priceDecimals(value: Fixed): number {
  const abs = value < 0n ? -value : value;
  if (abs === 0n) return 2;
  if (abs < 100_000n) return 8; // < 0.001
  if (abs < 10_000_000n) return 6; // < 0.1
  if (abs < 1_000_000_000n) return 4; // < 10
  return 2;
}

export interface FormatOptions {
  decimals?: number;
  locale?: string;
  compact?: boolean;
  signed?: boolean;
}

function group(value: string, locale: string, decimals: number, compact: boolean): string {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');

  if (compact) {
    const magnitude = whole.length;
    const tiers: Array<[number, string]> = [[13, 'T'], [10, 'Md'], [7, 'M'], [4, 'k']];
    for (const [digits, suffix] of tiers) {
      if (magnitude >= digits) {
        const head = whole.slice(0, magnitude - digits + 1);
        const tail = whole.slice(magnitude - digits + 1, magnitude - digits + 3);
        return `${negative ? '-' : ''}${head}${tail ? ',' + tail : ''}${suffix}`;
      }
    }
  }

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, locale.startsWith('fr') ? ' ' : ',');
  const sep = locale.startsWith('fr') ? ',' : '.';
  const shown = decimals > 0 ? sep + fraction.padEnd(decimals, '0').slice(0, decimals) : '';
  return `${negative ? '-' : ''}${grouped}${shown}`;
}

/** Format a fixed-point amount as platform currency. */
export function formatMoney(value: Input, options: FormatOptions = {}): string {
  const fixed = toFixedValue(value);
  const { decimals = 2, locale = 'fr-FR', compact = false, signed = false } = options;
  const body = group(toDecimalString(fixed, Math.min(decimals, DECIMALS)), locale, decimals, compact);
  const sign = signed && fixed > 0n ? '+' : '';
  return `${sign}${body} ${CURRENCY_SYMBOL}`;
}

/** Format a price, choosing decimals from its magnitude so small coins stay readable. */
export function formatPrice(value: Input, options: FormatOptions = {}): string {
  const fixed = toFixedValue(value);
  return formatMoney(fixed, { decimals: priceDecimals(fixed), ...options });
}

/** Format an asset quantity (never shows a currency symbol). */
export function formatQuantity(value: Input, options: FormatOptions = {}): string {
  const fixed = toFixedValue(value);
  const { decimals = 8, locale = 'fr-FR', compact = false } = options;
  const trimmed = toDecimalString(fixed, decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const shownDecimals = trimmed.includes('.') ? (trimmed.split('.')[1]?.length ?? 0) : 0;
  return group(trimmed, locale, shownDecimals, compact);
}

/** Format a fixed-point percentage value ("2.50" → "+2,50 %"). */
export function formatPercent(value: Input, options: FormatOptions = {}): string {
  const fixed = toFixedValue(value);
  const { decimals = 2, locale = 'fr-FR', signed = true } = options;
  const body = group(toDecimalString(fixed, decimals), locale, decimals, false);
  const sign = signed && fixed > 0n ? '+' : '';
  return `${sign}${body} %`;
}

/** Format a large count (volumes, market caps) compactly. */
export function formatCompact(value: Input, locale = 'fr-FR'): string {
  return group(toDecimalString(toFixedValue(value), 2), locale, 2, true);
}

export function signOf(value: Input): -1 | 0 | 1 {
  const fixed = toFixedValue(value);
  return fixed > 0n ? 1 : fixed < 0n ? -1 : 0;
}

/** Chart-friendly plain number. Lossy — display only. */
export function toChartNumber(value: Input): number {
  return toNumber(toFixedValue(value));
}

export function formatRelativeTime(iso: string | number | Date, now = new Date()): string {
  const then = iso instanceof Date ? iso : new Date(iso);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  const abs = Math.abs(seconds);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'], [3600, 'minute'], [86400, 'hour'], [604800, 'day'], [2629800, 'week'],
    [31557600, 'month'], [Infinity, 'year'],
  ];
  const divisors = [1, 60, 3600, 86400, 604800, 2629800, 31557600];
  for (let i = 0; i < units.length; i++) {
    const entry = units[i];
    const divisor = divisors[i];
    if (entry && divisor !== undefined && abs < entry[0]) {
      const fmt = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
      return fmt.format(-Math.round(seconds / divisor), entry[1]);
    }
  }
  return then.toLocaleDateString('fr-FR');
}

/** Deterministic accent colour for a player or company, from its id. */
export function colorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const saturation = 62 + (hash % 18);
  const lightness = 48 + ((hash >> 3) % 12);
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 10000;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * value).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

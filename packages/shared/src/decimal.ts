/**
 * Alvora fixed-point arithmetic.
 *
 * Every monetary amount, asset quantity and price in Alvora is an exact integer
 * scaled by 1e8 and carried as a `bigint`. Floating point is never used for value:
 * the legacy platform stored money as SQL `real`/`numeric` and did arithmetic in JS
 * numbers, which produced drifting balances and the infamous `$NaN` prices.
 *
 * Wire format is the decimal string of the scaled integer (e.g. "12345678900"),
 * because JSON cannot represent bigint. Never send a JS number for a value.
 */

/** Number of decimal places kept for every value in the system. */
export const DECIMALS = 8;

/** Scale factor: one whole unit expressed in fixed-point. */
export const ONE = 100_000_000n; // 10n ** 8n

/** Zero, for readability at call sites. */
export const ZERO = 0n;

/** A fixed-point value: an integer scaled by {@link ONE}. */
export type Fixed = bigint;

/** The wire representation of a {@link Fixed}: its decimal string. */
export type FixedString = string;

export class DecimalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecimalError';
  }
}

const DECIMAL_RE = /^-?(?:\d+)(?:\.\d+)?$/;

/**
 * Parse a human decimal string ("1234.56") into fixed-point.
 * Extra precision beyond 8 decimals is truncated toward zero rather than rounded,
 * so a user can never gain value from a long input.
 */
export function parseDecimal(input: string | number): Fixed {
  const raw = typeof input === 'number' ? numberToDecimalString(input) : input.trim();
  if (raw === '') throw new DecimalError('Empty decimal input');
  const normalized = raw.replace(/_/g, '').replace(/\s/g, '');
  if (!DECIMAL_RE.test(normalized)) throw new DecimalError(`Invalid decimal: ${raw}`);

  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const padded = (fraction + '0'.repeat(DECIMALS)).slice(0, DECIMALS);
  const value = BigInt(whole) * ONE + BigInt(padded || '0');
  return negative ? -value : value;
}

function numberToDecimalString(n: number): string {
  if (!Number.isFinite(n)) throw new DecimalError(`Non-finite number: ${n}`);
  // toFixed(8) avoids exponential notation for very small/large magnitudes.
  return Math.abs(n) < 1e21 ? n.toFixed(DECIMALS) : BigInt(Math.trunc(n)).toString();
}

/** Parse a wire string (already-scaled integer) into fixed-point. */
export function fromWire(value: FixedString | bigint | null | undefined): Fixed {
  if (value === null || value === undefined) return ZERO;
  if (typeof value === 'bigint') return value;
  const trimmed = value.trim();
  if (trimmed === '') return ZERO;
  // Postgres numeric can round-trip as "123.000" — drop any zero fraction.
  const dot = trimmed.indexOf('.');
  const intPart = dot === -1 ? trimmed : trimmed.slice(0, dot);
  if (!/^-?\d+$/.test(intPart)) throw new DecimalError(`Invalid wire value: ${value}`);
  return BigInt(intPart);
}

/** Serialize fixed-point for the wire / database. */
export function toWire(value: Fixed): FixedString {
  return value.toString();
}

/** Convert fixed-point to a human decimal string ("1234.56000000"). */
export function toDecimalString(value: Fixed, decimals: number = DECIMALS): string {
  if (decimals < 0 || decimals > DECIMALS) {
    throw new DecimalError(`decimals must be within 0..${DECIMALS}`);
  }
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const whole = abs / ONE;
  const fraction = (abs % ONE).toString().padStart(DECIMALS, '0');
  const shown = decimals === 0 ? '' : '.' + fraction.slice(0, decimals);
  return `${negative ? '-' : ''}${whole}${shown}`;
}

/**
 * Convert to a JS number. Lossy by construction — only for charts, ratios and
 * display maths. Never feed the result back into a balance.
 */
export function toNumber(value: Fixed): number {
  return Number(value) / Number(ONE);
}

/** Build fixed-point from whole units (e.g. `units(100)` === 100.00000000). */
export function units(whole: number | bigint): Fixed {
  return BigInt(whole) * ONE;
}

// ---------------------------------------------------------------------------
// Arithmetic. Multiplication and division rescale, so they must never be done
// with plain `*` / `/` on fixed-point values.
// ---------------------------------------------------------------------------

export type Rounding = 'trunc' | 'floor' | 'ceil' | 'half-up';

function divRound(numerator: bigint, denominator: bigint, mode: Rounding): bigint {
  if (denominator === ZERO) throw new DecimalError('Division by zero');
  const negative = numerator < ZERO !== denominator < ZERO;
  const absN = numerator < ZERO ? -numerator : numerator;
  const absD = denominator < ZERO ? -denominator : denominator;
  const q = absN / absD;
  const r = absN % absD;
  if (r === ZERO) return negative ? -q : q;

  switch (mode) {
    case 'trunc':
      return negative ? -q : q;
    case 'floor':
      return negative ? -(q + 1n) : q;
    case 'ceil':
      return negative ? -q : q + 1n;
    case 'half-up':
      return r * 2n >= absD ? (negative ? -(q + 1n) : q + 1n) : negative ? -q : q;
  }
}

/** a × b, both fixed-point, result fixed-point. */
export function mul(a: Fixed, b: Fixed, mode: Rounding = 'trunc'): Fixed {
  return divRound(a * b, ONE, mode);
}

/** a ÷ b, both fixed-point, result fixed-point. */
export function div(a: Fixed, b: Fixed, mode: Rounding = 'trunc'): Fixed {
  return divRound(a * ONE, b, mode);
}

/** Multiply by a plain integer count (no rescaling). */
export function mulInt(a: Fixed, n: number | bigint): Fixed {
  return a * BigInt(n);
}

/** a × (numerator / denominator) using integer ratios — exact, no rescaling drift. */
export function mulRatio(a: Fixed, numerator: bigint, denominator: bigint, mode: Rounding = 'trunc'): Fixed {
  return divRound(a * numerator, denominator, mode);
}

/** Basis-point helper: 250 bps === 2.50%. */
export function bps(a: Fixed, basisPoints: number, mode: Rounding = 'half-up'): Fixed {
  return divRound(a * BigInt(Math.round(basisPoints)), 10_000n, mode);
}

/** Percentage of `a`, expressed in fixed-point percent (e.g. `parseDecimal('2.5')`). */
export function percentOf(a: Fixed, percent: Fixed, mode: Rounding = 'trunc'): Fixed {
  return divRound(a * percent, ONE * 100n, mode);
}

export const abs = (a: Fixed): Fixed => (a < ZERO ? -a : a);
export const neg = (a: Fixed): Fixed => -a;
export const min = (a: Fixed, b: Fixed): Fixed => (a < b ? a : b);
export const max = (a: Fixed, b: Fixed): Fixed => (a > b ? a : b);
export const isZero = (a: Fixed): boolean => a === ZERO;
export const isPositive = (a: Fixed): boolean => a > ZERO;
export const isNegative = (a: Fixed): boolean => a < ZERO;
export const clamp = (value: Fixed, low: Fixed, high: Fixed): Fixed => min(max(value, low), high);

/** Round a fixed-point value to `places` decimals (used for display prices and cash). */
export function round(value: Fixed, places: number, mode: Rounding = 'half-up'): Fixed {
  if (places >= DECIMALS) return value;
  const factor = 10n ** BigInt(DECIMALS - places);
  return divRound(value, factor, mode) * factor;
}

/** Cash is always settled to 2 decimals so balances stay presentable and exact. */
export function toCash(value: Fixed, mode: Rounding = 'half-up'): Fixed {
  return round(value, 2, mode);
}

/**
 * Notional value of `quantity` units at `price` per unit.
 * Truncated in the platform's favour is wrong for a buyer and right for a seller,
 * so callers pass the rounding they need; the default is half-up on cash cents.
 */
export function notional(quantity: Fixed, price: Fixed, mode: Rounding = 'half-up'): Fixed {
  return round(mul(quantity, price, 'trunc'), 2, mode);
}

/**
 * Percentage change from `from` to `to`, as fixed-point percent.
 * Returns 0 when `from` is zero instead of producing Infinity/NaN — the exact
 * bug that rendered "$NaN" all over the legacy market screens.
 */
export function pctChange(from: Fixed, to: Fixed): Fixed {
  if (from === ZERO) return ZERO;
  return divRound((to - from) * ONE * 100n, from, 'half-up');
}

/** Sum a list exactly. */
export function sum(values: Iterable<Fixed>): Fixed {
  let total = ZERO;
  for (const v of values) total += v;
  return total;
}

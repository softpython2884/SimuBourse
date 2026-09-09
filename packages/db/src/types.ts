import { customType } from 'drizzle-orm/pg-core';

/**
 * Exact fixed-point column: a 1e8-scaled integer stored as `numeric(40, 0)` and
 * carried in JS as `bigint`.
 *
 * `numeric` rather than `bigint`/int8 because int8 tops out around 9.2e18, which
 * at scale 1e8 is only ~92 billion currency units — reachable in a game with
 * compounding companies. `numeric(40,0)` is exact and effectively unbounded.
 */
export const fixed = customType<{ data: bigint; driverData: string; notNull: false; default: false }>({
  dataType() {
    return 'numeric(40, 0)';
  },
  fromDriver(value: string): bigint {
    // Postgres may hand back "123" or "123.000" depending on the driver path.
    const dot = value.indexOf('.');
    return BigInt(dot === -1 ? value : value.slice(0, dot));
  },
  toDriver(value: bigint): string {
    return value.toString();
  },
});

/** Non-negative hashrate / counters that can exceed 2^31. */
export const bigCount = customType<{ data: number; driverData: string }>({
  dataType() {
    return 'bigint';
  },
  fromDriver(value: string): number {
    return Number(value);
  },
  toDriver(value: number): string {
    return Math.trunc(value).toString();
  },
});

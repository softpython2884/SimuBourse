/**
 * Seeded pseudo-randomness for the simulation.
 *
 * The engine uses a seeded PRNG rather than Math.random so a market session can be
 * replayed from its seed when investigating a price move, and so restarting the
 * process does not reset the sequence to the same place.
 */
export class Random {
  private state: number;

  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** mulberry32 — small, fast, good enough for a game simulation. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal via Box–Muller, for the price random walk. */
  normal(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  int(minInclusive: number, maxExclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[this.int(0, items.length)] as T;
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  get seed(): number {
    return this.state;
  }
}

export const random = new Random();

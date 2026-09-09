import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DECIMALS,
  DecimalError,
  ONE,
  ZERO,
  bps,
  clamp,
  div,
  fromWire,
  mul,
  mulRatio,
  notional,
  parseDecimal,
  pctChange,
  round,
  sum,
  toCash,
  toDecimalString,
  toNumber,
  units,
} from './decimal.js';

test('parseDecimal keeps exact value at full precision', () => {
  assert.equal(parseDecimal('1'), ONE);
  assert.equal(parseDecimal('0.00000001'), 1n);
  assert.equal(parseDecimal('67850.00'), 6_785_000_000_000n);
  assert.equal(parseDecimal('-12.5'), -1_250_000_000n);
});

test('parseDecimal truncates excess precision toward zero', () => {
  // A user pasting more than 8 decimals must never round *up* into value they
  // did not have.
  assert.equal(parseDecimal('0.999999999'), 99_999_999n);
  assert.equal(parseDecimal('-0.999999999'), -99_999_999n);
});

test('parseDecimal rejects malformed input instead of yielding NaN', () => {
  for (const bad of ['', 'abc', '1.2.3', '1e5', '--1', '1,5', 'Infinity', 'NaN']) {
    assert.throws(() => parseDecimal(bad), DecimalError, `expected ${bad} to throw`);
  }
});

test('the legacy $NaN cases are representable as zero, never NaN', () => {
  // The legacy UI divided by a zero cost basis and rendered "$NaN".
  assert.equal(pctChange(ZERO, units(100)), ZERO);
  assert.equal(pctChange(ZERO, ZERO), ZERO);
  assert.equal(toDecimalString(pctChange(ZERO, units(5))), '0.00000000');
});

test('multiplication rescales instead of squaring the scale', () => {
  assert.equal(mul(units(2), units(3)), units(6));
  assert.equal(mul(parseDecimal('0.5'), parseDecimal('0.5')), parseDecimal('0.25'));
  assert.equal(mul(ZERO, units(1000)), ZERO);
});

test('division rescales and refuses a zero divisor', () => {
  assert.equal(div(units(6), units(3)), units(2));
  assert.equal(div(units(1), units(4)), parseDecimal('0.25'));
  assert.throws(() => div(units(1), ZERO), DecimalError);
});

test('division truncates rather than producing a repeating float', () => {
  // 1/3 has no exact representation; the result must be deterministic and
  // never exceed the true value.
  const third = div(units(1), units(3));
  assert.equal(third, 33_333_333n);
  assert.ok(mul(third, units(3)) <= units(1));
});

test('rounding modes behave at the midpoint', () => {
  assert.equal(round(parseDecimal('1.005'), 2), parseDecimal('1.01'));
  assert.equal(round(parseDecimal('1.004'), 2), parseDecimal('1.00'));
  assert.equal(round(parseDecimal('-1.005'), 2), parseDecimal('-1.01'));
  assert.equal(round(parseDecimal('2.5'), 0), parseDecimal('3'));
});

test('notional is exact for a crypto-sized trade', () => {
  const quantity = parseDecimal('0.12345678');
  const price = parseDecimal('67850.00');
  // 0.12345678 * 67850 = 8376.5426... -> 8376.54 after cash rounding
  assert.equal(toDecimalString(notional(quantity, price), 2), '8376.54');
});

test('basis points are exact and symmetric', () => {
  const amount = parseDecimal('10000');
  assert.equal(toDecimalString(bps(amount, 20), 2), '20.00');
  assert.equal(toDecimalString(bps(amount, 5), 2), '5.00');
  assert.equal(bps(ZERO, 250), ZERO);
});

test('mulRatio distributes a pool with no leak', () => {
  // The dividend/settlement invariant: the parts must sum back to the whole.
  const pool = parseDecimal('1000');
  const stakes = [parseDecimal('333'), parseDecimal('333'), parseDecimal('334')];
  const total = sum(stakes);

  const payouts = stakes.map((stake) => mulRatio(pool, stake, total));
  const distributed = sum(payouts);

  // Truncation may leave a remainder, but it can only ever be *under* the pool:
  // paying out more than was collected would mint money.
  assert.ok(distributed <= pool, `${distributed} must not exceed ${pool}`);
  assert.ok(pool - distributed < BigInt(stakes.length), 'remainder must be dust');
});

test('a thousand round trips do not drift', () => {
  // The float version of this loop ends at 99999.99999999859.
  let balance = parseDecimal('100000');
  for (let i = 0; i < 1000; i++) {
    balance -= notional(parseDecimal('0.1'), parseDecimal('33.33'));
    balance += notional(parseDecimal('0.1'), parseDecimal('33.33'));
  }
  assert.equal(balance, parseDecimal('100000'));
});

test('average cost stays exact across many partial fills', () => {
  let quantity = ZERO;
  let averageCost = ZERO;
  for (let i = 1; i <= 100; i++) {
    const fillQty = parseDecimal('0.017');
    const fillPrice = parseDecimal(String(100 + i));
    const previousCost = mul(quantity, averageCost);
    const addedCost = mul(fillQty, fillPrice);
    quantity += fillQty;
    averageCost = div(previousCost + addedCost, quantity);
  }
  // Weighted mean of 101..200 is 150.5; truncation keeps us just under it.
  const shown = Number(toDecimalString(averageCost, 4));
  assert.ok(shown > 150.4 && shown <= 150.5, `average cost ${shown} out of range`);
});

test('toDecimalString pads and truncates without exponent notation', () => {
  assert.equal(toDecimalString(parseDecimal('0.1'), 8), '0.10000000');
  assert.equal(toDecimalString(parseDecimal('1234.5'), 2), '1234.50');
  assert.equal(toDecimalString(parseDecimal('0.00000001'), 8), '0.00000001');
  assert.equal(toDecimalString(units(1_000_000_000), 0), '1000000000');
  assert.equal(toDecimalString(-1n, 8), '-0.00000001');
});

test('wire values round-trip, including a Postgres numeric with a zero fraction', () => {
  assert.equal(fromWire('6785000000000'), 6_785_000_000_000n);
  assert.equal(fromWire('6785000000000.000'), 6_785_000_000_000n);
  assert.equal(fromWire('-42'), -42n);
  assert.equal(fromWire(null), ZERO);
  assert.equal(fromWire(''), ZERO);
  assert.throws(() => fromWire('oops'), DecimalError);
});

test('toCash settles to two decimals', () => {
  assert.equal(toDecimalString(toCash(parseDecimal('10.005')), 8), '10.01000000');
  assert.equal(toDecimalString(toCash(parseDecimal('10.004')), 8), '10.00000000');
});

test('clamp bounds a price inside its circuit breaker', () => {
  const low = parseDecimal('90');
  const high = parseDecimal('110');
  assert.equal(clamp(parseDecimal('120'), low, high), high);
  assert.equal(clamp(parseDecimal('80'), low, high), low);
  assert.equal(clamp(parseDecimal('100'), low, high), parseDecimal('100'));
});

test('pctChange matches the arithmetic in both directions', () => {
  assert.equal(toDecimalString(pctChange(units(100), units(110)), 2), '10.00');
  assert.equal(toDecimalString(pctChange(units(100), units(90)), 2), '-10.00');
  assert.equal(toDecimalString(pctChange(units(200), units(200)), 2), '0.00');
});

test('toNumber is lossy only where it is allowed to be', () => {
  assert.equal(toNumber(units(100)), 100);
  assert.equal(toNumber(parseDecimal('0.5')), 0.5);
  assert.equal(DECIMALS, 8);
});

test('values far beyond a float-safe integer stay exact', () => {
  // 10 trillion currency units — a late-game company treasury. As a JS number
  // this loses cents; as a scaled bigint it does not.
  const huge = parseDecimal('10000000000000.07');
  assert.equal(toDecimalString(huge, 2), '10000000000000.07');
  assert.equal(toDecimalString(huge + parseDecimal('0.01'), 2), '10000000000000.08');
});

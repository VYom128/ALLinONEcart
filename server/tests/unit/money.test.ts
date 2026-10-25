import { describe, expect, it } from 'vitest';
import { assertPaise, paiseToRupeeString, rupeesToPaise } from '../../src/utils/money.js';

describe('rupeesToPaise', () => {
  it('converts rupee strings exactly', () => {
    expect(rupeesToPaise('1499.99')).toBe(149999);
    expect(rupeesToPaise('0.29')).toBe(29);
    expect(rupeesToPaise('0.07')).toBe(7);
    expect(rupeesToPaise('10.5')).toBe(1050);
    expect(rupeesToPaise('100')).toBe(10000);
    expect(rupeesToPaise(' 1,49,999.50 ')).toBe(14999950);
  });

  it('has no floating-point errors on values that are inexact as floats', () => {
    // As floats, 0.29 * 100 = 28.999999999999996 and 19.99 * 100 = 1998.9999999999998.
    expect(rupeesToPaise(0.29)).toBe(29);
    expect(rupeesToPaise(1499.99)).toBe(149999);
    expect(rupeesToPaise(19.99)).toBe(1999);
    for (let paise = 0; paise <= 10_000; paise += 1) {
      expect(rupeesToPaise(paiseToRupeeString(paise))).toBe(paise);
    }
  });

  it('rejects negatives', () => {
    expect(() => rupeesToPaise('-5')).toThrow(RangeError);
    expect(() => rupeesToPaise(-5)).toThrow(RangeError);
  });

  it('rejects more than 2 decimals, non-numbers and unsafe amounts', () => {
    expect(() => rupeesToPaise('1.234')).toThrow(RangeError);
    expect(() => rupeesToPaise(0.1 + 0.2)).toThrow(RangeError);
    expect(() => rupeesToPaise('abc')).toThrow(RangeError);
    expect(() => rupeesToPaise('')).toThrow(RangeError);
    expect(() => rupeesToPaise(Number.NaN)).toThrow(RangeError);
    expect(() => rupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => rupeesToPaise('99999999999999999')).toThrow(RangeError);
  });

  it('never puts the amount in the error message', () => {
    expect(() => rupeesToPaise('-123456')).toThrow(/^(?!.*123456).*$/);
  });
});

describe('assertPaise', () => {
  it('accepts safe non-negative integers', () => {
    expect(() => assertPaise(0)).not.toThrow();
    expect(() => assertPaise(149999)).not.toThrow();
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, '100', null])(
    'rejects %s',
    (value) => {
      expect(() => assertPaise(value)).toThrow(RangeError);
    },
  );
});

describe('paiseToRupeeString', () => {
  it('formats with 2 decimals', () => {
    expect(paiseToRupeeString(149999)).toBe('1499.99');
    expect(paiseToRupeeString(5)).toBe('0.05');
    expect(paiseToRupeeString(0)).toBe('0.00');
    expect(paiseToRupeeString(100)).toBe('1.00');
  });
});

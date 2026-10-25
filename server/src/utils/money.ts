// Money is integer paise (spec §3.7, §8.1). Never floats; format only at the edge.
// Errors here never include the amount, because money values must not reach the logs.

/** Largest single amount: ₹100 crore (spec §8.1). Totals may exceed it. */
export const MAX_AMOUNT_PAISE = 1_000_000_000_000;

/**
 * Asserts that `n` is a valid paise amount: a safe integer ≥ 0.
 * @param n - value to check
 * @throws RangeError if it is not
 */
export function assertPaise(n: unknown): asserts n is number {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
    throw new RangeError('Amount must be a non-negative whole number of paise');
  }
}

const RUPEES = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Converts rupees to paise without floating-point errors, e.g. `'1499.99'` → `149999`.
 * Accepts at most 2 decimal places; a string may contain thousands commas (`'1,49,999.50'`).
 * @param rupees - amount in rupees, as a string or number
 * @throws RangeError for negative, non-numeric, over-precise or unsafe amounts
 */
export function rupeesToPaise(rupees: string | number): number {
  let text: string;
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees) || rupees < 0) {
      throw new RangeError('Amount must be a non-negative number of rupees');
    }
    text = rupees.toFixed(2);
    if (Number(text) !== rupees) {
      throw new RangeError('Amount must have at most 2 decimal places');
    }
  } else {
    text = rupees.trim().replaceAll(',', '');
  }

  const match = RUPEES.exec(text);
  if (!match) throw new RangeError('Amount must be rupees with at most 2 decimal places');

  const [, whole = '', fraction = ''] = match;
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  assertPaise(paise);
  return paise;
}

/**
 * Formats paise as a plain rupee string with 2 decimals, e.g. `149999` → `'1499.99'`.
 * For display in the app use `formatINR` (adds ₹ and Indian grouping).
 * @param paise - a valid paise amount
 */
export function paiseToRupeeString(paise: number): string {
  assertPaise(paise);
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return `${rupees}.${String(rest).padStart(2, '0')}`;
}

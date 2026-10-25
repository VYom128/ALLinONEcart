import { describe, expect, it } from 'vitest';
import {
  CART_STATUSES,
  GOAL_STATUSES,
  STATE_MACHINES,
  canTransition,
  isInitialStatus,
  type CartStatus,
  type GoalStatus,
} from '../src/index.js';

// The tables from spec §5.1, written out independently of the implementation.
const CART_ALLOWED: [CartStatus, CartStatus][] = [
  ['waiting', 'in_cart'],
  ['in_cart', 'bought'],
  ['waiting', 'bought'],
  ['in_cart', 'removed'],
  ['waiting', 'removed'],
  ['removed', 'in_cart'],
  ['bought', 'in_cart'],
];

const GOAL_ALLOWED: [GoalStatus, GoalStatus][] = [
  ['active', 'saving'],
  ['saving', 'active'],
  ['active', 'achieved'],
  ['saving', 'achieved'],
  ['active', 'dropped'],
  ['saving', 'dropped'],
  ['dropped', 'active'],
  ['dropped', 'saving'],
  ['achieved', 'active'],
  ['achieved', 'saving'],
];

function allPairs<S extends string>(statuses: readonly S[]): [S, S][] {
  return statuses.flatMap((from) => statuses.map((to): [S, S] => [from, to]));
}

describe('STATE_MACHINES.cartItem', () => {
  const machine = STATE_MACHINES.cartItem;

  it.each(CART_ALLOWED)('allows %s → %s', (from, to) => {
    expect(canTransition(machine, from, to)).toBe(true);
  });

  it.each([
    ['bought', 'removed'],
    ['removed', 'bought'],
    ['in_cart', 'waiting'],
    ['bought', 'waiting'],
    ['in_cart', 'in_cart'],
  ] as [CartStatus, CartStatus][])('rejects %s → %s', (from, to) => {
    expect(canTransition(machine, from, to)).toBe(false);
  });

  it('allows exactly the transitions in the spec table', () => {
    const allowed = allPairs(CART_STATUSES).filter(([from, to]) =>
      canTransition(machine, from, to),
    );
    expect(allowed).toEqual(expect.arrayContaining(CART_ALLOWED));
    expect(allowed).toHaveLength(CART_ALLOWED.length);
  });

  it('starts new cart items in in_cart (or waiting in V2)', () => {
    expect(isInitialStatus(machine, 'in_cart')).toBe(true);
    expect(isInitialStatus(machine, 'waiting')).toBe(true);
    expect(isInitialStatus(machine, 'bought')).toBe(false);
  });
});

describe('STATE_MACHINES.goal', () => {
  const machine = STATE_MACHINES.goal;

  it.each(GOAL_ALLOWED)('allows %s → %s', (from, to) => {
    expect(canTransition(machine, from, to)).toBe(true);
  });

  it.each([
    ['achieved', 'dropped'],
    ['dropped', 'achieved'],
    ['active', 'active'],
    ['saving', 'saving'],
  ] as [GoalStatus, GoalStatus][])('rejects %s → %s', (from, to) => {
    expect(canTransition(machine, from, to)).toBe(false);
  });

  it('allows exactly the transitions in the spec table', () => {
    const allowed = allPairs(GOAL_STATUSES).filter(([from, to]) =>
      canTransition(machine, from, to),
    );
    expect(allowed).toEqual(expect.arrayContaining(GOAL_ALLOWED));
    expect(allowed).toHaveLength(GOAL_ALLOWED.length);
  });

  it('starts new goals in active only', () => {
    expect(isInitialStatus(machine, 'active')).toBe(true);
    expect(isInitialStatus(machine, 'saving')).toBe(false);
  });
});

describe('Cart and Goals stay separate (spec D6)', () => {
  it('have no status in common', () => {
    const shared = CART_STATUSES.filter((s) => (GOAL_STATUSES as readonly string[]).includes(s));
    expect(shared).toEqual([]);
  });

  it('never allow a cart status to move to a goal status', () => {
    const cart = STATE_MACHINES.cartItem as unknown as Parameters<typeof canTransition>[0];
    for (const from of CART_STATUSES) {
      for (const to of GOAL_STATUSES) {
        expect(canTransition(cart, from, to)).toBe(false);
      }
    }
  });
});

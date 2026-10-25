// Enums and state machines shared by the server and the mobile app (spec §1.4, §5).
// Cart and Goals are separate sections (spec D6): separate statuses and separate machines.
// No transition ever crosses from one section to the other.

/** The two sections of the app. Categories carry one of these. */
export const SECTIONS = ['cart', 'goal'] as const;
export type Section = (typeof SECTIONS)[number];

/** Cart item status (spec §5.1). `waiting` is the V2 cooling-off state (§8.9). */
export const CART_STATUSES = ['in_cart', 'waiting', 'bought', 'removed'] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

/** Goal status (spec §5.1). */
export const GOAL_STATUSES = ['active', 'saving', 'achieved', 'dropped'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Goal horizon (Goals only, spec §1.4). */
export const GOAL_HORIZONS = ['this_year', 'big_goal', 'life_goal'] as const;
export type GoalHorizon = (typeof GOAL_HORIZONS)[number];

/** Priority (both sections, spec §1.4). */
export const PRIORITIES = ['must_have', 'want', 'dream'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A state machine: for each status, the statuses it may move to, and the first status. */
export interface StateMachine<S extends string> {
  readonly initial: readonly S[];
  readonly transitions: { readonly [From in S]: readonly S[] };
}

/** Cart item machine (spec §5.1). */
const cartItem: StateMachine<CartStatus> = {
  // Saved → in_cart; V2: waiting when cooling-off applies.
  initial: ['in_cart', 'waiting'],
  transitions: {
    in_cart: ['bought', 'removed'], // POST /cart/:id/bought, /remove
    waiting: ['in_cart', 'bought', 'removed'], // cooling-off ends (job), bought, remove
    bought: ['in_cart'], // POST /cart/:id/unbuy (undo within 7 days)
    removed: ['in_cart'], // POST /cart/:id/restore
  },
};

/** Goal machine (spec §5.1). */
const goal: StateMachine<GoalStatus> = {
  initial: ['active'],
  transitions: {
    active: ['saving', 'achieved', 'dropped'], // first contribution, achieve, drop
    saving: ['active', 'achieved', 'dropped'], // all contributions removed, achieve, drop
    achieved: ['active', 'saving'], // POST /goals/:id/unachieve (undo within 7 days)
    dropped: ['active', 'saving'], // POST /goals/:id/restore (saving if contributions exist)
  },
};

/** All state machines. Every status change calls `canTransition` / `assertTransition`. */
export const STATE_MACHINES = Object.freeze({ cartItem, goal });
export type MachineName = keyof typeof STATE_MACHINES;

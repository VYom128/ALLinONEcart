import type { StateMachine } from './enums.js';

/**
 * Whether a machine allows moving from `from` to `to`. Staying in the same status is not a
 * transition. The server's `assertTransition()` wraps this and throws 409
 * INVALID_STATUS_TRANSITION.
 * @param machine - e.g. `STATE_MACHINES.cartItem`
 * @param from - current status
 * @param to - requested status
 */
export function canTransition<S extends string>(machine: StateMachine<S>, from: S, to: S): boolean {
  return machine.transitions[from]?.includes(to) ?? false;
}

/**
 * Whether a new record may start in `status`.
 * @param machine - e.g. `STATE_MACHINES.goal`
 * @param status - the first status
 */
export function isInitialStatus<S extends string>(machine: StateMachine<S>, status: S): boolean {
  return machine.initial.includes(status);
}

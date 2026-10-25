import type { SmokeCheck } from '../types.js';
import { phase0Checks } from './phase0.js';

/** All smoke checks in run order. Each phase adds its own file and appends it here. */
export const checks: SmokeCheck[] = [...phase0Checks];

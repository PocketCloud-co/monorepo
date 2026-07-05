// Pocket Cloud — worker-placement solver with anti-collusion + private-pool
// isolation (FT-02 tasks CP-014 + CP-015). Public entry point.
//
// Zero dependencies, ES modules, tested with `node --test` — matching the PoC
// style. This module is the security spine of placement (SEC-001 gap 1); read
// docs/prds/FT-02-coordinator-control-plane/PRD.md §5, and src/policy.js for
// the anti-collusion floor rationale.

export { placeJob, verifyPlacement, assertFloor, validateJob, normalizePoolId } from './src/placement.js';
export {
  ATTRS,
  RELAXABLE_ATTRS,
  FLOOR_ATTRS,
  deviceAttrs,
  effectiveLimits,
  validatePolicy,
  PlacementError,
  PlacementFloorViolation,
} from './src/policy.js';
export {
  issueEnrollmentToken,
  validateEnrollmentToken,
  consumeEnrollmentToken,
  EnrollmentError,
  MAX_TOKEN_LIFETIME_MS,
  HOUR_MS,
} from './src/enrollment.js';
export { makeRng, shuffle, randInt, pick } from './src/rng.js';

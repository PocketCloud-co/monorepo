// Test helpers: deterministic fleet generation for property + adversarial
// tests. All randomness flows through the module's seeded rng so a failing
// case is reproducible from its seed alone.

import { makeRng, randInt, pick } from '../index.js';

let counter = 0;
export function uid(prefix = 'd') {
  counter += 1;
  return `${prefix}-${counter}`;
}

// Build one device with fully-specified, per-device-UNIQUE anti-collusion
// attributes (so a bare `device()` is fully diverse; collisions must be opted
// into via overrides). ip24 is derived from a rolling counter across the whole
// 10.0.0.0/8 space so distinct calls never accidentally collide.
export function device(overrides = {}) {
  const n = ++counter;
  return {
    id: overrides.id ?? `d-${n}`,
    poolId: overrides.poolId ?? null,
    ownerAccount: overrides.ownerAccount ?? `owner-${n}`,
    payoutAccount: overrides.payoutAccount ?? `payout-${n}`,
    ip24: overrides.ip24 ?? `10.${(n >> 8) & 255}.${n & 255}.0/24`,
    asnCity: overrides.asnCity ?? `asncity-${n}`,
    hwFingerprintCluster: overrides.hwFingerprintCluster ?? `fp-${n}`,
    ...overrides,
  };
}

// Generate a random fleet. Each attribute is drawn from a small alphabet so
// collisions (the interesting cases for anti-collusion) actually occur.
export function randomFleet(rng, { size, poolId = null, alphabet = 6 } = {}) {
  const label = (p) => `${p}-${randInt(rng, 1, alphabet)}`;
  const fleet = [];
  for (let i = 0; i < size; i++) {
    fleet.push({
      id: uid('rd'),
      poolId,
      ownerAccount: label('own'),
      payoutAccount: label('pay'),
      ip24: `10.${randInt(rng, 1, alphabet)}.0.0/24`,
      asnCity: label('asn'),
      hwFingerprintCluster: label('fp'),
    });
  }
  return fleet;
}

export { makeRng, randInt, pick };

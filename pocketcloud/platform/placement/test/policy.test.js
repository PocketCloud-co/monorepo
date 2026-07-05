// Policy + floor unit tests (CP-015): the floor is not a policy knob.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  validatePolicy,
  effectiveLimits,
  deviceAttrs,
  PlacementError,
} from '../index.js';

test('a policy that tries to relax the fingerprint floor is rejected loudly', () => {
  assert.throws(
    () => validatePolicy({ poolId: 'p', relax: { hwFingerprintCluster: 'any' } }),
    (e) => e instanceof PlacementError && e.code === 'floor-not-relaxable',
  );
});

test('a policy relaxing an unknown attribute is rejected', () => {
  assert.throws(
    () => validatePolicy({ poolId: 'p', relax: { nonsense: 2 } }),
    /unknown attribute/,
  );
});

test('a policy must name its pool', () => {
  assert.throws(() => validatePolicy({ relax: {} }), /must name the poolId/);
});

test('relax values must be a positive integer or "any"', () => {
  assert.throws(() => validatePolicy({ poolId: 'p', relax: { ip24: 0 } }), /positive integer/);
  assert.throws(() => validatePolicy({ poolId: 'p', relax: { ip24: -1 } }), /positive integer/);
  assert.throws(() => validatePolicy({ poolId: 'p', relax: { ip24: 1.5 } }), /positive integer/);
  assert.doesNotThrow(() => validatePolicy({ poolId: 'p', relax: { ip24: 3 } }));
  assert.doesNotThrow(() => validatePolicy({ poolId: 'p', relax: { ip24: 'any' } }));
});

test('effectiveLimits: strict public policy pins every attribute at 1', () => {
  const limits = effectiveLimits(null, 5);
  assert.deepEqual(limits, {
    ownerAccount: 1,
    payoutAccount: 1,
    ip24: 1,
    asnCity: 1,
    hwFingerprintCluster: 1,
  });
});

test('effectiveLimits: relaxable attrs move, fingerprint stays pinned below t', () => {
  const policy = {
    poolId: 'p',
    relax: { ownerAccount: 'any', ip24: 4 },
  };
  const limits = effectiveLimits(policy, 5);
  assert.equal(limits.ownerAccount, Infinity);
  assert.equal(limits.ip24, 4);
  assert.equal(limits.payoutAccount, 1); // untouched
  // Floor: fingerprint pinned; min(1, t-1) = 1, strictly < t.
  assert.equal(limits.hwFingerprintCluster, 1);
  assert.ok(limits.hwFingerprintCluster < 5);
});

test('deviceAttrs derives ip24 from a full ip and asnCity from asn+city', () => {
  const a = deviceAttrs({
    id: 'd',
    poolId: null,
    ownerAccount: 'o',
    payoutAccount: 'p',
    ip: '192.168.5.42',
    asn: 'AS100',
    city: 'Boston',
    hwFingerprintCluster: 'fp',
  });
  assert.equal(a.ip24, '192.168.5.0/24');
  assert.equal(a.asnCity, 'AS100|Boston');
});

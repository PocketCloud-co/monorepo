// Placement solver: functional + boundary + pool-scoping tests (CP-003, CP-014).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  placeJob,
  verifyPlacement,
  assertFloor,
  validateJob,
  PlacementError,
  PlacementFloorViolation,
} from '../index.js';
import { device, makeRng } from './helpers.js';

// A fully-diverse public fleet: every attribute unique per device, so the
// strict public policy can always place.
function diverseFleet(n, poolId = null) {
  return Array.from({ length: n }, (_, i) =>
    device({ id: `dv-${poolId ?? 'pub'}-${i}`, poolId }),
  );
}

test('places a simple public job and every constraint holds', () => {
  const fleet = diverseFleet(10);
  const job = { poolId: null, shares: 5, threshold: 5 };
  const p = placeJob(job, fleet);

  assert.equal(p.assignments.length, 5);
  assert.equal(Object.keys(p.byShareIndex).length, 5);
  // distinct devices
  const ids = p.assignments.map((a) => a.deviceId);
  assert.equal(new Set(ids).size, 5);
  // soundness against full policy
  assert.deepEqual(verifyPlacement(p, job, fleet).violations, []);
});

test('redundancy places r distinct devices per share index, same-index exempt', () => {
  const fleet = diverseFleet(20);
  const job = { poolId: null, shares: 4, threshold: 4, redundancy: 3 };
  const p = placeJob(job, fleet);
  assert.equal(p.assignments.length, 12);
  for (let s = 1; s <= 4; s++) {
    const devs = p.byShareIndex[s];
    assert.equal(devs.length, 3);
    assert.equal(new Set(devs).size, 3, 'replicas on distinct devices');
  }
  assert.deepEqual(verifyPlacement(p, job, fleet).violations, []);
});

test('output is deterministic for a fixed rng seed', () => {
  const fleet = diverseFleet(12);
  const job = { poolId: null, shares: 5, threshold: 5 };
  const a = placeJob(job, fleet, { rng: makeRng(42) });
  const b = placeJob(job, fleet, { rng: makeRng(42) });
  assert.deepEqual(a.assignments, b.assignments);
});

test('two share indices cannot share owner under strict public policy', () => {
  // Only 3 owners across 6 devices -> at most 3 distinct indices placeable.
  const fleet = [
    device({ id: 'a1', ownerAccount: 'A' }),
    device({ id: 'a2', ownerAccount: 'A' }),
    device({ id: 'b1', ownerAccount: 'B' }),
    device({ id: 'b2', ownerAccount: 'B' }),
    device({ id: 'c1', ownerAccount: 'C' }),
    device({ id: 'c2', ownerAccount: 'C' }),
  ];
  const p = placeJob({ poolId: null, shares: 3, threshold: 3 }, fleet);
  // Each share index landed on a distinct owner.
  const owners = p.assignments.map(
    (a) => fleet.find((d) => d.id === a.deviceId).ownerAccount,
  );
  assert.equal(new Set(owners).size, 3);

  // Asking for 4 distinct indices with only 3 owners is infeasible.
  assert.throws(
    () => placeJob({ poolId: null, shares: 4, threshold: 4 }, fleet),
    (e) => e instanceof PlacementError && /infeasible/.test(e.message),
  );
});

test('infeasible placement fails fast with an actionable, diagnostic error', () => {
  // 4 shares but only 2 distinct fingerprint clusters -> fingerprint is the
  // bottleneck under strict policy.
  const fleet = [
    device({ id: 'x1', hwFingerprintCluster: 'FP1' }),
    device({ id: 'x2', hwFingerprintCluster: 'FP1' }),
    device({ id: 'y1', hwFingerprintCluster: 'FP2' }),
    device({ id: 'y2', hwFingerprintCluster: 'FP2' }),
  ];
  assert.throws(
    () => placeJob({ poolId: null, shares: 4, threshold: 4 }, fleet),
    (e) => {
      assert.ok(e instanceof PlacementError);
      assert.equal(e.code, 'infeasible');
      assert.match(e.message, /BOTTLENECK/);
      assert.match(e.message, /hwFingerprintCluster/);
      assert.match(e.message, /cannot be relaxed/);
      return true;
    },
  );
});

test('not enough devices for the slots fails fast', () => {
  const fleet = diverseFleet(3);
  assert.throws(
    () => placeJob({ poolId: null, shares: 4, threshold: 4 }, fleet),
    (e) => e instanceof PlacementError && /only 3 eligible/.test(e.message),
  );
});

// --- Pool scoping (CP-014), both directions --------------------------------

test('a private-pool job places ONLY on its pool devices', () => {
  const poolFleet = diverseFleet(6, 'pool-A');
  const publicFleet = diverseFleet(6, null);
  const otherPool = diverseFleet(6, 'pool-B');
  const all = [...poolFleet, ...publicFleet, ...otherPool];

  const job = { poolId: 'pool-A', shares: 5, threshold: 5 };
  const p = placeJob(job, all);
  for (const a of p.assignments) {
    const d = all.find((x) => x.id === a.deviceId);
    assert.equal(d.poolId, 'pool-A', 'placed device belongs to pool-A');
  }
  assert.deepEqual(verifyPlacement(p, job, all).violations, []);
});

test('a public job NEVER places on a pool device', () => {
  // Only pool devices exist; a public job must find nothing and fail fast.
  const poolFleet = diverseFleet(10, 'pool-A');
  assert.throws(
    () => placeJob({ poolId: null, shares: 3, threshold: 3 }, poolFleet),
    (e) => e instanceof PlacementError && /public marketplace/.test(e.message),
  );
});

test('a pool job NEVER places on a public/other-pool device', () => {
  const publicFleet = diverseFleet(10, null);
  const otherPool = diverseFleet(10, 'pool-B');
  assert.throws(
    () =>
      placeJob({ poolId: 'pool-A', shares: 3, threshold: 3 }, [
        ...publicFleet,
        ...otherPool,
      ]),
    (e) => e instanceof PlacementError && /pool 'pool-A'/.test(e.message),
  );
});

test('verifyPlacement flags a hand-built cross-pool placement', () => {
  const all = [
    device({ id: 'pub-1', poolId: null }),
    device({ id: 'poolA-1', poolId: 'pool-A' }),
  ];
  // Illegally place a pool device into a public job.
  const bogus = {
    poolId: null,
    shares: 2,
    threshold: 2,
    redundancy: 1,
    assignments: [
      { shareIndex: 1, replica: 0, deviceId: 'pub-1' },
      { shareIndex: 2, replica: 0, deviceId: 'poolA-1' },
    ],
    byShareIndex: { 1: ['pub-1'], 2: ['poolA-1'] },
  };
  const { ok, violations } = verifyPlacement(bogus, { poolId: null }, all);
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.kind === 'cross-pool'));
});

// --- Input validation -------------------------------------------------------

test('n < 2 is rejected (privacy floor)', () => {
  assert.throws(
    () => validateJob({ poolId: null, shares: 1, threshold: 1 }),
    /privacy floor/,
  );
});

test('threshold out of [2, n] is rejected', () => {
  assert.throws(() => validateJob({ poolId: null, shares: 4, threshold: 5 }), /threshold/);
  assert.throws(() => validateJob({ poolId: null, shares: 4, threshold: 1 }), /threshold/);
});

test('a public job may not carry a pool policy', () => {
  assert.throws(
    () =>
      placeJob(
        { poolId: null, shares: 3, threshold: 3, policy: { poolId: 'x', relax: {} } },
        diverseFleet(5),
      ),
    /may not carry a pool policy/,
  );
});

test('policy poolId must match job poolId', () => {
  assert.throws(
    () =>
      validateJob({
        poolId: 'pool-A',
        shares: 3,
        threshold: 3,
        policy: { poolId: 'pool-B', relax: {} },
      }),
    /does not match/,
  );
});

test('an unattributed device is rejected (fail closed)', () => {
  const fleet = [device({ id: 'good' }), { id: 'bad', poolId: null, ownerAccount: 'o' }];
  assert.throws(
    () => placeJob({ poolId: null, shares: 2, threshold: 2 }, fleet),
    /missing anti-collusion attribute/,
  );
});

test('assertFloor refuses to pass without device attributes', () => {
  const p = {
    poolId: null,
    threshold: 3,
    assignments: [{ shareIndex: 1, replica: 0, deviceId: 'd1' }],
  };
  assert.throws(
    () => assertFloor(p, { poolId: null, threshold: 3 }, undefined),
    (e) => e instanceof PlacementFloorViolation,
  );
});

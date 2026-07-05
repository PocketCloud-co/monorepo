// Property + adversarial tests. The point of this file: across MANY randomised
// fleets and jobs, the solver must NEVER emit a placement that violates the
// anti-collusion constraints (CP-003), pool scoping (CP-014), or the
// non-relaxable floor (CP-015). Infeasible must throw, never leak.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  placeJob,
  verifyPlacement,
  assertFloor,
  deviceAttrs,
  PlacementError,
  PlacementFloorViolation,
} from '../index.js';
import { makeRng, randInt, randomFleet, device } from './helpers.js';

// ---------------------------------------------------------------------------
// Property 1: SOUNDNESS. Whatever placeJob returns satisfies every constraint.
// ---------------------------------------------------------------------------
test('property: no emitted public placement ever violates constraints (1000 fleets)', () => {
  let placed = 0;
  let refused = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const rng = makeRng(seed);
    const size = randInt(rng, 3, 30);
    const alphabet = randInt(rng, 2, 8);
    const fleet = randomFleet(rng, { size, poolId: null, alphabet });
    const shares = randInt(rng, 2, 8);
    const threshold = randInt(rng, 2, shares);
    const redundancy = randInt(rng, 1, 3);
    const job = { poolId: null, shares, threshold, redundancy };

    let p;
    try {
      p = placeJob(job, fleet, { rng: makeRng(seed * 7 + 1) });
    } catch (e) {
      assert.ok(
        e instanceof PlacementError,
        `seed ${seed}: expected PlacementError, got ${e}`,
      );
      refused += 1;
      continue;
    }
    placed += 1;
    // Full-policy soundness.
    const { ok, violations } = verifyPlacement(p, job, fleet);
    assert.ok(
      ok,
      `seed ${seed}: emitted placement violates policy: ${JSON.stringify(violations)}`,
    );
    // Floor holds independently.
    const candidates = fleet.map((d) => ({ device: d, attrs: deviceAttrs(d) }));
    assert.doesNotThrow(() => assertFloor(p, job, candidates));
    // Slot count + distinct-device sanity.
    assert.equal(p.assignments.length, shares * redundancy);
    assert.equal(
      new Set(p.assignments.map((a) => a.deviceId)).size,
      shares * redundancy,
    );
  }
  // Sanity: the generator produces BOTH outcomes, so the assertions above are
  // actually exercised on real placements (not just a stream of refusals).
  assert.ok(placed > 100, `expected many feasible placements, got ${placed}`);
  assert.ok(refused > 10, `expected some infeasible refusals, got ${refused}`);
});

// ---------------------------------------------------------------------------
// Property 2: private pools with relaxed policy still never break the floor.
// ---------------------------------------------------------------------------
test('property: relaxed pool policy never breaches the floor (800 fleets)', () => {
  for (let seed = 1; seed <= 800; seed++) {
    const rng = makeRng(seed + 10_000);
    const size = randInt(rng, 3, 30);
    const alphabet = randInt(rng, 2, 6);
    const fleet = randomFleet(rng, { size, poolId: 'pool-X', alphabet });
    const shares = randInt(rng, 2, 8);
    const threshold = randInt(rng, 2, shares);
    // Maximally-relaxed policy on every RELAXABLE axis.
    const policy = {
      poolId: 'pool-X',
      relax: {
        ownerAccount: 'any',
        payoutAccount: 'any',
        ip24: 'any',
        asnCity: 'any',
      },
    };
    const job = { poolId: 'pool-X', shares, threshold, policy };

    let p;
    try {
      p = placeJob(job, fleet, { rng: makeRng(seed) });
    } catch (e) {
      assert.ok(e instanceof PlacementError);
      continue;
    }
    const candidates = fleet.map((d) => ({ device: d, attrs: deviceAttrs(d) }));
    // Floor must hold even though owner/ip/asn/payout are wide open.
    assert.doesNotThrow(
      () => assertFloor(p, job, candidates),
      `seed ${seed}: relaxed pool placement breached the floor`,
    );
    // And every placed device really is in the pool.
    for (const a of p.assignments) {
      const d = fleet.find((x) => x.id === a.deviceId);
      assert.equal(d.poolId, 'pool-X');
    }
  }
});

// ---------------------------------------------------------------------------
// The SEC-001 gap-1 attack: an attacker who controls many devices sharing a
// hardware-fingerprint cluster (and owner) inside a pool can NEVER receive
// >= t distinct share indices of one job — even with policy maximally relaxed.
// ---------------------------------------------------------------------------
test('SEC-001 gap 1: fingerprint-clustered attacker cannot capture >= t shares', () => {
  const POOL = 'victim-pool';
  // A handful of legitimate, genuinely-distinct corporate machines...
  const legit = Array.from({ length: 3 }, (_, i) =>
    device({
      id: `legit-${i}`,
      poolId: POOL,
      ownerAccount: 'ACME-CORP',
      hwFingerprintCluster: `real-tpm-${i}`, // distinct hardware
    }),
  );
  // ...and a Sybil swarm the attacker enrolled with a leaked token: 50 devices
  // all cloned from one image => one fingerprint cluster, one owner.
  const swarm = Array.from({ length: 50 }, (_, i) =>
    device({
      id: `evil-${i}`,
      poolId: POOL,
      ownerAccount: 'ACME-CORP', // masquerades as the org
      payoutAccount: 'ACME-PAYOUT',
      ip24: '10.9.9.0/24',
      asnCity: 'AS64500|Sybilville',
      hwFingerprintCluster: 'attacker-rig', // the tell they cannot diversify
    }),
  );
  const fleet = [...legit, ...swarm];

  const policy = {
    poolId: POOL,
    relax: {
      ownerAccount: 'any',
      payoutAccount: 'any',
      ip24: 'any',
      asnCity: 'any',
    },
  };

  // Try to place a job needing 5 distinct shares, t=5, across many orderings.
  // The attacker WANTS >= 5 distinct indices to land on 'attacker-rig'.
  const job = { poolId: POOL, shares: 5, threshold: 5, policy };

  let feasibleCount = 0;
  for (let seed = 1; seed <= 300; seed++) {
    let p;
    try {
      p = placeJob(job, fleet, { rng: makeRng(seed) });
    } catch (e) {
      assert.ok(e instanceof PlacementError); // infeasible is a safe outcome
      continue;
    }
    feasibleCount += 1;
    // Count distinct share indices that landed on the attacker cluster.
    const attackerIndices = new Set(
      p.assignments
        .filter((a) => a.deviceId.startsWith('evil-'))
        .map((a) => a.shareIndex),
    );
    assert.ok(
      attackerIndices.size < job.threshold,
      `seed ${seed}: attacker captured ${attackerIndices.size} distinct shares (>= t=${job.threshold})`,
    );
    // Belt-and-suspenders: the floor check agrees.
    const candidates = fleet.map((d) => ({ device: d, attrs: deviceAttrs(d) }));
    assert.doesNotThrow(() => assertFloor(p, job, candidates));
  }

  // With only 3 real fingerprint clusters + 1 attacker cluster = 4 clusters,
  // and each cluster capped at 1 distinct index by the floor, 5 distinct
  // shares is IMPOSSIBLE. The attack must be refused outright, not leaked.
  assert.equal(
    feasibleCount,
    0,
    'a 5-share job that could only be filled by over-loading the attacker ' +
      'cluster must be refused, never placed',
  );
});

test('SEC-001 gap 1: attacker cannot even get t shares when t < n via the floor', () => {
  // Give the attacker room: 4 real clusters + attacker cluster, shares=5,
  // t=3. Legit clusters can cover at most 4 indices; the 5th MUST come from
  // the attacker cluster, but only ONE distinct index may land there (floor
  // pins fingerprint at 1). So still infeasible — the attacker never reaches
  // even t=3 on its cluster.
  const POOL = 'p2';
  const legit = Array.from({ length: 4 }, (_, i) =>
    device({ id: `L-${i}`, poolId: POOL, ownerAccount: 'ORG', hwFingerprintCluster: `hw-${i}` }),
  );
  const swarm = Array.from({ length: 20 }, (_, i) =>
    device({
      id: `E-${i}`,
      poolId: POOL,
      ownerAccount: 'ORG',
      hwFingerprintCluster: 'evil',
    }),
  );
  const fleet = [...legit, ...swarm];
  const policy = { poolId: POOL, relax: { ownerAccount: 'any', payoutAccount: 'any', ip24: 'any', asnCity: 'any' } };

  for (let seed = 1; seed <= 100; seed++) {
    let p;
    try {
      p = placeJob({ poolId: POOL, shares: 5, threshold: 3, policy }, fleet, {
        rng: makeRng(seed),
      });
    } catch (e) {
      assert.ok(e instanceof PlacementError);
      continue;
    }
    const attackerIndices = new Set(
      p.assignments.filter((a) => a.deviceId.startsWith('E-')).map((a) => a.shareIndex),
    );
    assert.ok(attackerIndices.size < 3, `attacker got ${attackerIndices.size} >= t=3`);
  }
});

// ---------------------------------------------------------------------------
// A relaxed pool CAN place more shares than strict — proving the relaxation
// actually does something (so the floor test above isn't passing vacuously).
// ---------------------------------------------------------------------------
test('relaxed pool policy enables placements strict policy would refuse', () => {
  const POOL = 'dense';
  // 5 devices, ALL same owner + same /24 (typical corporate NAT), but each a
  // genuinely distinct machine (distinct fingerprint).
  const fleet = Array.from({ length: 5 }, (_, i) =>
    device({
      id: `m-${i}`,
      poolId: POOL,
      ownerAccount: 'ORG',
      payoutAccount: 'ORG-PAY',
      ip24: '10.0.0.0/24',
      asnCity: 'AS1|HQ',
      hwFingerprintCluster: `tpm-${i}`,
    }),
  );

  // Strict-equivalent (no relax) would fail: owner/ip/asn all collide.
  assert.throws(
    () => placeJob({ poolId: POOL, shares: 4, threshold: 4, policy: { poolId: POOL, relax: {} } }, fleet),
    (e) => e instanceof PlacementError && /infeasible/.test(e.message),
  );

  // Relaxed: owner/ip/asn/payout opened up, fingerprints are distinct -> OK.
  const policy = {
    poolId: POOL,
    relax: { ownerAccount: 'any', payoutAccount: 'any', ip24: 'any', asnCity: 'any' },
  };
  const p = placeJob({ poolId: POOL, shares: 4, threshold: 4, policy }, fleet);
  assert.equal(p.assignments.length, 4);
  const candidates = fleet.map((d) => ({ device: d, attrs: deviceAttrs(d) }));
  assert.doesNotThrow(() => assertFloor(p, { poolId: POOL, threshold: 4 }, candidates));
});

test('private-pool job with no burst policy fails fast rather than leaking to public', () => {
  // Pool has too little diversity; the ONLY way to satisfy would be public
  // devices, which are out of scope. Must fail fast (CP-014 acceptance).
  const POOL = 'tiny';
  const poolFleet = Array.from({ length: 2 }, (_, i) =>
    device({ id: `t-${i}`, poolId: POOL, hwFingerprintCluster: `fp-${i}` }),
  );
  const publicFleet = Array.from({ length: 20 }, (_, i) => device({ id: `pub-${i}` }));
  assert.throws(
    () => placeJob({ poolId: POOL, shares: 5, threshold: 5 }, [...poolFleet, ...publicFleet]),
    (e) => {
      assert.ok(e instanceof PlacementError);
      assert.match(e.message, /pool 'tiny'/);
      return true;
    },
  );
});

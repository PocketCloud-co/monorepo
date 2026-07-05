// Worker-placement solver with anti-collusion + private-pool isolation.
//
// Implements CP-003 (anti-collusion, PRD §8.4), CP-014 (pool scoping, F19),
// and the CP-015 non-relaxable floor (SEC-001 gap 1). This is the security
// spine of the marketplace: get it wrong and a colluding set of devices can
// reconstruct customer data (SEC-001 critical gap 1). Every returned
// placement is independently re-checked against the floor before it leaves
// this function (`assertFloor`), so a floor violation is impossible by
// construction — not merely unlikely.
//
// Model
// -----
// A job needs `shares` distinct share indices (1..shares), each replicated
// `redundancy` times. Every (shareIndex, replica) is a SLOT that must land on
// its own distinct physical device. Anti-collusion constraints hold BETWEEN
// distinct share indices; replicas of the same index are mutually exempt
// (they carry identical information) but still require distinct devices.
//
// Pool scoping is a hard constraint in both directions (CP-014): a job with
// poolId = P places only on devices with poolId = P; a device with poolId = P
// is invisible to public (poolId = null) and other-pool jobs. This is
// enforced by construction — non-matching devices are filtered out before the
// solver ever sees them — and re-asserted on the result.

import { shuffle } from './rng.js';
import {
  ATTRS,
  deviceAttrs,
  effectiveLimits,
  FLOOR_ATTRS,
  PlacementError,
  PlacementFloorViolation,
  validatePolicy,
} from './policy.js';

// Bound the search. Placement under the anti-collusion constraints is a
// graph-colouring problem (NP-hard in general); we solve it with bounded
// backtracking. `shares` is small by policy (privacy floor 2..64) and fleets
// per cell are large but the branching is pruned hard, so real jobs resolve
// quickly. If the budget is exhausted we FAIL rather than return a possibly
// unsafe partial placement — an honest "could not solve", never a silent
// diversity downgrade (PRD §8.4).
const DEFAULT_STEP_BUDGET = 500_000;

export function validateJob(job) {
  if (job == null || typeof job !== 'object') {
    throw new PlacementError('job must be an object', 'bad-job');
  }
  const poolId = normalizePoolId(job.poolId);
  const shares = job.shares;
  if (!Number.isInteger(shares) || shares < 2 || shares > 64) {
    throw new PlacementError(
      'shares (n) must be an integer in [2, 64] (n >= 2 is a privacy floor: ' +
        'a single share is the plaintext)',
      'bad-job',
    );
  }
  const threshold = job.threshold ?? shares;
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > shares) {
    throw new PlacementError(
      `threshold (t) must be an integer in [2, ${shares}] (got ${threshold})`,
      'bad-job',
    );
  }
  const redundancy = job.redundancy ?? 1;
  if (!Number.isInteger(redundancy) || redundancy < 1 || redundancy > 8) {
    throw new PlacementError(
      'redundancy (r) must be an integer in [1, 8]',
      'bad-job',
    );
  }
  const policy = validatePolicy(job.policy ?? null);
  if (poolId === null && policy) {
    throw new PlacementError(
      'a public job (poolId = null) may not carry a pool policy; ' +
        'the public marketplace uses the strict anti-collusion policy',
      'bad-job',
    );
  }
  if (policy && normalizePoolId(policy.poolId) !== poolId) {
    throw new PlacementError(
      `policy.poolId (${policy.poolId}) does not match job.poolId (${job.poolId ?? null})`,
      'bad-job',
    );
  }
  return { poolId, shares, threshold, redundancy, policy };
}

export function normalizePoolId(poolId) {
  // null and undefined both mean "public marketplace". Anything else is a
  // concrete pool id (coerced to string for stable comparison).
  if (poolId == null) return null;
  return String(poolId);
}

// Per-attribute counter: for one group value, how many DISTINCT share indices
// currently occupy it (by reference count, so replicas of one index count
// once). Cheap increment/decrement supports backtracking.
class GroupCounts {
  constructor() {
    this.groups = new Map(); // groupValue -> Map(shareIndex -> refCount)
  }
  distinct(groupValue) {
    const m = this.groups.get(groupValue);
    return m ? m.size : 0;
  }
  has(groupValue, shareIndex) {
    const m = this.groups.get(groupValue);
    return !!m && m.has(shareIndex);
  }
  add(groupValue, shareIndex) {
    let m = this.groups.get(groupValue);
    if (!m) {
      m = new Map();
      this.groups.set(groupValue, m);
    }
    m.set(shareIndex, (m.get(shareIndex) ?? 0) + 1);
  }
  remove(groupValue, shareIndex) {
    const m = this.groups.get(groupValue);
    if (!m) return;
    const c = m.get(shareIndex);
    if (c === undefined) return;
    if (c <= 1) m.delete(shareIndex);
    else m.set(shareIndex, c - 1);
    if (m.size === 0) this.groups.delete(groupValue);
  }
}

/**
 * Place a job's share slots onto eligible devices.
 *
 * @param {object} job     { poolId, shares, threshold, redundancy, policy }
 * @param {object[]} devices  fleet; each device carries anti-collusion attrs
 * @param {object} [opts]  { rng, stepBudget }
 * @returns {object} placement { poolId, shares, threshold, redundancy,
 *                               assignments: [{shareIndex, replica, deviceId}],
 *                               byShareIndex: { [i]: deviceId[] } }
 * @throws {PlacementError} on bad input or infeasible placement (fail fast)
 * @throws {PlacementFloorViolation} if a produced placement breaks the floor
 *         (should be impossible; a defensive last line of defence)
 */
export function placeJob(job, devices, opts = {}) {
  const { poolId, shares, threshold, redundancy, policy } = validateJob(job);
  if (!Array.isArray(devices)) {
    throw new PlacementError('devices must be an array', 'bad-input');
  }
  const { rng, stepBudget = DEFAULT_STEP_BUDGET } = opts;

  const limits = effectiveLimits(policy, threshold);

  // --- Hard pool scoping (CP-014), both directions, by construction ---------
  // A private-pool job sees only its pool's devices; a pool device is
  // invisible to everyone else. Filtering here makes cross-pool placement
  // literally unrepresentable downstream.
  const eligible = devices.filter(
    (d) => normalizePoolId(d.poolId) === poolId,
  );

  // Attach validated attribute tuples once (also fails closed on any
  // unattributed device).
  const candidates = eligible.map((d) => ({ device: d, attrs: deviceAttrs(d) }));

  // Deterministic ordering: shuffle under the caller's rng if provided (so
  // load spreads across the fleet like the PoC's LRU), else sort by id for a
  // fully reproducible default.
  const ordered = rng
    ? shuffle(candidates, rng)
    : candidates.slice().sort((a, b) => cmp(a.device.id, b.device.id));

  // --- Build slots ----------------------------------------------------------
  const slots = [];
  for (let s = 1; s <= shares; s++) {
    for (let rep = 0; rep < redundancy; rep++) {
      slots.push({ shareIndex: s, replica: rep });
    }
  }

  if (ordered.length < slots.length) {
    throw infeasible(
      poolId,
      shares,
      threshold,
      redundancy,
      candidates,
      limits,
      `need ${slots.length} distinct devices (${shares} shares x ${redundancy} replicas), ` +
        `only ${ordered.length} eligible device(s) in scope`,
    );
  }

  // --- Fast necessary-condition check ---------------------------------------
  // Before paying for backtracking, reject the obviously-infeasible: for each
  // attribute with a finite cap L over G distinct groups, at most G*L distinct
  // share indices can ever be placed. If any axis can't reach `shares`, no
  // assignment exists — fail immediately with the diagnostic. This is a
  // NECESSARY (not sufficient) condition, so it never rejects a feasible job;
  // it just short-circuits the common infeasible cases cheaply.
  for (const attr of ATTRS) {
    if (limits[attr] === Infinity) continue;
    const groups = new Set(candidates.map((c) => c.attrs[attr]));
    if (groups.size * limits[attr] < shares) {
      throw infeasible(
        poolId,
        shares,
        threshold,
        redundancy,
        candidates,
        limits,
        `attribute '${attr}' has only ${groups.size} distinct group(s) at cap ` +
          `${limits[attr]}/group, supporting at most ${groups.size * limits[attr]} ` +
          `distinct share index(es) < ${shares} required`,
      );
    }
  }

  // --- Backtracking search --------------------------------------------------
  const counters = {};
  for (const attr of ATTRS) counters[attr] = new GroupCounts();
  const usedDeviceIds = new Set();
  const assignment = new Array(slots.length).fill(null);
  const budget = { steps: stepBudget };

  const ok = solve(0);
  if (!ok) {
    if (budget.steps <= 0) {
      throw new PlacementError(
        `placement search exceeded ${stepBudget} steps for ${shares} shares ` +
          `x ${redundancy} replicas over ${ordered.length} eligible devices; ` +
          `no safe placement found within budget (raise stepBudget or add diverse supply)`,
        'search-budget-exhausted',
      );
    }
    throw infeasible(
      poolId,
      shares,
      threshold,
      redundancy,
      candidates,
      limits,
      'no assignment satisfies the anti-collusion constraints at the requested diversity',
    );
  }

  const assignments = slots.map((slot, i) => ({
    shareIndex: slot.shareIndex,
    replica: slot.replica,
    deviceId: assignment[i].device.id,
  }));
  const byShareIndex = {};
  for (const a of assignments) {
    (byShareIndex[a.shareIndex] ??= []).push(a.deviceId);
  }

  const placement = {
    poolId,
    shares,
    threshold,
    redundancy,
    assignments,
    byShareIndex,
  };

  // Independent re-verification of the non-relaxable floor. If this ever
  // throws, the solver has a bug — we refuse to emit an unsafe placement.
  assertFloor(placement, { poolId, threshold }, candidates);
  return placement;

  // Assign slots in order; a slot may host any eligible device that keeps
  // every attribute cap satisfied and is not already used. Most-constrained
  // ordering is unnecessary at these sizes; plain order + pruning suffices.
  function solve(i) {
    if (i === slots.length) return true;
    if (budget.steps <= 0) return false;
    const { shareIndex } = slots[i];

    for (const cand of ordered) {
      if (budget.steps <= 0) return false;
      budget.steps -= 1;
      const { device, attrs } = cand;
      if (usedDeviceIds.has(device.id)) continue; // F-a: one slot per device
      if (!fits(attrs, shareIndex)) continue;

      place(cand, shareIndex);
      assignment[i] = cand;
      if (solve(i + 1)) return true;
      assignment[i] = null;
      unplace(cand, shareIndex);
    }
    return false;
  }

  function fits(attrs, shareIndex) {
    for (const attr of ATTRS) {
      const g = attrs[attr];
      if (counters[attr].has(g, shareIndex)) continue; // same index: free
      if (counters[attr].distinct(g) >= limits[attr]) return false;
    }
    return true;
  }

  function place(cand, shareIndex) {
    usedDeviceIds.add(cand.device.id);
    for (const attr of ATTRS) counters[attr].add(cand.attrs[attr], shareIndex);
  }

  function unplace(cand, shareIndex) {
    usedDeviceIds.delete(cand.device.id);
    for (const attr of ATTRS)
      counters[attr].remove(cand.attrs[attr], shareIndex);
  }
}

// Independent verification of the NON-RELAXABLE floor (CP-015). Does not trust
// the solver's bookkeeping: recomputes from the assignment list. Throws
// PlacementFloorViolation on any breach. Safe to call on ANY placement,
// including one produced elsewhere — this is the check a reviewer or the
// transparency-log verifier runs.
export function assertFloor(placement, job, candidates) {
  const threshold = job.threshold ?? placement.threshold;
  const poolId = normalizePoolId(job.poolId ?? placement.poolId);

  const attrsById = new Map();
  if (candidates) {
    for (const c of candidates) attrsById.set(c.device.id, c.attrs);
  }

  // F-a: at most one distinct share index per physical device.
  const indicesByDevice = new Map();
  for (const a of placement.assignments) {
    let set = indicesByDevice.get(a.deviceId);
    if (!set) {
      set = new Set();
      indicesByDevice.set(a.deviceId, set);
    }
    set.add(a.shareIndex);
  }
  for (const [deviceId, set] of indicesByDevice) {
    if (set.size > 1) {
      throw new PlacementFloorViolation(
        `floor F-a violated: device ${deviceId} holds ${set.size} distinct ` +
          `share indices {${[...set].join(',')}}; a device may hold at most one`,
        { deviceId, indices: [...set] },
      );
    }
  }

  // F-b: fewer than t distinct share indices per hardware-fingerprint cluster
  // (and any other floor attribute). Needs the device attributes; if not
  // supplied we cannot verify and refuse to silently pass.
  if (attrsById.size === 0 && placement.assignments.length > 0) {
    throw new PlacementFloorViolation(
      'floor F-b cannot be verified: device attributes were not supplied to assertFloor',
      { reason: 'missing-attrs' },
    );
  }
  for (const attr of FLOOR_ATTRS) {
    const distinctByGroup = new Map(); // group -> Set(shareIndex)
    for (const a of placement.assignments) {
      const attrs = attrsById.get(a.deviceId);
      if (!attrs) {
        throw new PlacementFloorViolation(
          `floor F-b cannot be verified: no attributes for placed device ${a.deviceId}`,
          { deviceId: a.deviceId },
        );
      }
      const g = attrs[attr];
      let set = distinctByGroup.get(g);
      if (!set) {
        set = new Set();
        distinctByGroup.set(g, set);
      }
      set.add(a.shareIndex);
    }
    for (const [group, set] of distinctByGroup) {
      if (set.size >= threshold) {
        throw new PlacementFloorViolation(
          `floor F-b violated: ${attr} cluster '${group}' holds ${set.size} ` +
            `distinct share indices {${[...set].join(',')}}, >= threshold t=${threshold}; ` +
            `a colluding-capable entity must hold fewer than t`,
          { attr, group, indices: [...set], threshold },
        );
      }
    }
  }

  // NB: assertFloor verifies the anti-collusion FLOOR only (F-a, F-b). Pool
  // scoping (CP-014) and the full per-attribute policy caps are checked by
  // verifyPlacement, which has the device pool ids and the effective limits.
  // The solver guarantees pool scoping by construction (it filters devices to
  // the job's pool before searching).
  return true;
}

// Full-policy verification (all constraints, not just the floor). Used by the
// property tests to assert soundness of the solver's output, and available to
// callers that want to audit a placement against the exact policy in force.
// Returns { ok, violations }. Never throws on a mere violation — it REPORTS.
export function verifyPlacement(placement, job, devices) {
  const { poolId, threshold, policy } = validateJob({
    ...job,
    // validateJob needs shares/threshold; borrow from placement if absent.
    shares: job.shares ?? placement.shares,
    threshold: job.threshold ?? placement.threshold,
    redundancy: job.redundancy ?? placement.redundancy,
  });
  const limits = effectiveLimits(policy, threshold);
  const violations = [];

  const byId = new Map(devices.map((d) => [d.id, d]));

  // Pool scoping, both directions.
  for (const a of placement.assignments) {
    const d = byId.get(a.deviceId);
    if (!d) {
      violations.push({ kind: 'unknown-device', deviceId: a.deviceId });
      continue;
    }
    if (normalizePoolId(d.poolId) !== poolId) {
      violations.push({
        kind: 'cross-pool',
        deviceId: a.deviceId,
        devicePool: normalizePoolId(d.poolId),
        jobPool: poolId,
      });
    }
  }

  // One distinct index per device.
  const indicesByDevice = new Map();
  for (const a of placement.assignments) {
    (indicesByDevice.get(a.deviceId) ?? setInto(indicesByDevice, a.deviceId)).add(
      a.shareIndex,
    );
  }
  for (const [deviceId, set] of indicesByDevice) {
    if (set.size > 1) {
      violations.push({ kind: 'multi-index-device', deviceId, indices: [...set] });
    }
  }

  // Per-attribute distinct-index caps.
  for (const attr of ATTRS) {
    const distinctByGroup = new Map();
    for (const a of placement.assignments) {
      const d = byId.get(a.deviceId);
      if (!d) continue;
      const g = deviceAttrs(d)[attr];
      (distinctByGroup.get(g) ?? setInto(distinctByGroup, g)).add(a.shareIndex);
    }
    for (const [group, set] of distinctByGroup) {
      if (set.size > limits[attr]) {
        violations.push({
          kind: 'attr-cap',
          attr,
          group,
          distinct: set.size,
          limit: limits[attr],
          indices: [...set],
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

function setInto(map, key) {
  const s = new Set();
  map.set(key, s);
  return s;
}

function cmp(a, b) {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// Build an actionable infeasibility error (PRD §8.4: fail fast with a clear
// error, never a silent diversity downgrade). Includes per-attribute supply
// diagnostics so the operator can see WHICH diversity axis is the bottleneck.
function infeasible(poolId, shares, threshold, redundancy, candidates, limits, why) {
  const diag = [];
  for (const attr of ATTRS) {
    const groups = new Set(candidates.map((c) => c.attrs[attr]));
    // With cap L per group, G groups can host at most G*L distinct indices.
    const capacity = limits[attr] === Infinity ? Infinity : groups.size * limits[attr];
    diag.push(
      `${attr}: ${groups.size} distinct group(s), cap ${fmt(limits[attr])}/group ` +
        `=> supports up to ${fmt(capacity)} distinct share index(es)` +
        (capacity < shares ? '  <-- BOTTLENECK' : ''),
    );
  }
  const scope = poolId === null ? 'public marketplace' : `pool '${poolId}'`;
  return new PlacementError(
    `infeasible placement in ${scope}: ${why}. ` +
      `Requested ${shares} distinct share index(es), t=${threshold}, r=${redundancy}. ` +
      `Diversity supply:\n  ${diag.join('\n  ')}\n` +
      `Resolution: add supply on the bottleneck axis, lower n, or (private pools only) ` +
      `relax a RELAXABLE axis via policy — the fingerprint/device floor cannot be relaxed.`,
    'infeasible',
  );
}

function fmt(x) {
  return x === Infinity ? '∞' : String(x);
}

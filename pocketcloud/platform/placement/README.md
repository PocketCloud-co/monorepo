# @pocketcloud/placement

Worker-placement solver with **anti-collusion constraints**, **private-pool
isolation**, and a **non-relaxable collusion floor**. This is the security
spine of Pocket Cloud placement: getting it wrong lets a colluding set of
devices reconstruct customer data (SEC-001 critical gap 1).

- FT-02 tasks: **CP-014** (pool tenancy in placement) + **CP-015** (pool
  anti-collusion floor + enrollment-token lifecycle).
- Zero dependencies, ES modules, tested with `node --test` — matches the PoC
  style (`pocketcloud/poc/`).

```bash
node --test test/*.test.js     # or: npm test
```

## What it enforces (hard constraints)

1. **Anti-collusion (master PRD §8.4).** For a job needing `n` distinct share
   indices, no two *distinct* share indices may be placed on devices sharing
   ANY of: owner account, payout account, IP /24, ASN+city, or
   hardware-fingerprint cluster. Redundant replicas of the *same* share index
   may share attributes (they learn nothing new).

2. **The non-relaxable floor (CP-015 / SEC-001 gap 1).** Even inside a private
   pool that relaxes diversity, two things can NEVER be violated by any policy:
   - **F-a — one share index per physical device** (enforced structurally:
     one slot per device).
   - **F-b — fewer than `t` distinct share indices per hardware-fingerprint
     cluster**, where `t` is the job's collusion threshold. The fingerprint
     cluster is the identity a Sybil/co-option attacker cannot cheaply
     diversify (cloned VM images, botnet builds, many identities on one host),
     and the axis a fleet of genuinely-distinct corporate machines does not
     share.

   A pool policy may loosen **owner / payout / IP /24 / ASN+city** (in a
   corporate fleet the org owns every device, behind one NAT and one billing
   account). It **cannot** express relaxing the fingerprint cluster or the
   per-device rule — an attempt to do so is rejected loudly
   (`floor-not-relaxable`).

3. **Pool scoping (CP-014), both directions.** A job carries a `poolId`
   (`null` = public marketplace). A private-pool job places ONLY on that pool's
   devices; a private-pool device NEVER serves public or other-pool work.
   Enforced by construction (non-matching devices are filtered before the
   solver runs) and re-asserted on the result.

4. **Infeasible fails fast.** A placement that cannot meet the requested
   diversity throws an actionable `PlacementError` with per-axis supply
   diagnostics — never a silent diversity downgrade (PRD §8.4).

5. **Enrollment tokens (CP-015 / key K10).** `issue/validate/consume` model
   org enrollment tokens as **single-use, short-lived (≤ 72h), pool-bound**.
   Time is deterministic (`now` passed in; the module never reads the wall
   clock), so decisions are replayable for the M4 transparency log.

## Defence in depth

`placeJob` builds a candidate placement, then **independently re-verifies the
floor** (`assertFloor`) before returning. `assertFloor` recomputes from the
assignment list and does not trust the solver's bookkeeping, so a solver bug
surfaces as a `PlacementFloorViolation` (a security defect, HTTP 500-class)
rather than a leaked placement. `verifyPlacement` checks the *full* policy
(all attribute caps + pool scoping) and is what the property tests assert on.

## API

```js
import {
  placeJob, verifyPlacement, assertFloor, validateJob,
  issueEnrollmentToken, validateEnrollmentToken, consumeEnrollmentToken,
  makeRng,
} from '@pocketcloud/placement';

// Public job, strict anti-collusion policy.
const placement = placeJob(
  { poolId: null, shares: 5, threshold: 5, redundancy: 2 },
  fleet,                       // array of devices (see attribute shape below)
  { rng: makeRng(1234) },      // optional; deterministic given (inputs, rng)
);
// -> { poolId, shares, threshold, redundancy, assignments, byShareIndex }

// Private pool relaxing the RELAXABLE axes only.
const p2 = placeJob(
  {
    poolId: 'acme',
    shares: 4,
    threshold: 4,
    policy: {
      poolId: 'acme',
      relax: { ownerAccount: 'any', ip24: 'any', asnCity: 'any', payoutAccount: 'any' },
    },
  },
  poolFleet,
);
```

### Device shape

```js
{
  id: 'device-123',
  poolId: null,                       // null = public; else a pool id
  ownerAccount: 'acct-A',
  payoutAccount: 'stripe-A',
  // ip24 directly, OR ip: '10.1.2.3' (reduced to /24)
  ip24: '10.1.2.0/24',
  // asnCity directly, OR asn + city
  asnCity: 'AS64500|Boston',
  hwFingerprintCluster: 'tpm-cluster-7',   // the floor axis
}
```

A device missing any anti-collusion attribute is **rejected** (fail closed) —
an unattributed device cannot be safely placed.

### Job shape

```js
{
  poolId: null | 'pool-id',
  shares: 2..64,                 // n distinct share indices (n >= 2 privacy floor)
  threshold: 2..n,               // t; default n. Floor keys on t.
  redundancy: 1..8,              // r replicas per share index; default 1
  policy: null | { poolId, relax: { <relaxable attr>: number | 'any' } },
}
```

## Threat coverage (FT-02 §5)

- **Sybil supplier / pool-token attacker (SEC-001 gap 1).** Rogue devices
  enrolled into a pool share a hardware-fingerprint cluster; the floor caps
  distinct indices per cluster below `t`, so they can never reach `t`
  reconstructable shares — even with the policy maximally relaxed. Proven by
  `test/property.test.js` (the `SEC-001 gap 1` cases).
- **Cross-pool leak (CP-014).** Property-tested in both directions.
- **Leaked/replayed/expired enrollment token.** `test/enrollment.test.js`.

## Assumptions & scope

- **Honest fingerprinting.** The floor is only as good as the
  `hwFingerprintCluster` signal. Producing a trustworthy signal is HA-005's job
  (OS keystore/TPM attestation); this module trusts the attribute it is given.
  Stated as an explicit cross-feature dependency (see the tracker).
- The solver uses bounded backtracking (placement is graph-colouring,
  NP-hard). It is **sound** (never emits a constraint-violating placement) and
  practically complete at MVP job sizes; if the step budget is exhausted it
  FAILS (`search-budget-exhausted`) rather than returning an unsafe partial.
- Not wired into the coordinator yet — this is the standalone algorithm +
  proof. Integration is CP-003's job (registry → placement) once the control
  plane skeleton (CP-001) lands.

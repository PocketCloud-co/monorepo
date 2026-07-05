# FT-02 — Coordinator / Control Plane — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) |
| **Master PRD sections** | §8.1–8.6 (architecture), §7.1 (Sybil/placement rows), F1–F7 |
| **Milestones** | M1 (v0), M2 (alpha), M3 (cells/reputation), M4 (transparency log) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-02 owns the fabric's brain: job intake, device registry, worker placement
with anti-collusion constraints, share dealing (managed mode), verification,
share routing, quarantine/re-dispatch, and cell partitioning. The PoC
coordinator (`pocketcloud/poc/src/coordinator/`) is the behavioral reference:
its job lifecycle, verification checks, and quarantine semantics are the
contract to preserve.

## 2. Scope

**In scope:** job API; registry + device identity (mTLS cert issuance);
placement solver; dealer + verifier services (managed mode); share router
(store-and-forward); quotas/estimates endpoint; quarantine and reputation
*events* (storage of reputation is FT-05); cells and residency; transparency
log (M4).

**Out of scope:** crypto math (FT-01, called as a library); metering ledger
persistence and payouts (FT-05 — FT-02 *emits* receipts); LLM session relay
(FT-06); agent internals (FT-03).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| CP-R1 | Job lifecycle identical to PoC semantics: dispatch → verify → (quarantine + re-dispatch on failure) → deliver; customer never receives unverified results and is never billed for rejected attempts | P0 | M1 |
| CP-R2 | Device registry with per-device certificates; enrollment binds device→owner→payout (with FT-05) | P0 | M1 |
| CP-R3 | Placement solver enforcing anti-collusion constraints (master PRD §8.4): distinct share indices never on devices sharing owner, payout account, /24, ASN+city, or hardware-fingerprint cluster; infeasible placements fail fast with a clear error | P0 | M1 |
| CP-R4 | Share router: store-and-forward bundles; agents dial out only; router cannot open strict-mode bundles | P0 | M1 |
| CP-R5 | Deterministic quotes endpoint (`estimate`) from template work-unit functions (PoC parity) | P0 | M1 |
| CP-R6 | Redundant execution (r replicas per share index) with cross-checking to pinpoint cheaters (upgrades PoC's whole-attempt quarantine) | P0 | M2 |
| CP-R7 | Cell partitioning: placement, routing, and residency constrained per cell; registry/billing global | P0 | M3 |
| CP-R8 | Transparency log: append-only, externally verifiable record of placement decisions | P1 | M4 |

## 4. Interface contracts

- **Coordinator↔Agent protocol** (owned here, consumed by FT-03): register,
  poll/receive bundle, submit result-share, heartbeat. Versioned; PoC HTTP
  shapes are v0.
- **Job API** (consumed by FT-04): submit, estimate, status, result retrieval.
- **Receipt emission** (consumed by FT-05): one receipt per worker-attempt
  with units, verified flag, signatures — schema owned jointly with FT-05.
- **Placement query** (consumed by FT-06 for pipeline-stage placement).

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Sybil supplier | enroll many fake devices to capture ≥t shares of one job | CP-R3 constraints; enrollment KYC via FT-05; device fingerprinting; per-account caps |
| Malicious worker | corrupt results, drop work, stall | verification (FT-01 checks orchestrated here), deadline-aware re-dispatch, quarantine, receipts unpayable |
| Compromised coordinator node | read managed-mode plaintext during dealing; bias placement | strict mode removes dealing (FT-04); dealer isolated per role, minimal retention, audited; transparency log exposes placement bias |
| Malicious customer | oversized/malformed payloads, resource exhaustion | schema validation + size bounds at boundary (Standards §4); quotas, budget caps |
| Pool-token attacker (SEC-001 gap 1) | leaked org enrollment token / pool foothold ⇒ enrolls rogue devices into a pool with relaxed anti-collusion; collects ≥ t shares of one job | short-lived attestation-bound enrollment tokens (K10); org device-approval queue; **non-relaxable anti-collusion floor** (distinct physical device + one share index per device) that pool policy can never go below — CP-015 ⚠ |
| Network adversary (master §7.1 row, SEC-001 gap 9) | intercepts share traffic | mTLS with per-device certs (CP-002); outbound-only router (CP-006); shares individually worthless by construction |

## 6. QA requirements

- e2e suite: every endpoint, every template, PoC-parity golden transcripts.
- Adversarial suite: tampering worker (result + opening), Sybil fixture
  fleets that must be refused placement, replayed result shares rejected.
- Placement solver: property tests that no emitted placement violates a
  constraint, plus perf target (place n=1000 within 5 s at 10⁵ registered
  devices — master PRD §8.5) in nightly load run.
- Chaos (M3): worker dropout mid-job, router partition — completion SLA holds.

## 7. Decision Records

- **DR-CP-01 (2026-07-03):** PoC job-lifecycle semantics (verify-before-
  deliver, quarantine, no-bill-on-reject) are frozen product behavior; any
  deviation is a new DR.

## 8. Open Questions

- ~~**OQ-CP-01**~~ — RESOLVED 2026-07-03 by **DR-PF-03**: cell schedulers /
  relays / session state as Cloudflare Durable Objects + R2 share store;
  registry/ledger in Supabase Postgres; consoles on Vercel.
- **OQ-CP-02** (owner: eng; default: pull-based with signed work manifests):
  agent transport v1 — long-poll pull vs persistent WebSocket; decide with
  battery data from FT-03 mobile experiments (HA-007).

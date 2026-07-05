# FT-02 — Coordinator / Control Plane — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| CP-001 | P0 | Service skeleton + Job API v0 (Cloudflare Workers/DO per DR-PF-03) | PF-003 | submit/estimate/status/result endpoints; schema validation + size bounds on every input; e2e tests against ephemeral instance | Ready | |
| CP-002 | P0 ⚠ | Registry + device identity (mTLS cert issuance) | CP-001 | enrollment issues per-device certs; revocation works; adversarial test: forged/expired cert rejected | Ready | |
| CP-003 | P0 ⚠ | Placement solver with anti-collusion constraints | CP-002 | property test: no emitted placement violates §8.4 constraints; Sybil fixture fleet refused; infeasible request fails fast with actionable error | Ready | |
| CP-004 | P0 ⚠ | Dealer service (managed mode) | CC-031, CP-001 | deals via FT-01 bindings only; plaintext retention zero after dispatch (verified by test hooks); golden parity with PoC dealing | Proposed | |
| CP-005 | P0 ⚠ | Verifier service | CC-031, CP-004 | orchestrates FT-01 checks incl. opening MACs; PoC-parity adversarial suite passes (tamper result, tamper opening) | Proposed | |
| CP-006 | P0 | Share router (store-and-forward) | CP-001 | agents pull bundles / push result-shares over outbound-only connections; router storage opaque for strict bundles; bandwidth metered at router | Proposed | |
| CP-007 | P0 | Quarantine + reputation events + receipt emission | CP-005 | PoC semantics preserved (DR-CP-01); receipts emitted per worker-attempt matching FT-05 schema; no-bill-on-reject covered by test | Proposed | |
| CP-008 | P0 | Deterministic quotes endpoint | CP-001 | unit functions shared with FT-05 pricing; quote == final bill for verified single-attempt jobs (test) | Proposed | |
| CP-009 | P0 ⚠ | Redundant execution + cheater pinpointing | CP-005, CP-007 | r replicas per share index; disagreeing replica identified; honest workers on failed attempts no longer collateral-quarantined (upgrade of PoC behavior, new DR) | Proposed | |
| CP-010 | P0 | Cell partitioning + residency enforcement | CP-003, CP-006 | jobs with residency policy never place/route outside allowed cells (property test); cross-cell attempt fails fast | Proposed | |
| CP-011 | P1 | Placement perf target | CP-003 | nightly load run: n=1000 placement < 5 s at 10⁵ simulated devices | Proposed | |
| CP-012 | P1 ⚠ | Transparency log of placement decisions | CP-010 | append-only, hash-chained, externally verifiable; documented verification procedure | Proposed | |
| CP-013 | P0 ⚠ | Metering seam producer: receipts in DO txn + R2 hash-chained log + Queue enqueue | CP-007 | SEAMS.md §4 flow implemented; chaos test (Supabase down mid-flow) shows zero loss after drain; duplication test passes; watermark metrics exported | Proposed | |
| CP-014 | P0 ⚠ | Pool tenancy in placement (F19, MVP per DR-08) | CP-003, CP-015 (floor design) | pool_id is a hard placement constraint: property test proves no cross-pool placement in either direction; private-pool jobs with no burst policy fail fast rather than leak to public; org-scoped API keys enforced at job intake; placement respects the CP-015 anti-collusion floor | In Review | `platform/placement/` (module + tests). DONE: pool scoping is a hard constraint in both directions (filter-by-construction + `verifyPlacement`/`assertFloor` re-assertion), property-tested both directions; private-pool-no-burst fails fast (test); placement respects the CP-015 floor. NOT DONE (out of this module's scope, tracked): **org-scoped API keys enforced at job intake** belongs to the Job API (CP-001) — see new CP-016. Needs ⚠ human approver + 2 reviews before Done. |
| CP-015 | P0 ⚠ | Pool anti-collusion floor + enrollment-token lifecycle (SEC-001 gap 1) | CP-002, HA-005 | non-relaxable floor defined (distinct physical device, one share index per device) with FT-07 sign-off; K10 tokens short-lived/attestation-bound/single-use with org approval queue; property test: no pool policy can place ≥ t share indices on colluding-capable devices; MUST merge before CP-014 | In Review | `platform/placement/` (module + tests). DONE: non-relaxable floor defined and enforced (F-a one index/device, F-b `<t` distinct indices/fingerprint-cluster; not a policy knob — relaxing it is rejected); independent `assertFloor` re-check on every emitted placement; property test proves no pool policy (even maximally relaxed) places ≥ t indices on colluding-capable devices, incl. the SEC-001 gap-1 Sybil-swarm attack; K10 tokens short-lived (≤72h)/single-use/pool-bound with deterministic time. NOT DONE (tracked): **FT-07 sign-off** on the floor definition (human gate, SEC-001); token **attestation-binding** depends on HA-005 (out of scope here) — see CP-017; **org device-approval queue** is a control-plane workflow — see CP-018. Needs ⚠ human approver + 2 reviews before Done. |
| CP-016 | P0 | Org-scoped API keys enforced at job intake (CP-014 residual) | CP-001 | job intake rejects a job whose API key is not scoped to the job's poolId; public keys cannot submit pool jobs and vice versa; adversarial test: cross-pool key refused at the boundary | Proposed | Split out of CP-014: intake-layer concern, not placement-algorithm. |
| CP-017 | P0 ⚠ | Attestation-bind enrollment tokens (CP-015 residual) | CP-015, HA-005 | enrollment token consumption additionally requires a valid device attestation report bound to the token batch; forged/absent attestation rejected; the fingerprint signal the placement floor relies on is attested, not self-declared | Proposed | Split out of CP-015: closes the "honest fingerprinting" assumption the floor depends on. |
| CP-018 | P0 | Org device-approval queue for pool enrollment (CP-015 residual) | CP-015 | a device enrolled with a valid token lands in a per-org pending queue; it is not eligible supply until an org admin approves; leaked-token enrollments are quarantined pending org confirmation (K10 recovery) | Proposed | Split out of CP-015: stateful control-plane workflow, not a pure algorithm. |

## Change log

- 2026-07-03: tracker created. CP-001 blocked on hosting decision OQ-PF-01.
- 2026-07-03: DR-PF-03 ratified — CP-001 unblocked (Cloudflare stack); added
  CP-013 (metering seam producer per SEAMS.md).
- 2026-07-05: CP-014 + CP-015 placement algorithm delivered as standalone
  zero-dep module `platform/placement/` (anti-collusion §8.4, pool scoping,
  non-relaxable floor, enrollment-token lifecycle). 37 tests green
  (`node --test test/*.test.js`) incl. property/soundness over 1800 randomised
  fleets, the SEC-001 gap-1 Sybil-swarm attack, cross-pool leak both
  directions, and reused/expired token cases. Both moved to In Review
  (⚠ HIGH-RISK: need named human approver + 2 reviews). Residual acceptance
  items split out and tracked: CP-016 (org-scoped API keys at intake),
  CP-017 (attestation-bound tokens, dep HA-005), CP-018 (org device-approval
  queue). FT-07 sign-off on the floor definition still pending.

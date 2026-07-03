# FT-02 — Coordinator / Control Plane — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| CP-001 | P0 | Service skeleton + Job API v0 | PF-003, OQ-PF-01 | submit/estimate/status/result endpoints; schema validation + size bounds on every input; e2e tests against ephemeral instance | Blocked(OQ-PF-01) | |
| CP-002 | P0 ⚠ | Registry + device identity (mTLS cert issuance) | CP-001 | enrollment issues per-device certs; revocation works; adversarial test: forged/expired cert rejected | Ready after CP-001 | |
| CP-003 | P0 ⚠ | Placement solver with anti-collusion constraints | CP-002 | property test: no emitted placement violates §8.4 constraints; Sybil fixture fleet refused; infeasible request fails fast with actionable error | Ready after CP-002 | |
| CP-004 | P0 ⚠ | Dealer service (managed mode) | CC-031, CP-001 | deals via FT-01 bindings only; plaintext retention zero after dispatch (verified by test hooks); golden parity with PoC dealing | Proposed | |
| CP-005 | P0 ⚠ | Verifier service | CC-031, CP-004 | orchestrates FT-01 checks incl. opening MACs; PoC-parity adversarial suite passes (tamper result, tamper opening) | Proposed | |
| CP-006 | P0 | Share router (store-and-forward) | CP-001 | agents pull bundles / push result-shares over outbound-only connections; router storage opaque for strict bundles; bandwidth metered at router | Proposed | |
| CP-007 | P0 | Quarantine + reputation events + receipt emission | CP-005 | PoC semantics preserved (DR-CP-01); receipts emitted per worker-attempt matching FT-05 schema; no-bill-on-reject covered by test | Proposed | |
| CP-008 | P0 | Deterministic quotes endpoint | CP-001 | unit functions shared with FT-05 pricing; quote == final bill for verified single-attempt jobs (test) | Proposed | |
| CP-009 | P0 ⚠ | Redundant execution + cheater pinpointing | CP-005, CP-007 | r replicas per share index; disagreeing replica identified; honest workers on failed attempts no longer collateral-quarantined (upgrade of PoC behavior, new DR) | Proposed | |
| CP-010 | P0 | Cell partitioning + residency enforcement | CP-003, CP-006 | jobs with residency policy never place/route outside allowed cells (property test); cross-cell attempt fails fast | Proposed | |
| CP-011 | P1 | Placement perf target | CP-003 | nightly load run: n=1000 placement < 5 s at 10⁵ simulated devices | Proposed | |
| CP-012 | P1 ⚠ | Transparency log of placement decisions | CP-010 | append-only, hash-chained, externally verifiable; documented verification procedure | Proposed | |

## Change log

- 2026-07-03: tracker created. CP-001 blocked on hosting decision OQ-PF-01.

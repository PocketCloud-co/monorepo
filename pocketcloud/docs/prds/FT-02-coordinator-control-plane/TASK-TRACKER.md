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
| CP-014 | P0 ⚠ | Pool tenancy in placement (F19, MVP per DR-08) | CP-003 | pool_id is a hard placement constraint: property test proves no cross-pool placement in either direction; private-pool jobs with no burst policy fail fast rather than leak to public; org-scoped API keys enforced at job intake | Proposed | |

## Change log

- 2026-07-03: tracker created. CP-001 blocked on hosting decision OQ-PF-01.
- 2026-07-03: DR-PF-03 ratified — CP-001 unblocked (Cloudflare stack); added
  CP-013 (metering seam producer per SEAMS.md).

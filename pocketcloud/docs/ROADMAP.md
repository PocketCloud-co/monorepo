# Pocket Cloud — Roadmap: Milestones, Deliverables, Exit Criteria

Milestones are the delivery view of master PRD §11. Every deliverable maps to
a feature PRD (`docs/prds/FT-xx-*`) and every piece of work to a task ID in
that feature's `TASK-TRACKER.md`. Nothing ships without the gates in
`ENGINEERING-STANDARDS.md`.

Status legend: ✅ done · 🔨 in progress · ⬜ not started

## M0 — Protocol PoC & Delivery Framework (now)

Goal: prove the protocol; stand up the machinery that makes everything after
this CI/CD/QA-able.

| Deliverable | Feature | Status |
|---|---|---|
| PoC: sharing + MACs + Beaver + coordinator/worker + tamper handling | FT-01/FT-02 (reference) | ✅ |
| PoC: deterministic metering, quotes, receipts, ledger invariant | FT-05 (reference) | ✅ |
| Master PRD + Appendices (LLM serving, metering) | — | ✅ |
| Engineering Standards (binding canon) | FT-00 | ✅ |
| Hierarchical feature-PRD + task-tracker framework | FT-00 | ✅ |
| CI pipeline running PoC suite on every PR | FT-00 (PF-001) | ✅ |
| Device runtime decision doc (runc question, per-tier substrates) | FT-03 (HA-001) | ✅ |
| Seam standard + registry (`SEAMS.md`), hosting DR-PF-03 ratified | FT-00 | ✅ |
| MVP plan (binding execution order, `MVP-PLAN.md`, DR-PF-04) | FT-00 | ✅ |

**Exit criteria:** PR checks green and blocking; all 9 feature PRDs populated
with tasks; PoC demo + 19 tests pass in CI.

## M1 — Foundations (≈ next quarter)

Goal: production skeletons with the quality machinery live from day one.

| Deliverable | Feature |
|---|---|
| Monorepo production layout + full pipeline gates (lint/type/unit/adversarial/e2e/golden/audit) | FT-00 |
| Rust crypto core at PoC parity, property-based + adversarial tests, ≥95% coverage | FT-01 |
| Coordinator v0 (registry, placement w/ anti-collusion constraints, dealer, verifier) as deployable services | FT-02 |
| Host agent v0: desktop (Win/mac/Linux), WASM sandbox, resource caps, signed builds | FT-03 |
| Python SDK v0 (managed mode), job lifecycle, quotes | FT-04 |
| Metering ledger service (Postgres, double-entry), receipts | FT-05 |
| Golden-transcript regression harness for the protocol | FT-00/FT-01 |
| Threat models recorded per feature; secret scanning + dependency audit in CI | FT-07 |
| Structured telemetry + correlation IDs from all services | FT-08 |

**Exit criteria:** end-to-end job on the production stack (not PoC) across 3
real machines; injected-fault detection 100% in CI adversarial suite;
reproducible signed agent build.

## M2 — Private Alpha (PRD Phase 1)

| Deliverable | Feature |
|---|---|
| Fleet supply onboarding (P3 MSP fleets), org enrollment | FT-03/FT-05 |
| Managed-mode jobs for 5 design partners (T1/T2 templates) | FT-02/FT-04 |
| Stripe Connect payout loop (KYC → accrual → payout → 1099 data) | FT-05 |
| Canary-job system v0 (known-answer probes) | FT-08 |
| Host & customer consoles v0 | FT-05/FT-08 |
| Incident response runbook + on-call | FT-08 |

**Exit criteria:** 10 real jobs/week; payout loop executed end-to-end;
verification catches 100% of injected faults; zero HIGH-RISK merges without
human approver (audited).

## M3 — Host Beta (PRD Phase 2)

| Deliverable | Feature |
|---|---|
| Public host onboarding (P1/P2), mobile agent tier per FT-03 runtime doc | FT-03 |
| Strict mode: dealing/verification in customer SDK | FT-04/FT-01 |
| Shamir t-of-n + dropout tolerance | FT-01 |
| Reputation v1 + probation placement | FT-02/FT-05 |
| LLM serving Mode 1/Mode 2 pilot on homelab tier (pipeline, relay, session pinning) | FT-06 |
| External security audit #1 (crypto core + agent) — findings closed | FT-07 |
| Load/soak + chaos suites in CI (churn, partitions) | FT-00/FT-08 |

**Exit criteria:** 2,000 devices; completion SLA ≥99% Standard tier; audit #1
clean or all findings remediated; strict mode default for privacy templates.

## M4 — Commercial GA (PRD Phase 3)

| Deliverable | Feature |
|---|---|
| T3 nonlinear kernels GA; storage product (erasure-coded shares + retrievability proofs) | FT-01/FT-02 |
| EU cell + residency enforcement; transparency log of placement decisions | FT-02/FT-07 |
| SOC 2 Type II; DPIA templates; export-control review complete | FT-07 |
| Billing GA: invoicing, spend controls, disputes-from-receipts | FT-05 |
| Security audit #2; bug bounty live | FT-07 |

**Exit criteria:** PRD §12 GA KPIs; revenue-positive job classes; fraud loss
< 0.5% GMV.

## M5 — Scale & Research (PRD Phase 4, ongoing)

Distributed Beaver-triple generation and multi-party dealing (FT-01), GPU/NPU
via WASI-NN (FT-03), metadata privacy (FT-07), spot market (FT-05),
arbitrary-code sandbox tier (FT-03), Mode-3 MPC boundary expansion (FT-06).

---

### North-star review (DR-09)

Every milestone close includes a review against
[`STRATEGY-NORTH-STAR.md`](STRATEGY-NORTH-STAR.md) — "are we closer to the
embedded home-edge play?" — checking the standing embeddability requirement
on the agent core and the partner-wave readiness (P-0 → P-3).

### Milestone discipline

- A milestone closes only when every listed deliverable's tasks are `Done`
  in their trackers and the exit criteria are demonstrated by CI artifacts or
  recorded evidence — not by assertion.
- Scope changes to a milestone are Decision Records in FT-00, dated, with the
  displaced work explicitly re-homed (never silently dropped).

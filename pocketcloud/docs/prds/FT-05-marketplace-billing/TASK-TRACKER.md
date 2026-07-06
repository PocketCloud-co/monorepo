# FT-05 — Marketplace & Billing — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| MB-001 | P0 ⚠ | Ledger service: append-only double-entry (Supabase Postgres per DR-PF-03) | PF-003 | property tests: invariant under generated interleavings; imbalance halts payouts + alerts; hash-chained entries; **ledger is a projection of the R2 receipt log (SEAMS.md §4), never the only copy** | In Review | `platform/ledger/` — core logic + 9 tests; **`platform/supabase/` — the Postgres schema (receipts with a per-row double-entry CHECK, invariant view, hash-chain fields, versioned price config) + RLS, proven against a real ephemeral Postgres in CI**. Remaining: the R2→Postgres seam (CP-013/MB-013) + halt-on-imbalance alerting (deployment) |
| MB-002 | P0 ⚠ | Receipt ingestion + dual-signature verification | MB-001, CP-007 | invalid/duplicate/unverified receipts quarantined (never paid, never dropped); schema versioned jointly with FT-02 | Proposed | |
| MB-003 | P0 ⚠ | Pricing config service | MB-001 | per-template prices + payout rate + tier multipliers as founder-approved config; quote reconciliation test with CP-008 | Proposed | |
| MB-004 | P0 ⚠ | Stripe Connect onboarding (hosts) | MB-001 | test-mode e2e: enroll → KYC state machine → account linked; per-account device caps enforced | Proposed | |
| MB-005 | P0 ⚠ | Accrual + payout runs + escrow window | MB-002, MB-004 | test-mode payout e2e; idempotent (replay = no-op); floor + escrow configurable (OQ-MB-02/03); clawback path tested | Proposed | |
| MB-006 | P0 ⚠ | Customer billing: invoices, spend caps, budget enforcement | MB-002, MB-003 | quote==bill test (MB-R3); no-bill-on-reject golden from PoC scenario; spend cap blocks at submission (with SDK-002) | Proposed | |
| MB-007 | P0 | Reputation store + read API | MB-002 | uptime/verified-rate/speed persisted; placement consumes in e2e; host-visible reasons (F12) | Proposed | |
| MB-008 | P0 ⚠ | Fraud engine v0 | MB-002, OO-004 | fixtures flag: implausible speed, payout clustering, canary failure; action = hold + human queue, audited | Proposed | |
| MB-009 | P0 | Host console v0 | MB-005, MB-007 | earnings, devices, policy link, payout history, tax docs; usability pass with a non-technical tester | Proposed | |
| MB-010 | P0 | Customer console v0 | MB-006 | jobs, spend, budgets, verification-transcript download | Proposed | |
| MB-011 | P1 ⚠ | 1099/tax export | MB-005 | 1099-NEC/K data export matches ledger to the cent for fixture year | Proposed | |
| MB-012 | P1 | Dispute flow from receipts | MB-006, SDK-009 | documented flow; both parties retrieve identical signed evidence bundle | Proposed | |
| MB-013 | P0 ⚠ | Metering seam consumer + reconciliation + rebuild runbook | MB-001, CP-013 | idempotent queue consumer (ON CONFLICT DO NOTHING); hourly R2-log↔ledger reconciliation pages on divergence and freezes payouts; payout/invoice runs refuse on stale watermark; full ledger rebuild from R2 log rehearsed and documented | In Review | `platform/seam/` (consumer + reconcile + rebuild + freshness watermark, zero-dep). DONE: idempotent consumer proven against the REAL `pc.receipts` schema (`ON CONFLICT (receipt_id) DO NOTHING` — duplicate delivery yields one row, real SQL); reconciliation returns a converged go/no-go and detects a projection that fell behind (S6); stale-watermark `canSettle()` guard refuses payouts (S5); **full rebuild-from-R2 rehearsed** — truncate `pc.receipts`, rebuild from the log alone, reconcile converges — in the ephemeral-Postgres CI harness (S8). NOT DONE (deployment, tracked): wire the hourly reconciliation cron + PagerDuty divergence alert; persist the watermark to `pc.ledger_watermark`; write the human-facing rebuild runbook doc. Needs ⚠ human approver before Done. |
| MB-014 | P0 ⚠ | Showback/chargeback for private pools (F21, MVP per DR-08) | MB-002 | per-pool, per-team/project usage reports rendered from the same receipts; payouts disabled per pool config with ledger invariant still balancing (platform side = license, not take); SaaS license billing line per pool; property test (SEC-001 gap 11): a pool cannot simultaneously disable payouts AND accrue worker millicredits | Proposed | |
| MB-015 | P0 ⚠ | Payout-detail-change protection (SEC-001 gap 3) | MB-004 | step-up auth (OTP) required on payout-destination change; change notifies prior contact; interacts correctly with escrow window (no withdrawal until window passes post-change); adversarial test with phished-credential fixture | Proposed | |

## Change log

- 2026-07-03: tracker created. PoC ledger semantics (verified-only pay,
  no-bill-on-reject, invariant) are the golden floor for MB-001/002/006.
- 2026-07-03: DR-PF-03 ratified — MB-001 unblocked (Supabase Postgres);
  added MB-013 (seam consumer, reconciliation, rebuild runbook per SEAMS.md).
- 2026-07-05: MB-001 core logic implemented (`platform/ledger/`, dep-free
  Node, 9 tests green in CI). Directly fixes review finding 2 (invariant was
  tautological — now derives every leg independently and provably fails on a
  corrupt leg) and one-way-door audit finding 1 (versioned, canonically
  hash-chained receipts; tamper-detectable). License mode (MB-014) + SEC-001
  gap-11 guard implemented. Held at In Review pending Postgres/R2 persistence
  and halt-on-imbalance alerting (need deployment).
- 2026-07-05: Supabase schema landed (`platform/supabase/`, DR-PF-03): pools +
  enrollment-token lifecycle, device registry + reputation, and the ledger
  receipts table with a PER-ROW double-entry CHECK (unbalanced rows cannot be
  inserted), payable-iff-verified / reject-bills-zero CHECKs, hash-chain
  fields, versioned price config, the `ledger_summary` invariant view, and the
  freshness watermark. Full RLS (org-scoped, append-only receipts). Proven
  against a real ephemeral Postgres 16 in a new CI job. Also advances FT-02
  CP-002 (registry) and CP-015 (token lifecycle in SQL). Remaining for MB-001
  Done: the R2→Postgres seam (MB-013/CP-013) + alerting.
- 2026-07-05: MB-013 metering-seam **consumer + reconciliation + rebuild**
  delivered as zero-dep module `platform/seam/` (paired with CP-013 producer).
  Idempotent consumer + reconcile + rebuild-from-R2 proven against the REAL
  `pc.receipts` schema via a new ephemeral-Postgres integration harness
  (`tests/run-pg-integration.sh`), plus 11 portable seam tests (S1-S6, tamper,
  cross-partition anchoring) — both wired into `pocketcloud-ci`. This is the
  SEAMS §4 reference design making "Supabase down = lag, never loss" real and
  tested. Moved to In Review (⚠ needs human approver + reconciliation cron /
  divergence alerting / watermark persistence / rebuild runbook doc before
  Done). Unblocks MB-001 → Done once alerting ships.

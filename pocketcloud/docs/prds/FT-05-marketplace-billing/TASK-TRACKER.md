# FT-05 — Marketplace & Billing — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| MB-001 | P0 ⚠ | Ledger service: append-only double-entry (Postgres) | PF-003, OQ-PF-01 | property tests: invariant under generated interleavings; imbalance halts payouts + alerts; hash-chained entries | Blocked(OQ-PF-01) | |
| MB-002 | P0 ⚠ | Receipt ingestion + dual-signature verification | MB-001, CP-007 | invalid/duplicate/unverified receipts quarantined (never paid, never dropped); schema versioned jointly with FT-02 | Proposed | |
| MB-003 | P0 | Pricing config service | MB-001 | per-template prices + payout rate + tier multipliers as founder-approved config; quote reconciliation test with CP-008 | Proposed | |
| MB-004 | P0 ⚠ | Stripe Connect onboarding (hosts) | MB-001 | test-mode e2e: enroll → KYC state machine → account linked; per-account device caps enforced | Proposed | |
| MB-005 | P0 ⚠ | Accrual + payout runs + escrow window | MB-002, MB-004 | test-mode payout e2e; idempotent (replay = no-op); floor + escrow configurable (OQ-MB-02/03); clawback path tested | Proposed | |
| MB-006 | P0 ⚠ | Customer billing: invoices, spend caps, budget enforcement | MB-002, MB-003 | quote==bill test (MB-R3); no-bill-on-reject golden from PoC scenario; spend cap blocks at submission (with SDK-002) | Proposed | |
| MB-007 | P0 | Reputation store + read API | MB-002 | uptime/verified-rate/speed persisted; placement consumes in e2e; host-visible reasons (F12) | Proposed | |
| MB-008 | P0 ⚠ | Fraud engine v0 | MB-002, OO-004 | fixtures flag: implausible speed, payout clustering, canary failure; action = hold + human queue, audited | Proposed | |
| MB-009 | P0 | Host console v0 | MB-005, MB-007 | earnings, devices, policy link, payout history, tax docs; usability pass with a non-technical tester | Proposed | |
| MB-010 | P0 | Customer console v0 | MB-006 | jobs, spend, budgets, verification-transcript download | Proposed | |
| MB-011 | P1 | 1099/tax export | MB-005 | 1099-NEC/K data export matches ledger to the cent for fixture year | Proposed | |
| MB-012 | P1 | Dispute flow from receipts | MB-006, SDK-009 | documented flow; both parties retrieve identical signed evidence bundle | Proposed | |

## Change log

- 2026-07-03: tracker created. PoC ledger semantics (verified-only pay,
  no-bill-on-reject, invariant) are the golden floor for MB-001/002/006.

# FT-05 — Marketplace & Billing — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (business parameters are founder-only decisions) |
| **Master PRD sections** | §9 (economics + metering), F11, F14–F18, §10.4 |
| **Milestones** | M1 (ledger), M2 (payout loop), M4 (billing GA) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-05 owns the money: the metering ledger, receipts, pricing, customer
billing, host payouts (Stripe Connect), reputation storage, the fraud
engine, and both consoles. The metering *principles* are fixed by master PRD
§9.4 and proven in the PoC (deterministic units, pay-only-on-verified,
double-entry invariant); this feature productionizes them. Every money
mutation is HIGH-RISK by definition.

## 2. Scope

**In scope:** ledger service (Postgres, double-entry); receipt ingestion and
dual-signature verification; pricing configuration; quotes reconciliation;
invoicing and spend controls; Stripe Connect onboarding/payouts/tax exports;
reputation store; fraud/anomaly engine; canary-results consumption; host and
customer consoles.

**Out of scope:** receipt *emission* and unit computation (FT-02, shared
schema); canary job *execution* (FT-08); KYC/sanctions policy (FT-07 owns
policy, FT-05 integrates the vendor).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| MB-R1 | Append-only double-entry ledger: every customer millicredit = host payouts + platform take; invariant checked continuously; imbalance halts payouts and pages (PoC invariant, productionized) | P0 | M1 |
| MB-R2 | Receipts payable only with verified flag + valid worker and verifier signatures; unverifiable receipts quarantine for investigation, never silently paid or dropped | P0 | M1 |
| MB-R3 | Customers never billed for rejected attempts; quote == bill for single-attempt verified jobs (test-enforced with FT-02) | P0 | M1 |
| MB-R4 | Stripe Connect host onboarding (KYC), accrual, payout runs, 1099 data export; payout floor + escrow window configurable | P0 | M2 |
| MB-R5 | Idempotent money operations end-to-end (submission tokens → ledger entries → payout items); replays provably no-op | P0 | M1 |
| MB-R6 | Fraud engine v0: physically-implausible-performance flags, payout-account clustering, device-count caps, canary-failure ingestion; actions are holds + human review, never silent confiscation | P0 | M2 |
| MB-R7 | Reputation store: uptime, verified-result rate, speed class; consumed by FT-02 placement; host-visible with reasons (F12) | P0 | M2 |
| MB-R8 | Consoles: host (earnings, devices, policy, tax docs) and customer (jobs, spend, budgets, audit exports) | P0 | M2 |
| MB-R9 | Disputes resolved from receipts: both sides see the same signed evidence; documented dispute flow | P1 | M4 |

## 4. Interface contracts

- **Receipt schema** (joint with FT-02): receiptId, jobId, attempt, workerId,
  units, verified, workerSig, verifierSig. Versioned; changes update both PRDs.
- **Reputation read API** (consumed by FT-02 placement).
- **Pricing config** (owned here): per-template unit prices, payout rate,
  SLA-tier multipliers — founder-approved values only (OQ discipline).
- Consumes Stripe Connect (vendor contract documented in SEC-005 context).

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Host inflating earnings | forge/replay receipts, fake speed | signatures + verified-only payables; idempotency; canaries; implausibility flags; escrow+clawback window |
| Sybil payout farming | many devices, one actor | payout-account clustering, KYC'd Connect accounts, device caps, attestation signals from FT-03 |
| Customer fraud | chargebacks after consuming results, budget abuse | quotes precommitted, receipts as evidence, spend caps, KYC above threshold (FT-07 policy) |
| Insider / bug | ledger manipulation | append-only + hash-chained ledger, invariant monitor halts payouts, dual review on money-path merges (⚠), audit trail |
| Payment vendor failure | payouts stall | payout retry queue, vendor-status runbook (FT-08), no double-pay on retry (idempotency) |

## 6. QA requirements

- Property tests on the ledger: invariant holds under arbitrary interleaved
  receipt/billing/payout sequences (generated); imbalance triggers halt.
- Golden ledgers: PoC scenarios (incl. tamper-attempt-earns-zero) reproduced
  on the production ledger byte-for-byte at the summary level.
- Money-path e2e with Stripe test mode in CI: onboard → accrue → payout →
  1099 export; replay/duplicate suites.
- Fraud fixtures: implausible-speed, cluster, replay cases must flag.

## 7. Decision Records

- **DR-MB-01 (2026-07-03):** Metering principles (deterministic units,
  pay-only-on-verified, double-entry invariant, no-bill-on-reject) are frozen
  product behavior per master PRD §9.4 and the PoC.
- **DR-MB-02 (2026-07-03):** Fiat only via Stripe Connect (master DR-02
  restated). No token, no internal currency beyond ledger credits pegged 1:1
  to billed fiat.

## 8. Open Questions

- **OQ-MB-01** (owner: founder; default 40%): platform take rate (master
  OQ-2). Encoded as config, not code.
- **OQ-MB-02** (owner: founder; default $25): payout floor per run (master
  OQ-1 dependency).
- **OQ-MB-03** (owner: founder; default 7 days): escrow/clawback window
  before earnings are withdrawable.

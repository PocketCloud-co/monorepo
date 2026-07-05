# M2 — Private Alpha / MVP Exit — Milestone Tracker

> Parent: [`PROJECT-TRACKER.md`](../PROJECT-TRACKER.md) · Exit criteria: ROADMAP §M2 **plus** MVP-PLAN §2 (DR-08 additions)
> Milestone DoD: deliverables Done + Standards §9 review + north-star review + founder sign-off DR (this is the MVP gate).

| Deliverable | Owning tasks | Status |
|---|---|---|
| Metering seam end-to-end (DO+R2 log → Queue → Postgres ledger, reconciliation, rebuild runbook) | CP-013, MB-001, MB-002, MB-013 | ⬜ |
| Pricing config + customer billing (quote==bill, no-bill-on-reject) | MB-003, MB-006 | ⬜ |
| Stripe payout loop (onboard → accrue → payout → tax export) | MB-004, MB-005, MB-011 | ⬜ |
| **Private pools: scoped placement, org auth, MDM silent install, showback** (DR-08) | CP-014, SDK-010, HA-011, HA-017, MB-014 | ⬜ |
| Python SDK v0 (lifecycle, quotes/budgets, idempotency) | SDK-001..SDK-003, SDK-006 | ⬜ |
| Signed builds + auto-update + artifact cache | PF-008, PF-009, HA-006, HA-008 | ⬜ |
| Canary system + fraud v0 + reputation | OO-004, MB-007, MB-008 | ⬜ |
| Consoles v0 (host + customer, Vercel) | MB-009, MB-010 | ⬜ |
| Ops: dashboards, SLOs, alerting, runbooks; seam observability | OO-002, OO-003, OO-005, OO-006, OO-010 | ⬜ |
| KYC policy + legal pack v1 | SEC-005, SEC-006 | ⬜ |
| Chaos harness + seam chaos suite | PF-011, OO-007 | ⬜ |

**Exit checklist (= MVP):** [ ] 10 real jobs/week (design partners) ·
[ ] a real host paid real money · [ ] **one enterprise private pool live on
≥20 MDM-deployed devices with showback** · [ ] 100% injected-fault
detection · [ ] pool-isolation property tests green · [ ] reconciliation
clean 30 consecutive days · [ ] quote==bill on every verified job ·
[ ] §9 review passed · [ ] founder MVP sign-off DR recorded.

## Change log
- 2026-07-04: created.

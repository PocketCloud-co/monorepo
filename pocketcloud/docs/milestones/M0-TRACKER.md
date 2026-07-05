# M0 — PoC & Delivery Framework — Milestone Tracker

> Parent: [`PROJECT-TRACKER.md`](../PROJECT-TRACKER.md) · Exit criteria: ROADMAP §M0
> Milestone DoD: all deliverables Done + independent review (Standards §9) passed + change logs current.

| Deliverable | Owning tasks | Status | Evidence |
|---|---|---|---|
| Protocol PoC (sharing, MACs, Beaver, coordinator/agent, tamper self-heal) | (reference impl; floor for CC/CP tasks) | ✅ | 19/19 tests + 4-act demo in CI |
| Deterministic metering PoC (quotes, receipts, ledger invariant) | (reference impl; floor for MB tasks) | ✅ | metering tests + demo act 4 |
| Master PRD + appendices + strategy docs (north star, business, feasibility) | — | ✅ | `docs/*.md` |
| Engineering standards + seam standard | — | ✅ | ENGINEERING-STANDARDS.md, SEAMS.md |
| Feature-PRD framework (9 areas, trackers) | — | ✅ | `prds/` + CI integrity check |
| CI on every PR | PF-001 | ✅ | green check runs on PR #1 |
| Device runtime decision | HA-001 | ✅ | DEVICE-RUNTIME.md |
| Hierarchy completion: project/milestone trackers + integration specs | PF-013 | 🔨 this commit | PROJECT-TRACKER.md, milestones/, specs/ |
| Independent best-practices review gate defined + first full-stack review run | PF-014 | 🔨 this commit | Standards §9 + review report |

**Exit checklist:** [x] PoC suites green in CI · [x] 9 feature PRDs populated
· [ ] PF-013/PF-014 Done · [ ] M0 review findings resolved.

## Change log
- 2026-07-04: created; M0 near-complete pending PF-013/PF-014.

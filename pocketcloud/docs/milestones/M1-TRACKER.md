# M1 — Foundations — Milestone Tracker

> Parent: [`PROJECT-TRACKER.md`](../PROJECT-TRACKER.md) · Exit criteria: ROADMAP §M1 · Sequencing: MVP-PLAN Waves 0–1 (+ Wave 2 start)
> Milestone DoD: all deliverables Done + Standards §9 review passed + north-star review held.

| Deliverable | Owning tasks | Status |
|---|---|---|
| Full CI gate sequence live (lint/type/unit/adversarial/e2e/golden/audit/secret) | PF-002, PF-003, PF-004, PF-006, PF-007, PF-010 | ⬜ Ready |
| Golden-transcript regression harness | PF-005 | ⬜ Ready |
| Key management architecture ratified | SEC-003 | ⬜ Ready |
| Protocol spec (implementable without reading PoC) | CC-001 → SPEC-001/002 refresh | ⬜ Ready |
| Rust crypto core at PoC parity (field, sharing, MACs, Beaver, encoding; ≥95% cov; adversarial suite) | CC-010..CC-014, CC-020, CC-030 | ⬜ Ready |
| SDK bindings (PyO3/napi) | CC-031 | ⬜ |
| Coordinator v0 on Cloudflare (job API, registry, placement, dealer, verifier, router, receipts, quotes) | CP-001..CP-008 | ⬜ CP-001 Ready |
| Desktop agent v0 (WASM substrate, caps, identity, policy UX, churn resilience) | HA-002..HA-005, HA-007, HA-009 | ⬜ |
| Telemetry schema + scrubber adopted by all skeletons | OO-001 | ⬜ Ready |
| Threat models ratified + sign-off CI check | SEC-001, SEC-002 | ⬜ SEC-001 Ready |

**Exit checklist:** [ ] end-to-end job on production stack across 3 real
machines · [ ] injected-fault detection 100% in CI adversarial suite ·
[ ] reproducible signed agent build (PF-008 may land early M2 per
MVP-PLAN Wave 4; if so, record here) · [ ] §9 review passed.

## Change log
- 2026-07-04: created.

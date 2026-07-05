# Pocket Cloud — Project Tracker (root of the hierarchy)

> **This is the top of the tracking tree.** Every level below has its own
> tracker; nothing is tracked in only one head or one chat.
>
> ```
> PROJECT-TRACKER.md                (this file: project → milestones)
> └── milestones/M<n>-TRACKER.md    (milestone → deliverables → task IDs)
>     └── prds/FT-xx/TASK-TRACKER.md (feature → tasks: deps, acceptance)
>         └── specs/SPEC-xxx.md      (the integration contracts tasks build to)
> ```
>
> Update discipline: task status changes in the FEATURE tracker (source of
> truth); milestone trackers roll up deliverable status; this file rolls up
> milestone status. Each level appends to its own change log.

## Definition of Done — by level

| Level | Done means |
|---|---|
| **Task** | ENGINEERING-STANDARDS §1 checklist fully satisfied (tests shipped, CI green, docs + tracker updated, conventional commit referencing the task ID) |
| **Deliverable** | all mapped tasks Done AND the deliverable demonstrated by a CI artifact or recorded evidence |
| **Milestone** | all deliverables Done, exit criteria evidenced, **independent best-practices review (Standards §9) passed with findings resolved**, north-star review held (DR-09), change logs current |
| **Project phase** | milestone Done + founder sign-off recorded as a DR |

## Milestone rollup

| Milestone | Scope (one line) | Tracker | Status | Exit criteria ref |
|---|---|---|---|---|
| **M0** — PoC & Delivery Framework | protocol proven; standards/CI/frameworks live | [`milestones/M0-TRACKER.md`](milestones/M0-TRACKER.md) | ✅ Closed 2026-07-05 (first §9 review passed with findings dispositioned — `reviews/2026-07-05-full-stack-M0.md`) | ROADMAP §M0 |
| **M1** — Foundations | production skeletons, Rust core parity, gates enforced | [`milestones/M1-TRACKER.md`](milestones/M1-TRACKER.md) | ⬜ Ready to start (Wave 0/1 tasks Ready) | ROADMAP §M1 |
| **M2** — Private Alpha (= MVP exit, DR-08) | managed-mode jobs, payout loop, **enterprise private pool live** | [`milestones/M2-TRACKER.md`](milestones/M2-TRACKER.md) | ⬜ | ROADMAP §M2 + MVP-PLAN §2 |
| **M3** — Host Beta | public hosts, strict mode, Shamir, audit #1, LLM pilot | [`milestones/M3-TRACKER.md`](milestones/M3-TRACKER.md) | ⬜ | ROADMAP §M3 |
| **M4** — Commercial GA | T3 GA, storage, SOC 2, EU cell, billing GA | [`milestones/M4-TRACKER.md`](milestones/M4-TRACKER.md) | ⬜ | ROADMAP §M4 |
| **M5** — Scale & Research | distributed dealing, GPU/NPU, metadata privacy, spot | [`milestones/M5-TRACKER.md`](milestones/M5-TRACKER.md) | ⬜ ongoing bucket | ROADMAP §M5 |

## Feature rollup (task inventory snapshot — 2026-07-04)

| Feature | Tracker | Tasks | Done | In progress / Ready | Highest-risk open item |
|---|---|---|---|---|---|
| FT-00 Platform Foundations | [tracker](prds/FT-00-platform-foundations/TASK-TRACKER.md) | 14 | 3 (PF-001, 013, 014) | PF-002..007, PF-010 Ready | PF-008 signed reproducible builds ⚠ |
| FT-01 Crypto Core | [tracker](prds/FT-01-crypto-core/TASK-TRACKER.md) | 12 | 0 (PoC = reference) | CC-001..CC-030 Ready | CC-030 parity gate ⚠ |
| FT-02 Coordinator | [tracker](prds/FT-02-coordinator-control-plane/TASK-TRACKER.md) | 14 | 0 | CP-001 Ready | CP-003 anti-collusion placement ⚠ |
| FT-03 Host Agent | [tracker](prds/FT-03-host-agent/TASK-TRACKER.md) | 18 | 1 (HA-001) | HA-002 next | HA-006 signed auto-update ⚠ |
| FT-04 Customer SDK | [tracker](prds/FT-04-customer-sdk/TASK-TRACKER.md) | 10 | 0 | blocked on CP-001 | SDK-004/005 strict mode ⚠ |
| FT-05 Marketplace/Billing | [tracker](prds/FT-05-marketplace-billing/TASK-TRACKER.md) | 14 | 0 | MB-001 Ready | MB-005 payout runs ⚠ |
| FT-06 LLM Serving | [tracker](prds/FT-06-llm-serving/TASK-TRACKER.md) | 10 | 0 | LS-001 Ready (scale-out) | LS-004 relay ⚠ |
| FT-07 Security/Compliance | [tracker](prds/FT-07-security-compliance/TASK-TRACKER.md) | 11 | 0 | SEC-001, SEC-003 Ready | SEC-003 key management ⚠ |
| FT-08 Observability/Ops | [tracker](prds/FT-08-observability-ops/TASK-TRACKER.md) | 10 | 0 | OO-001 Ready | OO-004 canary indistinguishability ⚠ |

(Exact counts live in the feature trackers; this table is a navigation
snapshot refreshed at every milestone-tracker update, not a second source
of truth.)

## Integration contracts

Independent implementation requires concrete specs, not prose:
[`specs/`](specs/) holds the versioned integration contracts
(SPEC-001…007). Rule: **a task that implements an interface builds to its
SPEC, not to another team's code.** Spec changes bump the spec version and
update every consumer feature PRD in the same PR (Standards §6).

## Governance heartbeat

- **Wave close (MVP-PLAN):** independent review gate (Standards §9) on the
  wave's diff-set.
- **Milestone close:** full-stack review agent pass + north-star review
  (DR-09) + this file's rollup refreshed.
- **Any time:** new scope = new task rows first (Standards §7.2), never
  silent work.

## Change log
- 2026-07-04: created; hierarchy completed with milestone trackers and
  specs/ (review-gate DR queued as DR-PF-05 in FT-00).

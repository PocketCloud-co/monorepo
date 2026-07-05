# Pocket Cloud — Feature PRD Framework

This directory is the **work-breakdown layer** between the master PRD and the
code. It exists so that guidance survives delegation: any engineer or AI
subagent — including smaller/less-capable models — can pick up a single task
and execute it correctly using only the documents in its feature folder plus
the two canon documents.

## Document hierarchy (guidance flows down, never gets lost)

```
docs/
├── PRD.md                     ← WHY and WHAT (product truth)
├── ENGINEERING-STANDARDS.md   ← HOW, enforceably (binding; §9 = review gate)
├── ROADMAP.md                 ← WHEN (milestones ↔ features ↔ exit criteria)
├── MVP-PLAN.md                ← ORDER (waves; binding sequencing, DR-PF-04)
├── PROJECT-TRACKER.md         ← root tracker: project → milestones rollup
├── milestones/M<n>-TRACKER.md ← milestone → deliverables → task IDs
├── specs/SPEC-xxx.md          ← versioned integration contracts (build to
│                                these, never to counterpart code)
├── reviews/                   ← §9 independent review reports
└── prds/
    ├── README.md              ← this file: the rules of the framework
    ├── _TEMPLATE/             ← copy to create a new feature area
    └── FT-xx-<feature>/
        ├── PRD.md             ← feature-scoped requirements, contracts,
        │                        threat model, decision records
        └── TASK-TRACKER.md    ← every task: ID, deps, acceptance criteria,
                                 status, artifacts, change log (SOURCE OF
                                 TRUTH for task status; upper levels roll up)
```

## Feature areas

| ID | Folder | Owns |
|----|--------|------|
| FT-00 | `FT-00-platform-foundations/` | repo layout, CI/CD pipelines and gates, release engineering, golden-transcript harness, dev environments |
| FT-01 | `FT-01-crypto-core/` | field math, secret sharing, MACs, Beaver triples, Shamir, fixed-point, (later) distributed dealing — the audited kernel |
| FT-02 | `FT-02-coordinator-control-plane/` | job API, registry, placement/anti-collusion, dealer, verifier, share router, cells |
| FT-03 | `FT-03-host-agent/` | cross-platform worker agent, execution substrates/sandboxing, resource governance, attestation, auto-update |
| FT-04 | `FT-04-customer-sdk/` | Python/TS SDKs, strict-mode client-side dealing/verification, job lifecycle UX |
| FT-05 | `FT-05-marketplace-billing/` | metering ledger, receipts, pricing, Stripe payouts, reputation, fraud engine, consoles |
| FT-06 | `FT-06-llm-serving/` | expert/pipeline sharding, sessions, relay, sandwich mode, KV-cache management |
| FT-07 | `FT-07-security-compliance/` | threat models, audits, KYC/sanctions, SOC 2, legal artifacts, transparency log |
| FT-08 | `FT-08-observability-ops/` | telemetry, SLOs, dashboards, canary system, incident response, chaos testing |

## The rules (verbatim, for every downstream agent)

1. **Read before you act, in this order:** `ENGINEERING-STANDARDS.md` →
   this README → your feature's `PRD.md` → your task row in
   `TASK-TRACKER.md`. Acceptance criteria are your spec.
2. **One task, one scope.** Implement exactly the task ID assigned. Missing
   work you discover becomes a new `Proposed` task row — not a bigger diff.
3. **Ship tests with code, always.** Your acceptance criteria must be proven
   by tests in the same PR. Untestable as specified ⇒ raise an Open
   Question, don't ship.
4. **Never weaken a gate** (tests, coverage, lint, CI stages) to pass.
5. **Never guess business decisions** (pricing, legal, vendors) — record an
   Open Question with a proposed default.
6. **Finish = tracker updated** (status, date, artifacts, change-log line)
   and Definition of Done fully checked.
7. **Conflicts:** feature PRD contradicts master PRD or standards ⇒ stop,
   raise an Open Question in the feature PRD, and flag it in your report.

## Conventions

- **Task IDs:** `<PREFIX>-<nnn>` per feature (PF-, CC-, CP-, HA-, SDK-, MB-,
  LS-, SEC-, OO-). IDs are permanent; never renumber.
- **Statuses:** `Proposed → Ready → In Progress → In Review → Done`,
  plus `Blocked(<task-id or OQ-id>)` and `Dropped(<DR-id>)`.
- **Dependencies:** listed by task ID. `Ready` means *spec-complete and
  unblocked by decisions* — its requirements, acceptance criteria, and
  governing specs/DRs are settled. A Ready task still may not *start* until
  its dependency tasks are Done (execution order per MVP-PLAN).
  `Blocked(<id or OQ>)` is reserved for tasks that cannot even be specified
  or started because a decision or artifact is missing. (Amended 2026-07-05
  per review finding F5 — the original "not Ready until deps Done" wording
  contradicted practice across six trackers.)
- **Priorities:** P0 (milestone-blocking), P1 (milestone-targeted), P2
  (opportunistic).
- **Decision Records:** `DR-<feature>-<nn>`, dated, immutable; reversals are
  new DRs referencing the old.
- **Open Questions:** `OQ-<feature>-<nn>` with owner + proposed default.
- **Change log:** every tracker edit appends a dated line. History is audit
  evidence.
- **HIGH-RISK tasks** are marked ⚠ in trackers and require a named human
  approver per Standards §4.

## Why the feature PRDs repeat themselves

Each feature `PRD.md` restates the constraints it depends on (threat rows,
interface contracts, standards references) instead of merely linking. That
redundancy is deliberate: a downstream agent working from one folder must not
need context it might fail to fetch. When updating a cross-cutting decision,
update every feature PRD that restates it — `grep` for the DR ID.

# FT-08 — Observability & Operations — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| OO-001 | P0 | Telemetry schema + structured logging libs | PF-003 | envelope with correlation IDs adopted by CP/HA/SDK skeletons; scrubber redacts share/key-like fixtures (CI test) | Ready | |
| OO-002 | P0 | Metrics + KPI dashboards v0 | OO-001 | PRD §12 KPIs visible from staging fabric; invariant status panel wired to MB-001 monitor | Proposed | |
| OO-003 | P0 | SLO definitions + error-budget alerting | OO-002 | SLO doc reviewed; alerts fire on budget burn in fixture scenario; no raw-noise alerts | Proposed | |
| OO-004 | P0 ⚠ | Canary-job system | CP-001, MB-003 | canaries generated from real-shape distributions, paid identically; indistinguishability classifier test passes; verdicts reach FT-05/FT-02 in ≤5 min in e2e | Proposed | |
| OO-005 | P0 | Alerting + on-call rotation | OO-003 | paging works (drill); escalation ladder documented | Proposed | |
| OO-006 | P0 | Incident runbooks + postmortem discipline | OO-005 | P0 runbooks (fabric down, invariant halt, bad agent update, verification-failure spike) drilled once each | Proposed | |
| OO-007 | P0 | Chaos scenario suite | PF-011 | churn storm, partition, slow-host, relay-loss scenarios nightly; SLO regression blocks release (gate in FT-00) | Proposed | |
| OO-008 | P1 | Churn/capacity model v0 — strategic asset per BUSINESS-ANALYSIS.md moat #1 | OO-002 | per-device availability curves from staging history; exported to CP scheduler; over-provisioning decision test; retention policy + stable schema documented; internal benchmark: placement-quality vs naive scheduler tracked over time | Proposed | |
| OO-009 | P1 | Host-facing status page + comms templates | OO-006 | status page live; incident comms templates counsel-reviewed (with SEC-006); hosted on independent domain (SEAMS.md §5) | Proposed | |
| OO-010 | P0 | Seam observability pack | OO-001 | every Seam Registry row exports watermark/lag/DLQ metrics; lag-age budget alerts wired; CI fixture fails any seam missing metrics (PF-010 case) | Proposed | |

## Change log

- 2026-07-03: tracker created.
- 2026-07-03: added OO-010 (seam observability per SEAMS.md §2 S5/S6).

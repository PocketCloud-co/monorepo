# FT-07 — Security & Compliance — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| SEC-001 | P0 | Ratify all feature threat models (FT-00..FT-08) | feature PRDs exist | each threat table reviewed; gaps become feature tasks; sign-off recorded here | Ready | |
| SEC-002 | P0 | Threat-model sign-off CI check | SEC-001, PF-001 | fixture PR lacking sign-off label on first-P0 merge is blocked (meta-suite PF-010 case) | Proposed | |
| SEC-003 | P0 ⚠ | Key management architecture doc + review | — | covers device, update-signing (HSM/ceremony), per-attempt MAC, service identities; owners implement via their tasks (HA-005, PF-008) | Done (2026-07-05) | `docs/KEY-MANAGEMENT.md` (11 key classes, trust chains, prohibitions, ceremonies, OQ-SEC-04/05) |
| SEC-004 | P0 | Audit #1 scoping + vendor engagement | CC-050 ready, OQ-SEC-01 | SOW signed; scope = crypto core + agent; schedule fits M3 | Proposed | |
| SEC-005 | P0 ⚠ | KYC/sanctions integration policy | MB-004 design | host + customer flows specified incl. thresholds (OQ-SEC-03); sanctions screening both sides; fixtures for FT-05 tests | Proposed | |
| SEC-006 | P0 | Legal artifact pack v1 (counsel) | — | host ToS + "what runs on my machine" (SEC-R4), customer ToS, privacy policy, model-license review process (OQ-LS-01) | Proposed | |
| SEC-007 | P0 | Abuse program: shape-anomaly detection spec + lawful-process policy | SEC-005 | detector spec with labeled corpus plan; published lawful-process page draft; counsel sign-off | Proposed | |
| SEC-008 | P0 | Export-control review (EAR §740.17) | — | written determination; gates international onboarding (OQ-SEC-02) | Proposed | |
| SEC-009 | P1 | SOC 2 program stand-up | M2 infra live | control mapping, evidence automation plan, auditor selected; Type II window scheduled for M4 | Proposed | |
| SEC-010 | P1 | Bug bounty launch | SEC-004 findings closed | scope + safe harbor published; triage runbook with FT-08 | Proposed | |
| SEC-011 | P1 | Tabletop exercises (incident + lawful process) | OO-006 | two rehearsals run; gaps become tasks | Proposed | |

## Change log

- 2026-07-03: tracker created.

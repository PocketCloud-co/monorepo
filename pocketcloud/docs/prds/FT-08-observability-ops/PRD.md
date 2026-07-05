# FT-08 — Observability & Operations — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) |
| **Master PRD sections** | §8.5 (churn/scale), §12 (KPIs), §9.2 (canaries) |
| **Milestones** | M1 (telemetry), M2 (canaries, on-call), M3 (chaos/SLOs) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-08 owns knowing that the fabric works: telemetry, dashboards, SLOs and
alerting, the canary-job system (known-answer probes that keep hosts honest),
incident response, chaos testing, and capacity/churn modeling. A marketplace
running on strangers' devices lives or dies on operational visibility.

## 2. Scope

**In scope:** structured telemetry standards + pipelines; metrics/dashboards;
SLO definitions and error budgets; alerting + on-call; canary-job generation
and evaluation (results consumed by FT-05 fraud + FT-02 placement); incident
runbooks; chaos suite content (harness is PF-011); churn/capacity models
feeding the scheduler.

**Out of scope:** the meaning of money metrics (FT-05); placement logic
consuming churn models (FT-02); CI infrastructure (FT-00).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| OO-R1 | Structured logging with job/worker/session correlation IDs across every service and the agent; **share values, keys, and customer data never appear in telemetry** (log-scrubber tested) | P0 | M1 |
| OO-R2 | Metrics + dashboards for the PRD §12 KPIs from day one (verified-result rate, completion-by-deadline, churn, payout health, invariant status) | P0 | M1 |
| OO-R3 | SLOs with error budgets: job completion by deadline ≥99% (Standard), placement latency, relay stall bounds; alerting tied to budgets, not raw noise | P0 | M2 |
| OO-R4 | Canary system: known-answer jobs indistinguishable from real jobs (shape, timing, payment), auto-generated, results scored; failures feed FT-05 fraud + FT-02 reputation within minutes | P0 | M2 |
| OO-R5 | Incident response: severity ladder, paging, comms templates (host-facing and customer-facing), postmortem-with-tasks discipline | P0 | M2 |
| OO-R6 | Chaos suite: churn storms, cell partition, slow-host injection, relay loss — run nightly against staging fabric; SLO regressions block release | P0 | M3 |
| OO-R7 | Churn/capacity model: per-device availability curves learned from history, exported to FT-02 scheduler for over-provisioning (master §8.5) | P1 | M3 |

## 4. Interface contracts

- **Telemetry schema** (owned here): event envelope, correlation IDs,
  redaction rules; every feature emits it.
- **Canary verdicts** (consumed by FT-05 MB-008 and FT-02 reputation).
- **Churn model export** (consumed by FT-02 scheduler).

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Telemetry leak | shares/customer data in logs | OO-R1 scrubber + CI test with poisoned fixtures; telemetry schema forbids raw payload fields |
| Host detecting canaries | behave only when probed | canaries generated from real-job shape distributions, paid identically, dispatched through the normal pipeline (indistinguishability test) |
| Alert fatigue | real incident missed | error-budget alerting only; alert review in weekly ops; postmortems track noisy alerts as defects |
| Observability outage | flying blind during incident | telemetry pipeline monitored independently; minimal out-of-band health probes |

## 6. QA requirements

- Log-scrubber test: fixtures containing share-like and key-like values must
  be redacted or the build fails.
- Canary indistinguishability: a classifier given job metadata must not
  separate canaries from real jobs better than chance (test with fixtures).
- Chaos scenarios are code-reviewed scenario files; each maps to an SLO.
- Runbooks rehearsed: each P0 runbook exercised in a drill before its
  milestone closes (with SEC-011 tabletops).

## 7. Decision Records

- **DR-OO-01 (2026-07-03):** Canaries are paid like real work and flow the
  normal pipeline — indistinguishability is a hard requirement, because a
  detectable canary trains hosts to cheat selectively.

## 8. Open Questions

- **OQ-OO-01** (owner: eng; default: OpenTelemetry + a hosted backend at
  M1, revisit self-hosting at scale): telemetry stack choice.

# FT-00 — Platform Foundations — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| PF-001 | P0 | CI workflow: PoC suite on every PR | — | `.github/workflows/pocketcloud-ci.yml` runs syntax check, 19 tests, demo smoke on PRs touching `pocketcloud/`; red suite blocks merge | In Progress | this session |
| PF-002 | P0 | Branch protection + CODEOWNERS | PF-001 | direct pushes to `master` blocked; workflows + lockfiles require owner review; verified by attempting a bypass | Ready | |
| PF-003 | P0 | Production monorepo layout | OQ-PF-01 ratified | `platform/` (services), `agent/`, `crypto/`, `sdk/`, `qa/` scaffolds with per-package `test`/`lint`/`typecheck` entry points callable by CI | Ready | |
| PF-004 | P0 | Lint/format/type configs (TS strict, rustfmt+clippy, ruff) | PF-003 | zero-warning baseline; configs locked via CODEOWNERS | Ready | |
| PF-005 | P0 | Golden-transcript harness | PF-003 | record/replay + byte-diff CLI; seeded-RNG hooks (test builds only); one PoC transcript recorded as first golden | Ready | |
| PF-006 | P0 | Dependency audit + secret scan CI stages | PF-001 | high/critical audit finding or detected secret blocks merge; fixture-tested | Ready | |
| PF-007 | P0 | Coverage gates with ratchet | PF-003 | crypto ≥95% / others ≥80% enforced; lowering requires DR reference in PR body, checked by CI | Ready | |
| PF-008 | P0 ⚠ | Reproducible signed agent builds | PF-003 | two independent CI runs produce identical binaries; signature chain verified in CI; keys never on runners | Proposed | |
| PF-009 | P1 | Release process + channels (stable/beta) | PF-008 | tagged, signed, changelog-generated releases; rollback procedure documented and rehearsed | Proposed | |
| PF-010 | P0 | Pipeline meta-suite (known-bad PR fixtures) | PF-001, PF-006, PF-007 | each fixture (failing test, lowered coverage, secret, unaudited dep, deleted adversarial test) rejected by CI | Ready | |
| PF-011 | P1 | Load/soak/chaos harness scaffold | PF-003 | nightly job spins ephemeral fabric, injects churn/partition/slow-host, reports against SLOs | Proposed | |
| PF-012 | P1 | Dev environment bootstrap | PF-003 | one command from clean machine to running local fabric + green tests; documented in root README | Proposed | |

## Change log

- 2026-07-03: tracker created; PF-001 in progress (CI workflow added alongside this framework).

# FT-03 — Host Agent — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| HA-001 | P0 | Device runtime decision doc | — | `docs/DEVICE-RUNTIME.md` answers substrate-per-tier incl. runc question; reviewed; HA tasks unblocked | In Progress | ultracode workflow this session |
| HA-002 | P0 | Agent core skeleton (Rust): enrollment, heartbeat, work loop | PF-003, CP-002 | enrolls with cert; pulls/executes/returns a trivial kernel e2e in CI; outbound-only verified by test | Proposed | |
| HA-003 | P0 ⚠ | WASM execution substrate + fuel metering (desktop) | HA-001, HA-002 | kernels run sandboxed with no egress; fuel accounting reported; escape-attempt corpus green | Proposed | |
| HA-004 | P0 | Resource governance (Win/mac/Linux) | HA-002 | cap conformance suite green per platform; yield-on-use < 250 ms; enforcement hard/soft documented per cap | Proposed | |
| HA-005 | P0 ⚠ | Device identity in OS keystore/TPM + attestation report | HA-002, SEC-003 | keys non-exportable where hardware allows; attestation consumed by CP placement in e2e test | Proposed | |
| HA-006 | P0 ⚠ | Signed auto-update with staged rollout + rollback | PF-008 | fixture-fleet rehearsal in CI: bad update halted at stage 1, rollback clean | Proposed | |
| HA-007 | P0 | Owner policy UX (desktop tray) + policy schema v1 | HA-004 | non-technical tester sets caps/schedule unaided; policy survives update/restart; schema versioned | Proposed | |
| HA-008 | P0 | Artifact cache: content-addressed, signature-verified, deduped | HA-003 | tampered artifact rejected (test); dedup across jobs measured; disk cap respected | Proposed | |
| HA-009 | P0 | Crash/churn resilience state machine | HA-002 | kill/suspend/net-drop mid-job leaves clean state; golden state-machine transcripts | Proposed | |
| HA-010 | P0 | Android agent v0 per DEVICE-RUNTIME.md | HA-001, HA-008 | runs assigned kernel under charging+Wi-Fi constraints; Play-policy review completed (SEC-006 input); battery soak report on 2 reference devices | Blocked(HA-001) | |
| HA-011 | P1 | Fleet enrollment (org policy, many devices) | HA-007, MB-004 | one org policy applied to N devices; consolidated in FT-05 payout account | Proposed | |
| HA-012 | P1 | Artifact parser fuzzing in CI (nightly) | HA-008 | fuzz corpus + coverage-guided run wired into PF-011 nightly; crashes are P0 defects | Proposed | |
| HA-013 | P2 | Homelab container tier (Podman) for GPU workloads | HA-001, HA-003 | GPU kernel runs in rootless container with caps; only on explicitly-opted homelab tier | Proposed | |

## Change log

- 2026-07-03: tracker created; HA-001 running as multi-agent analysis.

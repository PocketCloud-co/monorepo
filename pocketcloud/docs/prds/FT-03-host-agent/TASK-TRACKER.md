# FT-03 — Host Agent — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| HA-001 | P0 | Device runtime decision doc | — | `docs/DEVICE-RUNTIME.md` answers substrate-per-tier incl. runc question; reviewed; HA tasks unblocked | Done (2026-07-03) | `docs/DEVICE-RUNTIME.md` (15-agent verified analysis; winner: Tiered Fleet M/D/H) |
| HA-002 | P0 | Agent core skeleton (Rust): enrollment, heartbeat, work loop | PF-003, CP-002 | enrolls with cert; pulls/executes/returns a trivial kernel e2e in CI; outbound-only verified by test | Proposed | |
| HA-003 | P0 ⚠ | WASM execution substrate + fuel metering (desktop) | HA-001, HA-002 | kernels run sandboxed with no egress; fuel accounting reported; escape-attempt corpus green | Proposed | |
| HA-004 | P0 | Resource governance (Win/mac/Linux) | HA-002 | cap conformance suite green per platform; yield-on-use < 250 ms; enforcement hard/soft documented per cap | Proposed | |
| HA-005 | P0 ⚠ | Device identity in OS keystore/TPM + attestation report | HA-002, SEC-003 | keys non-exportable where hardware allows; attestation consumed by CP placement in e2e test | Proposed | |
| HA-006 | P0 ⚠ | Signed auto-update with staged rollout + rollback | PF-008 | fixture-fleet rehearsal in CI: bad update halted at stage 1, rollback clean | Proposed | |
| HA-007 | P0 | Owner policy UX (desktop tray) + policy schema v1 | HA-004 | non-technical tester sets caps/schedule unaided; policy survives update/restart; schema versioned | Proposed | |
| HA-008 | P0 | Artifact cache: content-addressed, signature-verified, deduped | HA-003 | tampered artifact rejected (test); dedup across jobs measured; disk cap respected | Proposed | |
| HA-009 | P0 | Crash/churn resilience state machine | HA-002 | kill/suspend/net-drop mid-job leaves clean state; golden state-machine transcripts | Proposed | |
| HA-010 | P0 | Android agent v0 per DEVICE-RUNTIME.md | HA-008 | runs assigned kernel under charging+Wi-Fi+6h-FGS constraints; sideload channel planned alongside Play; battery soak report on 2 reference devices; month-4 kill gate per DEVICE-RUNTIME.md | Ready (scale-out per MVP-PLAN) | |
| HA-011 | P0 | Fleet enrollment (org policy, many devices) — upgraded to MVP per DR-08 | HA-007 | one org policy applied to N devices; org is sovereign owner on corporate devices; employee transparency notice shown; payout account optional (private pools) | Proposed | |
| HA-017 | P0 | MDM silent-install packages + org enrollment tokens (F20, MVP per DR-08) | HA-011, HA-006 | MSI (Intune) + PKG (Jamf) + Linux policy install deploy silently to a 20-device test fleet with zero per-device interaction; enrollment token binds devices to the org pool; verified end-to-end against CP-014 scoping | Proposed | |
| HA-012 | P1 | Artifact parser fuzzing in CI (nightly) | HA-008 | fuzz corpus + coverage-guided run wired into PF-011 nightly; crashes are P0 defects | Proposed | |
| HA-013 | P2 | Homelab container tier (Podman) for GPU workloads | HA-001, HA-003 | GPU kernel runs in rootless container with caps; only on explicitly-opted homelab tier | Proposed | |
| HA-014 | P1 | Tier-W web/WASM agent spike | CC-031 (WASM build), CP-001 | browser tab runs a T1 share kernel end-to-end vs ephemeral coordinator at ≥40% native throughput; probation trust class enforced by placement; onboarding funnel concept validated with 3 testers (DEVICE-RUNTIME.md A.2) | Proposed | |
| HA-015 | P1 | Android-TV/Fire-TV agent variant | HA-010 | native agent runs on 2 reference TV devices wall-powered 24/7; standby/thermal soak report; store-policy review for TV surfaces | Proposed | |
| HA-016 | P1 | NAS/router packages (Synology, QNAP, OpenWrt) — north-star P-0 wave (DR-09) | HA-002, HA-013 | installable package per platform; caps honored; uptime telemetry confirms always-on profile; doubles as the embedded-target proving ground | Proposed | |
| HA-018 | P1 | OEM SDK one-pager + embeddable surface sketch (DR-09, gated on MVP exit) | MVP exit, HA-016 | OEM-facing one-pager (offer shape, rev-share, consent/caps hooks); SDK surface doc showing the agent core cross-compiled to one reference router target; reviewed by founder before first P-1 conversation | Proposed | |

## Change log

- 2026-07-03: tracker created; HA-001 running as multi-agent analysis.
- 2026-07-03: HA-001 Done — DEVICE-RUNTIME.md landed (no runc; model-as-data;
  tiered fleet M/D/H; homelab-first build order). HA-010 unblocked but
  sequenced as scale-out per MVP-PLAN; HA-013 (homelab OCI packaging) is
  packaging-not-security per the doc.
- 2026-07-03: founder review of the supply matrix sustained in part —
  DEVICE-RUNTIME.md Addendum A: Android-TV-class devices upgraded to YES for
  MPC share work; Tier-W web/WASM agent added as fourth substrate; NAS/router
  packages added; sealed assistants remain partnership-only (OQ-HA-03). New
  tasks HA-014..HA-016. Diversity-is-the-product reframe recorded (A.3).

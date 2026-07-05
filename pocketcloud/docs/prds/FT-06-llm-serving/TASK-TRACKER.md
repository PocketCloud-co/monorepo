# FT-06 — LLM Serving — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| LS-001 | P0 | Serving design detail doc (per-mode data flow, frame formats, failure modes) | — | reviewed doc; frame format versioned; failure matrix enumerated; targets homelab/GPU tier per DEVICE-RUNTIME.md (2–4 tok/s WAN floor rules out consumer-device interactive serving) | Ready (scale-out per MVP-PLAN) | |
| LS-002 | P0 | Model partitioner + signed artifact pipeline | LS-001, PF-008 | reference checkpoint → reproducible artifact set (golden hashes); manifest consumed by HA-008 in e2e | Proposed | |
| LS-003 | P0 | Session scheduler (pipeline placement, KV pinning, standbys) | LS-001, CP-003 | pipeline placed within one cell on capable hosts; standby stages provisioned per policy | Proposed | |
| LS-004 | P0 ⚠ | Relay service (sealed frame stitching + metering; DO-hosted per DR-PF-03) | LS-001 | relay cannot decrypt frames (test with instrumented build); frame meter events land in FT-05 fixture ledger | Proposed | |
| LS-005 | P0 | Sandwich mode in SDK | LS-004, SDK-001 | tokens never on the wire (capture test); per-token hidden-state round trip < target on reference topology | Proposed | |
| LS-006 | P0 | Numerical parity regression suite | LS-002 | fabric output vs single-machine reference within documented logit tolerance on fixed corpus; wired into CI | Proposed | |
| LS-007 | P0 | Stage failover + KV re-prefill | LS-003 | kill-stage drill: session completes, stall < bound, no corrupt output (parity suite passes post-failover) | Proposed | |
| LS-008 | P0 ⚠ | Integrity spot-checking | LS-006 | injected corrupt stage caught within documented token budget; reputation event emitted; session migrates | Proposed | |
| LS-009 | P0 | Pilot: open MoE on ≥10 homelab hosts | LS-002..LS-008, HA-013 | live token streaming to a real client; SLO + economics report (tokens/sec, $/Mtok) presented for M3 exit | Proposed | |
| LS-010 | P1 | Session metering GA with FT-05 | LS-004, MB-002 | frames→units→bill reconciliation test; quote model for sessions documented | Proposed | |

## Change log

- 2026-07-03: tracker created; blocked chain starts at HA-001 (device
  runtime doc, in progress).

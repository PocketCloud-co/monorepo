# FT-03 — Host Agent — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) |
| **Master PRD sections** | §5 (Host Agent), F8–F13, §10.1 (host protection); Appendix B (serving tiers) |
| **Milestones** | M1 (desktop v0), M2 (fleet), M3 (mobile tier) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |
| **Companion doc** | `docs/DEVICE-RUNTIME.md` (execution-substrate decision, incl. the runc question) — HA tasks referencing it are Blocked until it lands |

## 1. Purpose

FT-03 owns the software that runs in people's homes and pockets: the worker
agent that enrolls a device, enforces the *owner's* resource rules, fetches
signed work, executes template kernels / model experts on shares or
activations, and returns results. Two customers to satisfy at once: the
platform (correct, attested execution) and the device owner (absolute
sovereignty over their hardware). When they conflict, the owner wins.

## 2. Scope

**In scope:** agent core (Rust); execution substrates per device tier (WASM
sandbox on desktop; mobile app runtime per DEVICE-RUNTIME.md; container tier
for homelab); resource governance; enrollment + device identity; signed
auto-update; model/expert artifact fetch + verification; owner policy UI
(tray app / mobile app screens); local telemetry.

**Out of scope:** placement decisions (FT-02); what the kernels compute
(FT-01 math, FT-06 serving graphs); payout display (FT-05 consoles, agent
deep-links to them).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| HA-R1 | Owner-set caps enforced agent-side and are sovereign: CPU %, RAM, disk, network Mbps, schedule, battery/thermal, metered-connection rules, "pause when I'm using it" | P0 | M1 |
| HA-R2 | Execution is sandboxed and content-neutral: only platform-signed templates/kernels run; model weights/experts load as signed data artifacts, never as code; no general egress from execution contexts | P0 | M1 |
| HA-R3 | Outbound-only networking (agent dials the fabric; nothing listens) | P0 | M1 |
| HA-R4 | Signed binaries + signed auto-update with staged rollout and rollback | P0 | M1 |
| HA-R5 | Install-to-enrolled in under 5 minutes for a non-technical owner (G3) | P0 | M2 |
| HA-R6 | Artifact cache: content-addressed, signature-verified, deduplicated across jobs; experts pinned to devices for locality | P0 | M2/M3 |
| HA-R7 | Mobile tier (Android first) per DEVICE-RUNTIME.md: charging+Wi-Fi defaults, OS-attested (Play Integrity), thermal-guarded | P0 | M3 |
| HA-R8 | Device attestation reported at enrollment and refreshed (feeds FT-02 placement + FT-05 fraud) | P1 | M2 |

## 4. Interface contracts

- Consumes **Coordinator↔Agent protocol** (FT-02 owns).
- Consumes **FT-01 crate** for all share math (never reimplements).
- **Artifact manifest** (owned here, produced by FT-06 for experts): content
  hash, signature chain, size, kernel compatibility version.
- **Owner policy schema** (owned here): the caps object; versioned; the
  mobile app, desktop tray, and fleet policy (F13) all speak it.

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Malicious platform (from owner's view) | overuse device, run something owner didn't agree to | owner-sovereign caps enforced locally; signed-template-only execution; open documentation of "what runs on my machine" (§10.1) |
| Malicious owner/host | inspect/tamper with workload | shares are noise (FT-01); MAC catches tampering; agent tamper ⇒ attestation mismatch ⇒ placement demotion |
| Compromised update channel | ship malware to the fleet | signed updates, staged rollout, reproducible builds (PF-008), rollback; update keys HSM-held ⚠ |
| Malicious artifact | model file exploits parser | artifacts are data parsed by hardened loaders inside the sandbox; fuzzed parsers (QA below); size/schema bounds before parse |
| Local malware on host | steal device key, fake work | OS keystore/TPM-backed device keys where available; attestation; anomaly detection (FT-05 fraud) |
| Compromised MDM/RMM tenant (SEC-001 gap 2) | pushes malicious owner-policy or install package to a whole corporate fleet; abuses employees' hardware; suppresses transparency notice | policy/package signatures verified against a platform key independent of the MDM channel; transparency notice non-suppressible by org policy; monotonic restriction (local can only tighten, SPEC-005 §3); caps floor — HA-019 ⚠ |
| Tier-W web-agent host (SEC-001 gap 5) | free-to-mint browser identities (Sybil); page-context tampering with the WASM agent | probation-only trust class, never sole share-index holder (F15); per-origin identity clustering feeds fraud engine; sealed agent bundle + SRI — threat model detail in SEC-012 |
| Curious serving host (owns FT-06's KV row per SEC-001 gap 4) | reads KV-cache residue after an LLM session | session-key-encrypted KV at rest, wiped on close, enforced by the agent — HA-020 ⚠ |

## 6. QA requirements

- Resource-cap conformance suite: for each cap, a test that the agent stays
  under it under load (hard vs soft enforcement documented per platform).
- Sandbox escape attempts: kernel test corpus including malformed payloads;
  artifact-parser fuzzing in CI (nightly).
- Update: staged-rollout + rollback rehearsal in CI against a fixture fleet.
- Churn behavior: kill/suspend/network-drop mid-job; agent resumes or
  abandons cleanly, never corrupts local state (golden state-machine tests).
- Battery/thermal: instrumented soak on reference devices before mobile GA.

## 7. Decision Records

- **DR-HA-01 (2026-07-03):** Agent core in Rust; kernels execute in a
  sandboxed substrate (WASM default on desktop); model weights are data, not
  code. The runc question is settled by `docs/DEVICE-RUNTIME.md` — containers
  are a homelab-tier option, not a mobile requirement.
- **DR-HA-02 (2026-07-03):** Owner sovereignty: no platform feature may
  override owner caps. Restated from master PRD for grep-ability.

## 8. Open Questions

- **OQ-HA-01** (owner: founder; default: Android first, iOS deferred until
  background-execution economics proven): mobile platform order.
- **OQ-HA-02** (owner: eng; default: wasmtime): WASM engine choice (wasmtime
  vs WAMR on constrained devices) — decide with DEVICE-RUNTIME.md data.
- ~~**OQ-HA-03**~~ — ELEVATED 2026-07-03 to standing strategy **DR-09**
  (`docs/STRATEGY-NORTH-STAR.md`): the embedded home-edge play, smaller
  OEM/ISP partners first, giants approached from a shipped footprint.
  Engineering consequence, effective immediately: the agent core is designed
  embeddable (small, cross-compilable, privilege-free; enrollment/policy
  schema supports an OEM as fleet operator). First artifact tracked as
  HA-018, gated on MVP exit.

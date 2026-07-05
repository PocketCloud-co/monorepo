# FT-06 — LLM Serving — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) |
| **Master PRD sections** | Appendix B (serving modes, delivery), §6.4 templates, NG1 |
| **Milestones** | M3 (Mode 1/2 pilot), M4+ (GA) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |
| **Companion doc** | `docs/DEVICE-RUNTIME.md` (which devices can host experts) |

## 1. Purpose

FT-06 owns serving large open-weight (GLM/Llama/DeepSeek-class, MoE) models
on the fabric: partitioning models into expert/block artifacts, scheduling
pipeline sessions across capable hosts, the per-cell relay that streams
sealed frames to customers, "sandwich" mode (client-side tokenizer/embedding/
LM-head so raw tokens never leave the originator), and session metering.

## 2. Scope

**In scope:** model partitioner + artifact pipeline (experts/blocks as
signed, content-addressed artifacts); session scheduler (pipeline placement,
KV-cache pinning, stage failover); relay service; sandwich-mode SDK support
(with FT-04); integrity spot-checking; session metering (frames) feeding
FT-05; pilot deployments.

**Out of scope:** MPC math (FT-01); batch job lifecycle (FT-02); agent
execution substrate (FT-03 — FT-06 produces artifacts FT-03 runs); relay
hosting is settled by DR-PF-03 (Cloudflare Durable Objects).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| LS-R1 | Model partitioner: split an open MoE checkpoint into signed expert/block artifacts with a manifest (hashes, dims, quantization, kernel version) consumable by FT-03's cache | P0 | M3 |
| LS-R2 | Session scheduler: place a pipeline within one cell on capable hosts (FT-02 placement query), pin KV cache, over-provision standby stages | P0 | M3 |
| LS-R3 | Relay: client and final stage connect outbound; relay stitches sealed frames it cannot read; frame counts = session meter (FT-05) | P0 | M3 |
| LS-R4 | Sandwich mode: tokenizer/embeddings/LM-head in the customer SDK; fabric sees/returns hidden states only | P0 | M3 |
| LS-R5 | Stage failover: dropped host ⇒ standby re-prefills; session survives with bounded stall; customer sees a metric, not an error | P0 | M3 |
| LS-R6 | Integrity: redundant spot-check of sampled tokens/stages against replicas; mismatch ⇒ reputation event + session migration (honest caveat: probabilistic, not MAC-grade — documented) | P0 | M3 |
| LS-R7 | Pilot: one open MoE model served end-to-end on ≥10 homelab-tier hosts with real token streaming | P0 | M3 exit |

## 4. Interface contracts

- **Artifact manifest** (consumed by FT-03 cache — schema owned by FT-03,
  populated here).
- **Session API** (consumed by FT-04): open session (model, mode, budget),
  stream, close; per-frame metering events to FT-05.
- **Pipeline placement query** (consumed from FT-02).

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Curious pipeline host | read activations to infer prompt content | sandwich mode (no tokens at edges); trust-dispersion placement; documented residual risk (Appendix B honesty) |
| Malicious stage | corrupt hidden states / bias outputs | LS-R6 spot-checks vs replicas; session migration; reputation |
| Relay operator (us) | read stream | frames sealed to client session key; relay counts, cannot decrypt |
| KV-cache theft on host | extract conversation residue | cache encrypted at rest with session key, wiped on close; **owned by FT-03 task HA-020** (SEC-001 gap 4 resolved the ownership contradiction) |
| Relay operator observing key setup (SEC-001 gap 12) | learns session key, decrypts frames | key agreement terminates at SDK and final stage only; relay never participates in key exchange; test: relay with a full frame log cannot decrypt (LS-R3 acceptance) |
| Artifact tamper | poisoned expert weights | signed, content-addressed artifacts (FT-03 verifies); partitioner runs in CI with golden hashes |

## 6. QA requirements

- Partitioner goldens: partitioning a reference checkpoint is reproducible
  (identical hashes) across runs/machines.
- Numerical parity: fabric-served outputs match single-machine reference
  inference within quantization tolerance (per-token logit diff bounds) on a
  fixed prompt corpus — the LLM regression suite.
- Failover drill in CI: kill a stage mid-generation; session completes;
  stall bounded per LS-R5.
- Spot-check efficacy: injected corrupt stage caught within N tokens in test
  (N documented).
- Load: token throughput/latency SLOs per session on reference topology.

## 7. Decision Records

- **DR-LS-01 (2026-07-03):** Serving modes and delivery per master Appendix B
  (Mode 1 pipeline, Mode 2 sandwich flagship, Mode 3 surgical MPC). Interactive
  serving targets homelab/GPU tier only until DEVICE-RUNTIME.md proves more.
- **DR-LS-02 (2026-07-03):** No custom inference engine: build on established
  runtimes (per DEVICE-RUNTIME.md selection) with our partitioning/session
  layer on top.

## 8. Open Questions

- **OQ-LS-01** (owner: founder; default: a mid-size open MoE with permissive
  license for the pilot): pilot model choice — license review required
  (SEC-006 input) before artifacts ship to hosts.
- **OQ-LS-02** (owner: eng; default: sampled logit spot-checks at 1/32
  tokens): integrity check rate vs cost — tune with pilot data.

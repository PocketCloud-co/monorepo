# FT-01 — Crypto Core — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) — external audit gates at M3/M4 |
| **Master PRD sections** | §5.1, §7 (entire security model), Appendix A |
| **Milestones** | M1 (Rust parity), M3 (Shamir, strict mode), M5 (distributed dealing) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-01 owns the single audited implementation of every cryptographic
primitive: prime-field arithmetic, additive and (later) Shamir secret
sharing, SPDZ-style MACs, Beaver triples, and fixed-point encoding. One
implementation, shared by SDK and agent — no per-platform re-implementations,
ever (Standards §4). The Node PoC (`pocketcloud/poc/src/crypto/`) is the
executable reference until CC-030 declares parity.

## 2. Scope

**In scope:** the Rust crypto crate; protocol specification document;
property-based and adversarial test suites; cross-implementation golden
transcripts; audit preparation; Shamir upgrade; distributed triple
generation (M5).

**Out of scope:** transport security (FT-02/FT-03 use standard mTLS);
protocol *orchestration* (FT-02); key storage on devices (FT-03 with SEC-003).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| CC-R1 | Written protocol spec: sharing, MAC dealing/checking, Beaver online phase, opening checks — precise enough to implement from without reading code | P0 | M1 |
| CC-R2 | Rust crate at PoC parity: byte-identical outputs on shared golden transcripts (seeded RNG) | P0 | M1 |
| CC-R3 | 128-bit field for production (PoC uses 2⁶¹−1); field modulus a compile-time parameter with both tested | P0 | M1 |
| CC-R4 | Zero third-party dependencies in the crate (stdlib only); `#![forbid(unsafe_code)]` | P0 | M1 |
| CC-R5 | Constant-time field ops for secret-dependent paths (document which paths are and aren't) | P0 | M1 |
| CC-R6 | Shamir t-of-n sharing with dropout-tolerant reconstruction | P0 | M3 |
| CC-R7 | Audit pack: spec + threat model + test evidence + known-limitations doc for external auditors | P0 | M3 |
| CC-R8 | Distributed Beaver-triple generation (remove trusted dealer) | P2 | M5 |

## 4. Interface contracts

- **Crate API** consumed by FT-03 (agent) and FT-04 (SDK): `share/reconstruct`,
  `deal_with_mac/verify_mac`, `beaver::{deal, open_check, combine}`,
  `encoding::{encode, decode(scale_power)}`. Semver; breaking changes update
  FT-03 and FT-04 PRDs in the same PR.
- **Wire encoding** of field elements and share bundles (versioned, documented
  in the protocol spec) consumed by FT-02's dealer/verifier and share router.

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Malicious worker | perturb result/opening shares | MAC relation checks; opened values MAC-checked before use (PoC-proven); catch prob 1−1/p |
| Colluding workers < t | pool shares | information-theoretic zero knowledge below threshold; property tests assert share uniformity |
| Implementation bug | silent wrong math breaks *everything* | property-based tests, cross-implementation golden parity, external audits, no-unsafe, zero deps |
| Side channels | timing on secret-dependent branches | CC-R5 constant-time discipline + documented exceptions |
| Bad randomness | predictable shares = broken secrecy | OS CSPRNG only; rejection sampling uniformity test; seedable RNG compiled out of release builds |

## 6. QA requirements

- Property-based suites: field axioms, share/reconstruct round-trip for all
  n∈[2,16], MAC linearity under random linear maps, Beaver correctness,
  encoding round-trip incl. negatives and scale powers.
- Adversarial suite: every check must have a test where a cheater defeats a
  *removed* check (i.e., prove each check is load-bearing).
- Statistical test: share marginals pass uniformity checks (chi-squared) in CI.
- Golden parity: identical transcripts Node PoC ↔ Rust crate (CC-030 gate).

## 7. Decision Records

- **DR-CC-01 (2026-07-03):** No novel cryptography. Additive + SPDZ MACs +
  Beaver at launch; Shamir at M3. Constructions with literature provenance only.
- **DR-CC-02 (2026-07-03):** Single implementation policy — Rust crate is the
  only production implementation; SDK bindings wrap it (PyO3/napi), never
  reimplement it.

## 8. Open Questions

- **OQ-CC-01** (owner: founder; default: 2¹²⁷−1 Mersenne): production field
  choice — Mersenne 127 vs 128-bit NIST-style prime; decide with benchmark
  data in CC-010.
- **OQ-CC-02** (owner: founder; default: audit at M3 with a firm specializing
  in MPC): audit vendor — needs budget sign-off (SEC-004).

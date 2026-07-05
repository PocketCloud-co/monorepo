# FT-01 — Crypto Core — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| CC-001 | P0 | Protocol specification document | — | spec covers sharing, MAC deal/check, Beaver phases incl. opening MAC checks, encodings, wire format; a reader can implement without the PoC; reviewed against PoC behavior | Done (2026-07-05) | |
| CC-010 | P0 ⚠ | Rust crate: field arithmetic (61-bit concrete + generic Field trait) | CC-001 | property tests for field axioms; branch-free secret-path ops; zero deps; forbid(unsafe) | Done (2026-07-05) | `crypto/src/field.rs`; `Field` trait leaves 128-bit a drop-in |
| CC-015 | P0 ⚠ | 128-bit production field + OQ-CC-01 benchmark | CC-010 | concrete 128-bit `Field` impl behind the existing trait; benchmark report (61 vs 128-bit) resolving OQ-CC-01; parity + property suites pass on it | Proposed | (deferred: v0 parity uses the 61-bit field) |
| CC-011 | P0 ⚠ | Rust: additive sharing + reconstruction | CC-010 | round-trip property tests n∈[2,16]; share-uniformity statistical test in CI | Done (2026-07-05) | |
| CC-012 | P0 ⚠ | Rust: SPDZ MAC dealing + verification | CC-011 | MAC linearity property tests; adversarial tests: tampered share caught, tampered MAC caught, both-tampered-inconsistently caught | Done (2026-07-05) | |
| CC-013 | P0 ⚠ | Rust: Beaver triples + online phase | CC-012 | correctness properties; adversarial test: mis-opened d/e caught by opening MAC check (mirrors PoC e2e test) | Done (2026-07-05) | |
| CC-014 | P0 ⚠ | Rust: fixed-point encoding | CC-010 | round-trip incl. negatives; scale-power-2 products; documented precision bounds per template | Done (2026-07-05) | |
| CC-020 | P0 ⚠ | Adversarial "load-bearing check" suite | CC-012, CC-013 | for every verification check: a test proving a cheater succeeds when that check is disabled (compile-time test feature) | Done (2026-07-05) | |
| CC-030 | P0 ⚠ | Parity gate vs Node PoC | CC-011..CC-014, PF-005 | seeded golden transcripts byte-identical Node↔Rust; gate wired into CI; DR-PF-01 reference switched to Rust on completion | Done (2026-07-05) | |
| CC-031 | P0 | SDK bindings (PyO3, napi-rs) | CC-030 | Python/TS call the same crate; binding-level round-trip tests; no crypto logic in binding code | Proposed | |
| CC-040 | P0 ⚠ | Shamir t-of-n sharing + dropout-tolerant reconstruction | CC-030 | property tests: any t shares reconstruct, any t−1 jointly uniform; interop with MAC scheme; golden transcripts | Proposed | |
| CC-050 | P0 ⚠ | External audit pack #1 | CC-030, CC-020 | spec + threat model + coverage/adversarial evidence + known-limitations doc delivered to auditor (OQ-CC-02); findings tracked here as tasks | Proposed | |
| CC-060 | P2 ⚠ | Distributed Beaver-triple generation design + prototype | CC-050 | design doc with literature citations; prototype passing correctness + malicious-dealer tests; go/no-go DR for production | Proposed | |

## Change log

- 2026-07-03: tracker created. PoC (Node) already demonstrates CC-011..CC-014,
  CC-020 behaviors with 19 passing tests — production tasks port these with
  the same adversarial cases as the floor.

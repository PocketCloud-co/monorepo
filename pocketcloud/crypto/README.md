# pocketcloud-crypto (FT-01)

The single audited crypto core (DR-CC-02): prime-field secret sharing, SPDZ
MACs, Beaver triples (SPEC-001). Zero third-party dependencies,
`#![forbid(unsafe_code)]`. Generic over the field so the 128-bit production
field (OQ-CC-01) drops in without touching sharing/beaver — no flag-day
(one-way-door hedge). Exposes `PROTO_VERSION` and `field_id()` for the
in-band wire tags (SPEC-001 §6).

## Test
```bash
cargo test --test parity          # byte-exact golden parity vs the Node PoC (CC-030)
cargo test --features test-rng    # property + adversarial suites (CC-020)
cargo clippy --all-targets --features test-rng -- -D warnings
```
Golden vectors regenerate from the PoC (the reference of record, DR-PF-01):
`node ../poc/tools/gen-golden.js > ../qa/golden/crypto/vectors.json`.

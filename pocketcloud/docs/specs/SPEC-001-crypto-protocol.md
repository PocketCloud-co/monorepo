# SPEC-001 — Crypto Protocol & Wire Encoding

| | |
|---|---|
| Version | v0 (normative over the PoC; v1 lands with CC-001/CC-030) |
| Producer | FT-01 | Consumers | FT-02 (dealer/verifier), FT-03 (kernels), FT-04 (strict mode) |
| Reference impl | `poc/src/crypto/*.js` |

## 1. Field
- Prime field 𝔽_p, **p = 2⁶¹ − 1** (v0). v1: 128-bit prime, compile-time
  parameter — `TBD(CC-010 benchmark, OQ-CC-01)`.
- All values reduced to canonical range [0, p). Uniform sampling by
  rejection: draw 64 bits, mask to 61, reject ≥ p.

## 2. Fixed-point encoding
- Reals encode as `round(x · 2¹⁶) mod p`; negatives occupy the top half of
  the field (two's-complement style: decode c = v > ⌊p/2⌋ ? v − p : v).
- A product of two encoded values carries scale power 2; decoders take the
  scale power explicitly. No in-protocol truncation in v0 (linear + one
  multiplication level only). Precision bound: |error| ≤ k·2⁻¹⁷ per k-term
  linear combination.

## 3. Additive secret sharing
- **n ≥ 2 always** (privacy floor): with n = 1 the "share" IS the plaintext.
  Implementations MUST reject n < 2 at the boundary; v0 also bounds n ≤ 16.
- share(x, n): x = Σᵢ xᵢ mod p with x₁..x₍ₙ₋₁₎ uniform. Any n−1 shares are
  jointly uniform (zero information).
- Vectors share element-wise; perWorker[i] is the i-th share of every element.

## 4. SPDZ-style MACs
- Per **attempt**, verifier samples fresh α uniform in 𝔽_p.
- Every dealt vector v is accompanied by a dealt sharing of α·v.
- Linear kernels apply the SAME linear map to share and MAC-share streams.
- Verify: reconstruct v and m; accept iff m[k] = α·v[k] ∀k. Forgery success
  ≤ 1/p per element.
- **Openings are MAC-checked too**: any value opened mid-protocol (Beaver
  d, e) is reconstructed together with its MAC sharing and verified BEFORE
  use. A mis-opened value is equivalent to input substitution and MUST be
  caught at the opening, not at the end.

## 5. Beaver multiplication (secret × secret)
- Triple (a, b, c=ab), dealt with MACs (trusted dealer in v0; distributed
  generation `TBD(CC-060)`).
- Round 1: open d = x − a, e = y − b (with MAC check per §4).
- Round 2: zᵢ = cᵢ + d·bᵢ + e·aᵢ (same combination on MAC shares).
- Reassembly adds public terms: z += d·e; m_z += α·d·e. Then verify per §4.

## 6. Wire encoding (v0)
- Field elements travel as **decimal strings** in JSON (BigInt-safe).
- Vectors = arrays of decimal strings; matrices = arrays of vectors.
- v1: length-prefixed little-endian binary, `TBD(CC-001)`.
- **Version negotiation (BINDING on v1; one-way-door audit finding 2):**
  every share bundle and kernel request carries `protoVersion` and
  `fieldId` (identifying the modulus). Agents advertise their supported
  (protoVersion, fieldId) set at enrollment; the coordinator places jobs
  only on compatible workers. This is what makes the 2⁶¹→128-bit field
  migration a rolling upgrade instead of a fleet flag-day — mandatory
  BEFORE any external party speaks the protocol (CC-001).

## 7. Conformance
- Golden transcripts (seeded RNG, test builds only) must match the
  reference implementation byte-for-byte at the JSON level (PF-005).
- Adversarial conformance: implementations MUST pass the tamper suite
  (corrupted result share, corrupted opening share, inconsistent MAC) with
  100% detection — see `poc/test/crypto.test.js`, `poc/test/e2e.test.js`.

## Change log
- 2026-07-04: v0 extracted from PoC.

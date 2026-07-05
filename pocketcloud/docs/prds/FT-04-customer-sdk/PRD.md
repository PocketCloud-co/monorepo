# FT-04 — Customer SDK — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) |
| **Master PRD sections** | §5 (Console+SDK), F1–F6, §8.2 (strict mode), G4 |
| **Milestones** | M1 (Python managed), M3 (strict mode, TS) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-04 owns the demand-side developer experience: SDKs (Python first, then
TypeScript) that make submitting a private distributed job feel like a
serverless batch call — and, in **strict mode**, move share dealing and
result verification inside the customer's environment so the platform never
touches plaintext. The PoC client (`pocketcloud/poc/src/client/client.js`)
is the minimal reference for the managed-mode call shape.

## 2. Scope

**In scope:** Python/TS SDKs; strict-mode dealing + reassembly/verification
(wrapping the FT-01 crate via CC-031 bindings); quotes, budgets, deadlines,
residency/privacy params; job status/streaming; verification transcripts;
retry/idempotency; examples and docs.

**Out of scope:** the REST API itself (FT-02); web console (FT-05); crypto
implementations (FT-01 — bindings only, DR-CC-02).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| SDK-R1 | Managed-mode job lifecycle in ≤5 lines of Python (G4): construct, estimate, submit, await verified result | P0 | M1 |
| SDK-R2 | Every result surfaced to user code is MAC-verified first; an unverified result is unreachable through the public API | P0 | M1 |
| SDK-R3 | Strict mode: dealing + verification run locally via FT-01 bindings; the wire carries only sealed share bundles | P0 | M3 |
| SDK-R4 | Budget caps + upfront quotes surfaced before submission; exceeding budget is a client-side refusal, not a surprise invoice | P0 | M1 |
| SDK-R5 | Idempotent submission (client tokens) and safe retry — a network blip never double-bills (with FT-05) | P0 | M1 |
| SDK-R6 | Privacy parameters (n, t, r, residency) explicit in the API with safe defaults and documented meaning | P0 | M1 |
| SDK-R7 | Verification transcript + receipts exportable for the customer's audit trail | P1 | M2 |

## 4. Interface contracts

- Consumes **Job API** (FT-02) and **FT-01 bindings** (CC-031).
- **SDK public API** (owned here): semver; breaking changes need a migration
  note and deprecation window of one minor release.

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Compromised platform (strict mode goal) | read customer data | dealing local; only shares leave; SDK verifies reassembly locally |
| MITM / malicious endpoint | swap results, replay | mTLS + pinned coordinator identity; MAC verification client-side (strict); idempotency tokens |
| Malicious result injection | convince SDK a forged result verified | verification code paths property-tested; adversarial fixtures from FT-01 suite reused here |
| Developer misuse | accidental plaintext in managed mode when strict intended | privacy mode is an explicit required parameter; `strict` is the documented default for privacy templates from M3 (DR below) |
| SDK supply-chain / stolen customer credential (SEC-001 gap 7) | backdoored PyPI/npm release leaks plaintext before dealing; stolen API key submits jobs or exfiltrates results as the customer | signed, pinned SDK releases with reproducible builds (PF-006/PF-008 machinery reused); published install hashes; scoped revocable API keys; key-use anomaly alerts — SDK-011 |

## 6. QA requirements

- Contract tests against a live ephemeral coordinator in CI (not mocks) for
  every public SDK method.
- Strict-mode golden transcripts: SDK-dealt bundles must be accepted by the
  verifier and match FT-01 goldens.
- Adversarial: tampered result share delivered to SDK must fail verification
  and raise the documented exception type (test per language).
- Docs are tested: every example in the docs runs in CI (doctest/executable
  snippets).

## 7. Decision Records

- **DR-SDK-01 (2026-07-03):** Python first (ML audience), TypeScript second;
  both wrap the single FT-01 crate — no crypto in SDK languages.
- **DR-SDK-02 (2026-07-03):** From M3, `strict` is the default privacy mode
  for T1–T3 templates; `managed` requires an explicit opt-in flag.

## 8. Open Questions

- **OQ-SDK-01** (owner: eng; default: gRPC-over-HTTP/2 with JSON debug mode):
  wire protocol v1 beyond the PoC's JSON/HTTP — decide with CP-001.

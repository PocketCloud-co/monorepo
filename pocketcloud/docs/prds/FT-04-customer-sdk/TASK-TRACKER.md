# FT-04 — Customer SDK — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| SDK-001 | P0 | Python SDK v0: managed-mode lifecycle | CP-001 | 5-line happy path (SDK-R1); contract tests vs ephemeral coordinator; unverified results unreachable (SDK-R2 test) | In Review | `sdk/python/` |
| SDK-002 | P0 | Quotes, budgets, refusal-on-over-budget | SDK-001, CP-008 | quote surfaced pre-submit; over-budget submit refused client-side with clear error; test | In Review | `sdk/python/` |
| SDK-003 | P0 | Idempotent submit + safe retry | SDK-001 | duplicate submits with same token = one job, one bill (e2e with FT-05 fixture) | In Review | `sdk/python/` |
| SDK-004 | P0 ⚠ | Strict mode: local dealing via CC-031 bindings | CC-031, SDK-001 | bundles dealt locally accepted by verifier; platform-side plaintext provably absent (test hooks); golden parity | Proposed | |
| SDK-005 | P0 ⚠ | Strict mode: local reassembly + MAC verification | SDK-004 | tampered share ⇒ documented exception; adversarial fixtures from FT-01 reused; transcript exportable | Proposed | |
| SDK-006 | P0 | Privacy params API (n, t, r, residency) with safe defaults | SDK-001 | params validated client-side; docs explain each with threat context; executable doc examples in CI | In Review | `sdk/python/` |

### Status notes (2026-07-05)

- **SDK-001 — In Review (not Done).** Managed-mode lifecycle
  (`estimate`/`submit`/result) implemented and contract-tested against a LIVE
  ephemeral PoC coordinator (SPEC-003 v0) booted per test module via
  `tests/launcher.mjs`. 5-line happy path (matvec + private_dot) verified;
  unverified-result-unreachable proven by the tamper path
  (`VerificationFailed`, ledger billed = 0). Held at In Review because the
  `CP-001` dependency (org auth / API keys / pools) is not yet present — this
  is the v0 managed client against the PoC reference, not the auth-gated v1
  deployment — and no CI run / human review has landed yet (Standards §1 DoD:
  CI-green + review still outstanding).
- **SDK-002 — In Review.** Exact upfront quote surfaced pre-submit; over-budget
  submit refused client-side with a typed `BudgetExceeded` before any job is
  created (asserted via unchanged ledger). Depends on `CP-008` (credit
  accounting) for real balances; validated here against PoC millicredit quotes.
- **SDK-003 — In Review.** Idempotency modeled client-side (cache result by
  key): a retried submit with the same key returns the cached result and
  creates no new receipts (one job / one bill). Full e2e with the FT-05 fixture
  is pending FT-05; SPEC-003 §4 will carry the token on the wire in v1.
- **SDK-006 — In Review (partial: n only).** `n` privacy floor (n >= 2),
  range, and data-shape validation enforced client-side before any network
  call, with documented threat context (README). `t`, `r`, and `residency`
  params are NOT yet implemented — they are v1 surface (SPEC-003 §4) and out of
  the PoC coordinator's contract; a follow-up is needed once CP-001/strict mode
  land. Executable doc example is exercised by the test suite; wiring it into
  the CI doctest gate is pending the SDK's CI job.
| SDK-007 | P1 | TypeScript SDK (parity with Python v0) | SDK-001..003, CC-031 | same contract tests green; API parity table in docs | Proposed | |
| SDK-008 | P1 | Examples gallery + quickstarts | SDK-001 | every example runs in CI; quickstart ≤10 min for a new dev (timed by a fresh tester) | Proposed | |
| SDK-009 | P1 | Verification-transcript + receipt export | SDK-005, MB-002 | customer can export job audit bundle (transcript, receipts, quote-vs-bill) as JSON | Proposed | |
| SDK-011 | P1 ⚠ | Signed SDK releases + API-key scoping/revocation (SEC-001 gap 7) | SDK-001, PF-008 | releases signed with published hashes, reproducible; API keys scoped (pool/template/budget) and revocable; anomaly alert fixture; supply-chain test: tampered package rejected by documented verification flow | Proposed | |
| SDK-010 | P0 ⚠ | Pool targeting + org auth (F19/F20, MVP per DR-08) | SDK-001, CP-014 | jobs name a pool (default: org's private pool for org-keyed credentials); SSO/API-key org scoping; contract test proves a private-pool credential cannot place public work and vice versa | Proposed | |

## Change log

- 2026-07-03: tracker created.
- 2026-07-05: SDK-001/002/003/006 implemented as the stdlib-only Python
  `pocketcloud` package under `sdk/python/` (Client with estimate/submit/
  get_ledger/get_workers; matvec + private_dot builders; typed exceptions
  BudgetExceeded/VerificationFailed/PrivacyParameterError/JobFailed). 14
  pytest contract + adversarial tests green against a live ephemeral PoC
  coordinator (booted via additive test-only `tests/launcher.mjs`; no
  coordinator/crypto changes). Moved those four rows Proposed/Blocked → In
  Review; SDK-006 partial (n only; t/r/residency deferred to v1). See
  `sdk/python/RUN.md`.

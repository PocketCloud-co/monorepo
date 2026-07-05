# FT-04 — Customer SDK — Task Tracker

> Statuses: Proposed / Ready / In Progress / In Review / Done /
> Blocked(<id>) / Dropped(<DR>). ⚠ = HIGH-RISK (named human approver
> required). Work not in this table does not exist.

## Tasks

| ID | P | Title | Depends on | Acceptance criteria | Status | Artifacts |
|----|---|-------|-----------|---------------------|--------|-----------|
| SDK-001 | P0 | Python SDK v0: managed-mode lifecycle | CP-001 | 5-line happy path (SDK-R1); contract tests vs ephemeral coordinator; unverified results unreachable (SDK-R2 test) | Blocked(CP-001) | |
| SDK-002 | P0 | Quotes, budgets, refusal-on-over-budget | SDK-001, CP-008 | quote surfaced pre-submit; over-budget submit refused client-side with clear error; test | Proposed | |
| SDK-003 | P0 | Idempotent submit + safe retry | SDK-001 | duplicate submits with same token = one job, one bill (e2e with FT-05 fixture) | Proposed | |
| SDK-004 | P0 ⚠ | Strict mode: local dealing via CC-031 bindings | CC-031, SDK-001 | bundles dealt locally accepted by verifier; platform-side plaintext provably absent (test hooks); golden parity | Proposed | |
| SDK-005 | P0 ⚠ | Strict mode: local reassembly + MAC verification | SDK-004 | tampered share ⇒ documented exception; adversarial fixtures from FT-01 reused; transcript exportable | Proposed | |
| SDK-006 | P0 | Privacy params API (n, t, r, residency) with safe defaults | SDK-001 | params validated client-side; docs explain each with threat context; executable doc examples in CI | Proposed | |
| SDK-007 | P1 | TypeScript SDK (parity with Python v0) | SDK-001..003, CC-031 | same contract tests green; API parity table in docs | Proposed | |
| SDK-008 | P1 | Examples gallery + quickstarts | SDK-001 | every example runs in CI; quickstart ≤10 min for a new dev (timed by a fresh tester) | Proposed | |
| SDK-009 | P1 | Verification-transcript + receipt export | SDK-005, MB-002 | customer can export job audit bundle (transcript, receipts, quote-vs-bill) as JSON | Proposed | |
| SDK-011 | P1 ⚠ | Signed SDK releases + API-key scoping/revocation (SEC-001 gap 7) | SDK-001, PF-008 | releases signed with published hashes, reproducible; API keys scoped (pool/template/budget) and revocable; anomaly alert fixture; supply-chain test: tampered package rejected by documented verification flow | Proposed | |
| SDK-010 | P0 ⚠ | Pool targeting + org auth (F19/F20, MVP per DR-08) | SDK-001, CP-014 | jobs name a pool (default: org's private pool for org-keyed credentials); SSO/API-key org scoping; contract test proves a private-pool credential cannot place public work and vice versa | Proposed | |

## Change log

- 2026-07-03: tracker created.

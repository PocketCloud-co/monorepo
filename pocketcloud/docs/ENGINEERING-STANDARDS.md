# Pocket Cloud — Engineering Standards (the Canon)

> **Status: BINDING.** Every contribution — human or AI agent, any model tier —
> is subject to this document. If an instruction anywhere else conflicts with
> this document, this document wins, except where the feature PRD explicitly
> records an approved exception as a Decision Record.

## 0. The three unbreakable rules

1. **Nothing merges without a green, complete test + regression suite.**
   New behavior ⇒ new tests. Changed behavior ⇒ changed tests *and* a
   regression entry proving the old contract was intentionally changed.
   CI enforces this; humans and agents never bypass, skip, or weaken a gate
   to get a merge through. A disabled test is a P0 defect.
2. **Security is a design input, not a review step.** Every feature PRD has a
   threat-model section; every task touching crypto, money, identity, or the
   agent's host-side privileges is HIGH-RISK and requires a named human
   approver on the PR.
3. **The task tracker is the single source of truth for work.** Work not in a
   tracker does not exist. Findings and gaps become tracked tasks or Open
   Questions — never silent fixes, never guesses on business decisions.

## 1. Definition of Done (per task)

A task is Done only when ALL of the following hold:

- [ ] Acceptance criteria in the task tracker are demonstrably met
- [ ] Unit tests cover new logic (thresholds in §3); adversarial tests cover
      every trust boundary the task touches
- [ ] Full test suite green locally AND in CI (no retries-until-green)
- [ ] Lint + typecheck/static analysis clean, zero warnings introduced
- [ ] No new dependency without a recorded justification (§5)
- [ ] Docs updated: the feature PRD, README, and any affected interface contract
- [ ] Tracker updated: status, artifacts (PR link, files), change-log entry
- [ ] Conventional commit(s); PR description maps changes to task IDs

## 2. CI/CD pipeline (the enforcement machinery)

Every PR runs the full gate sequence; merges are blocked on all of them:

| Stage | Gate | Fails the build when |
|---|---|---|
| 1 Lint/format | ESLint/Prettier (JS/TS), rustfmt+clippy (Rust), ruff (Python) | any error or new warning |
| 2 Static analysis | `tsc --strict`, `cargo check`, mypy | any error |
| 3 Unit tests | per-package test suites | any failure; coverage below §3 threshold |
| 4 Protocol/adversarial tests | malicious-party test suites (tamper, collusion, replay, Sybil fixtures) | any failure — these are never optional |
| 5 Integration/e2e | coordinator+agent+SDK against ephemeral fabric | any failure |
| 6 Regression suite | golden transcripts (protocol messages, ledgers, quotes) diffed byte-for-byte | any unapproved diff |
| 7 Security scan | dependency audit (`npm audit`/`cargo audit`/`pip-audit`), secret scan, SAST | any high/critical finding |
| 8 Build artifacts | reproducible builds of agent/SDK/coordinator images | build failure or non-reproducibility (Phase 2+) |

Branch protection: no direct pushes to `master`; PRs require passing checks +
one human review (two for HIGH-RISK). Releases are tagged, signed, and built
only from CI (agent binaries MUST be signed — hosts run these in their homes).

The live pipeline definitions live in `.github/workflows/` and are themselves
covered by FT-00 tasks; changing a gate requires a Decision Record in FT-00.

## 3. Testing policy

| Layer | What | Minimum bar |
|---|---|---|
| Unit | pure logic, crypto kernels, encoders, unit-cost functions | crypto core ≥ 95% line coverage; other packages ≥ 80% |
| Property-based | field arithmetic, share/reconstruct, MAC linearity, encoding round-trips | required for all crypto-core math |
| Adversarial | every verification path exercised with a cheating party (tamper result, tamper opening, forge receipt, replay, wrong shape) | one malicious test per trust boundary, no exceptions |
| Integration/e2e | real processes over real transport, ephemeral ports | every API endpoint + every job template |
| Regression/golden | recorded protocol transcripts, quotes, ledger outputs | byte-diff; approving a diff requires PR reviewer sign-off |
| Load/soak (Phase 2+) | placement solver, share router, relay under churn | SLO targets from PRD §12 |
| Chaos (Phase 2+) | worker dropout, partition, slow-host injection | job completion SLA holds |

Rules of evidence: a claim in a PR description ("verified", "works") must be
backed by a test or a reproducible command in the PR. "Ran it locally" is not
evidence; CI output is.

## 4. Security engineering

- **Threat model per feature.** Every feature PRD carries a threat table
  (adversary / capability / mitigation) derived from master PRD §7.1. A task
  that adds an interface adds a row.
- **HIGH-RISK label** (mandatory human approver, 2 reviews): crypto-core,
  dealer/verifier, payout/billing mutation paths, agent privilege or sandbox
  changes, attestation, key handling, placement/anti-collusion logic.
- **Crypto discipline:** no novel cryptography — established constructions
  only (additive/Shamir sharing, SPDZ MACs, Beaver triples, standard AEAD/
  mTLS). One audited implementation per primitive, shared by SDK and agent;
  no per-platform reimplementations. External audit gates at Phase 2 and 3.
- **Secrets:** never in code, logs, fixtures, or PR text. CI secret-scans.
- **Input handling:** every network payload schema-validated at the boundary
  (sizes bounded, field elements range-checked) before any math runs on it.
- **Least privilege:** agent runs unprivileged; no general egress from
  execution sandboxes; coordinator services isolated per role.

## 5. Dependencies & supply chain

- Crypto core: **zero third-party dependencies** (stdlib only). Non-negotiable.
- Elsewhere: a new dependency requires a tracker entry recording: what it's
  for, why stdlib/existing deps can't, license, maintenance health. Lockfiles
  committed; automated audit in CI; agent release builds vendored + pinned.
- Agent binaries and model/expert artifacts are content-addressed and signed;
  hosts verify signatures before load (this is also a marketing fact: "your
  device only ever runs code we signed").

## 6. Code standards

- **Style:** match the surrounding code; comments state constraints the code
  can't express, not narration. KISS/YAGNI/SOLID as in the master PRD ethos.
- **Languages:** Rust for crypto core + host agent; TypeScript (strict) for
  control-plane services; Python + TS for SDKs; the Node PoC remains the
  executable protocol reference until the Rust core reaches parity (CC-030).
- **Errors:** no swallowed errors; every failure path either handled
  meaningfully or propagated with context. Structured logging with job/worker
  correlation IDs; **never log share values, keys, or customer data** — a
  log line that could contain a share is a security bug.
- **Interfaces:** cross-feature contracts (coordinator↔agent, SDK↔coordinator,
  ledger schemas) are versioned documents in the owning feature PRD;
  breaking a contract requires updating every consumer's PRD in the same PR.

## 7. Agent execution contract (READ THIS BEFORE WORKING ANY TASK)

This section is written for downstream AI agents of any capability tier.
Follow it literally.

1. **Load order:** read (a) this document, (b) `docs/prds/README.md`,
   (c) your feature's `PRD.md`, (d) your task's row in `TASK-TRACKER.md` —
   before writing any code. Your task's acceptance criteria are the spec.
   If the PRD and the tracker disagree, stop and raise an Open Question.
2. **Scope:** implement exactly your task ID. If you discover missing work,
   ADD A TASK ROW (status `Proposed`) — do not silently expand your diff.
3. **Tests first-class:** your diff must include the tests that prove your
   acceptance criteria. If you cannot write a meaningful test, the task is
   not implementable as specified — raise an Open Question instead of
   shipping untested code.
4. **Never weaken a gate:** do not delete/skip/loosen existing tests,
   thresholds, lint rules, or CI stages to make your change pass. If a gate
   seems wrong, raise an Open Question in FT-00.
5. **Business decisions are not yours:** pricing, take rates, legal terms,
   vendor choices → record as Open Question with a proposed default; never
   guess.
6. **Finish protocol:** update the tracker row (status, artifacts, date),
   append to the change log, ensure Definition of Done (§1) is fully checked,
   commit with a conventional message referencing the task ID.
7. **Honesty:** report failures as failures. A red test you can't fix goes in
   the tracker as a defect with your analysis — not deleted, not hidden.

## 8. Seam standard (cross-boundary durability & observability)

Any data or state crossing a component, vendor, or failure-domain boundary
is a **seam** and MUST implement the pattern in `docs/SEAMS.md` (binding):
durable write-ahead at the producer, at-least-once delivery with idempotent
consumers, bounded retry + DLQ, a documented degraded mode whose invariant is
**lag never loss**, watermark/lag/DLQ metrics with budget alerts, continuous
reconciliation against the source-of-truth log, and an explicit backpressure
policy. New seams register in `docs/SEAMS.md` §3 before first production
merge; every seam ships chaos + duplication tests (SEAMS §6).

## 9. Independent best-practices review gate ("measure twice, cut once")

A reviewer **who is not the author** (an AI review agent or a human) runs
this checklist and files findings as tracker rows before the gate passes.
Required: at every MVP-PLAN **wave close** (scope: the wave's diff-set), at
every **milestone close** (scope: full stack), and on any ⚠ HIGH-RISK merge
(scope: the PR).

The reviewer's checklist (the definition of "best practices" for this
project — extend via DR, never shrink):

1. **Spec conformance** — implementations build to `docs/specs/` contracts;
   no consumer couples to a producer's internals; TBDs not built *through*.
2. **Standards conformance** — §1 DoD on sampled tasks; §2 gates unweakened;
   §3 test layers present incl. adversarial per trust boundary; §5 deps
   justified; §6 error/logging discipline.
3. **Security posture** — feature threat models current (new interfaces =
   new rows); no secret/share/key material in code, logs, or fixtures;
   least-privilege preserved; HIGH-RISK approvals actually recorded.
4. **Seam compliance** — every new boundary is in the SEAMS registry with
   S1–S7 satisfied and chaos+duplication tests present.
5. **Cross-document coherence** — PRDs/trackers/specs/roadmap don't
   contradict; DR references resolve; grep for restated decisions finds
   consistent copies; change logs current.
6. **Simplicity check** — KISS/YAGNI: flag speculative abstraction,
   duplicated logic, and anything a smaller design serves equally well.
7. **Honesty check** — claims in docs and PR bodies are evidence-backed;
   privacy/latency claims carry their stated qualifiers (DR-05, Mode-2/3
   distinction).

Findings triage: each finding becomes a tracker row (`Proposed`, or a
defect) or a written waiver in the review report. The gate passes when
every finding is dispositioned — not necessarily fixed, but never silent.
Review reports live in `docs/reviews/<date>-<scope>.md`.

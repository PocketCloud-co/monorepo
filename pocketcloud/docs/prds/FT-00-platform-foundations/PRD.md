# FT-00 — Platform Foundations — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (interim) |
| **Master PRD sections** | §8.3, §11; `ENGINEERING-STANDARDS.md` §2 (this feature implements it) |
| **Milestones** | M0, M1 (then continuous) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-00 owns the machinery that makes every other feature CI/CD/QA-able: repo
layout, pipelines and merge gates, golden-transcript regression harness,
release/signing infrastructure, and developer environments. If a quality gate
exists, FT-00 built it and defends it. Changing any gate requires a Decision
Record here.

## 2. Scope

**In scope:** CI workflows and branch protection; lint/format/type configs;
coverage and adversarial-test gates; golden-transcript harness; dependency
and secret scanning; reproducible signed builds; release channels; dev
environment bootstrap; load/chaos harness scaffolding.

**Out of scope:** the tests themselves (owned by each feature); security
*policy* (FT-07 owns policy, FT-00 automates it); production hosting
architecture (FT-02, with OQ-PF-01 below).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| PF-R1 | Every PR to `master` runs the full gate sequence of Standards §2; merges blocked on all stages | P0 | M0 |
| PF-R2 | PoC suite (19 tests + demo smoke) runs in CI on every PR touching `pocketcloud/` | P0 | M0 |
| PF-R3 | Golden-transcript harness: record/replay protocol messages, quotes, ledgers; byte-diff with reviewer-approved updates only | P0 | M1 |
| PF-R4 | Coverage gates: crypto core ≥95%, other packages ≥80%, ratcheting (may rise, never lowered without DR) | P0 | M1 |
| PF-R5 | Dependency audit + secret scan stages; high/critical findings block merge | P0 | M1 |
| PF-R6 | Reproducible, signed agent builds from CI only; signature verification tested in CI | P0 | M1–M2 |
| PF-R7 | Load/soak/chaos harness (churn, partition, slow-host) runnable in CI nightly | P1 | M3 |
| PF-R8 | Gate configuration changes require a DR in this PRD; CI enforces CODEOWNERS on workflow files | P0 | M1 |

## 4. Interface contracts

- **CI contract:** every package exposes `test`, `lint`, `typecheck` (or
  language equivalent) entry points; FT-00 pipelines call only these.
- **Golden transcripts:** stored under `qa/golden/<feature>/<case>.json`;
  producing code must be deterministic given a seeded RNG (features must
  expose seedable randomness for test builds ONLY — never in release builds).

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Compromised CI runner | exfiltrate signing keys, inject code into artifacts | keys in KMS/OIDC-scoped secrets, never on runners; provenance attestation (SLSA-style); reproducibility spot-checks |
| Malicious/careless PR (incl. AI agent) | weaken a gate, delete tests, poison lockfile | CODEOWNERS on workflows + lockfiles; gate-change DR rule; diff linters flag test deletions |
| Supply chain | typosquatted/hijacked dependency | audit stage, pinned lockfiles, vendored agent deps, zero-dep crypto core |

## 6. QA requirements

The pipeline itself is tested: a fixture repo of known-bad PRs (failing test,
lowered coverage, secret in diff, new unaudited dep, deleted adversarial
test) must each be rejected by CI — this meta-suite runs on pipeline changes.

## 7. Decision Records

- **DR-PF-01 (2026-07-03):** Node PoC remains the executable protocol
  reference; production implementations must match its golden transcripts
  until CC-030 declares Rust-core parity.
- **DR-PF-02 (2026-07-03):** Quality gates are code-reviewed infrastructure;
  no gate may be weakened to unblock a merge (Standards §0 restated here for
  grep-ability).
- **DR-PF-03 (2026-07-03, founder-ratified):** Hosting split by failure
  domain — **Cloudflare** for the fabric data plane (Workers/Durable
  Objects/Queues/R2, agent connectivity), **Supabase Postgres** for business
  records (ledger/registry/reputation/billing), **Vercel** for consoles and
  marketing frontend. Rationale includes deliberate decoupling: Cloudflare
  down ⇒ pages still up; Vercel down ⇒ fabric still running and metering.
  Cross-vendor boundaries follow the binding seam standard (`docs/SEAMS.md`),
  whose reference design is the metering seam (receipts durable in DO+R2,
  queued to Postgres idempotently; Supabase outage = ledger lag, never loss;
  payouts pause on stale watermark; projection rebuildable from the R2 log).
  Resolves OQ-PF-01.
- **DR-PF-04 (2026-07-03):** MVP-first sequencing — `docs/MVP-PLAN.md`
  governs execution order across all trackers (waves + critical path);
  tracker priorities express importance, MVP-PLAN expresses order. Scale-out
  work does not start while an MVP wave is incomplete, except where idle
  specialists have no MVP task available.

## 8. Open Questions

- ~~**OQ-PF-01**~~ — RESOLVED 2026-07-03 as **DR-PF-03** (Cloudflare data
  plane / Supabase records / Vercel frontend, decoupled failure domains).
- **OQ-PF-02** (owner: founder; default: GitHub Actions): CI vendor. Default
  GitHub Actions (repo already on GitHub); revisit only if runner cost or
  concurrency becomes limiting.

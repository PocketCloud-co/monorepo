# FT-07 — Security & Compliance — Feature PRD

| | |
|---|---|
| **Status** | Active |
| **Owner** | Founder (legal/vendor decisions are founder-only) |
| **Master PRD sections** | §7 (security model), §10 (legal/compliance/abuse), G1–G2 |
| **Milestones** | M1 (SDLC live), M2 (KYC), M3 (audit #1), M4 (SOC 2, audit #2) |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

FT-07 owns security and compliance as a *program*: threat-model governance,
external audits and pen tests, key-management design, KYC/sanctions policy,
legal artifacts (host and customer terms, DPIA templates, export review),
SOC 2, the bug bounty, and abuse policy under content-blindness (master
DR-01). Other features implement controls; FT-07 defines them, verifies
them, and holds the evidence.

## 2. Scope

**In scope:** threat-model reviews and sign-off; key management architecture;
audit/pen-test scoping and remediation tracking; KYC/sanctions vendor policy;
ToS/legal doc production with counsel; SOC 2 program; export-control review;
bug bounty; abuse-response runbooks; transparency-log review.

**Out of scope:** implementing controls in code (owning features, tracked in
their trackers with SEC review noted); CI security stages (FT-00 automates
what FT-07 specifies).

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| SEC-R1 | Every feature PRD's threat model reviewed and signed off by FT-07 before that feature's first P0 task merges; new interfaces add rows before merge | P0 | M1 |
| SEC-R2 | Key management architecture: device keys (keystore/TPM), update-signing keys (HSM, offline ceremony), MAC keys (per-job, ephemeral), coordinator service identities — documented, reviewed, implemented by owners | P0 | M1 |
| SEC-R3 | KYC/sanctions: hosts KYC'd via Stripe Connect; customers KYC'd above spend threshold; sanctions screening both sides; policy documented and vendor-integrated | P0 | M2 |
| SEC-R4 | Host-facing "what runs on my machine" plain-English document, counsel-reviewed, published before public host beta | P0 | M3 gate |
| SEC-R5 | External audit #1 (crypto core + agent) at M3; audit #2 (full platform) at M4; findings tracked to closure in owners' trackers | P0 | M3/M4 |
| SEC-R6 | SOC 2 Type II for the control plane by M4; DPIA templates for regulated customers | P1 | M4 |
| SEC-R7 | Export-control (EAR §740.17 mass-market crypto) review before international host onboarding | P0 | M3 gate |
| SEC-R8 | Abuse program for content-blind compute: actor-based controls (KYC, workload-shape anomaly detection, sanctions), lawful-process policy published | P0 | M2 |
| SEC-R9 | Bug bounty live at M4 with safe-harbor language | P1 | M4 |

## 4. Interface contracts

- **Threat-model sign-off** is a required PR check label on features' first
  P0 merges (automated via FT-00, policy owned here).
- **KYC state machine** consumed by FT-05 (MB-004) and FT-02 enrollment.
- **Evidence locker:** audit reports, pen-test reports, sign-offs, DPIAs —
  indexed here, stored access-controlled.

## 5. Threat model (program-level)

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Sophisticated attacker | novel protocol/implementation attack | external audits, bounty, conservative constructions (DR-CC-01), incident response (FT-08) |
| Regulatory action | money transmission / export / worker-classification challenge | counsel-gated phases (master §10), Stripe Connect scoping, export review, host independent-contractor docs |
| Criminal customer | illegal workloads we cannot inspect | actor-based controls (SEC-R8): KYC, spend thresholds, shape anomalies, sanctions screening; template whitelist keeps compute content-neutral |
| Insider | privileged misuse of coordinator/ledger | role isolation, audited access, transparency log, dual review on ⚠ merges |

## 6. QA requirements

- Controls are tested like code: KYC state machine fixtures, sanctions-hit
  fixtures, threat-model-label CI check (fixture PR without sign-off is
  blocked), abuse-shape detectors with labeled corpora.
- Annual tabletop: incident + lawful-process request rehearsals (with FT-08).

## 7. Decision Records

- **DR-SEC-01 (2026-07-03):** Content-blind abuse posture (master DR-01
  restated): we police actors and shapes, never payload content; no backdoor
  in the share pipeline, ever — requests for one are escalated to counsel.
- **DR-SEC-02 (2026-07-03):** Update-signing keys live in HSM with offline
  ceremony; no CI runner ever holds them (with PF-008).

## 8. Open Questions

- **OQ-SEC-01** (owner: founder; default: engage MPC-specialized firm at M3
  start): audit vendor + budget (pairs with OQ-CC-02).
- **OQ-SEC-02** (owner: founder + counsel; default: US-only hosts until
  export + tax review complete): international host onboarding timing.
- **OQ-SEC-03** (owner: founder + counsel; default: $10k/mo spend threshold
  for customer KYC): customer KYC threshold.

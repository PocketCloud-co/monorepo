# Pocket Cloud — MVP Plan (execution order, MVP vs scale-out)

> **Status: BINDING for sequencing (DR-PF-04).** Tracker priorities say how
> important a task is; this document says **when** it happens. Scale-out work
> does not start while an MVP wave is incomplete (exception: an idle
> specialist with no available MVP task).

## 1. MVP definition — the smallest thing that proves the business

**A customer can:** submit a T1/T2 batch job (managed mode) from the Python
SDK, get an exact quote first, receive a verified-correct result, and see a
bill that equals the quote.
**A host (desktop / MSP fleet) can:** install the agent in minutes, set
resource caps that are actually respected, earn for verified work, and get
paid real money through Stripe.
**The platform can:** detect and quarantine a cheating host automatically,
meter every unit of work durably across the Cloudflare→Supabase seam, and
prove the books balance.

Everything else is scale-out.

### Explicitly IN the MVP
Managed mode only · one cell (US) · desktop agents (Win/mac/Linux) + MSP
fleet enrollment · T1/T2 templates · additive n-of-n sharing (PoC protocol,
Rust core) · deterministic quotes · receipts→ledger seam with reconciliation
· Stripe payout loop · minimal host + customer consoles · canary jobs v0 ·
basic telemetry/SLOs/on-call.

### Explicitly OUT (scale-out — do not build yet)
Strict mode & Shamir t-of-n · mobile agents (Android/iOS) · LLM serving
(all of FT-06) · storage product · multi-cell/residency · transparency log ·
redundancy-based cheater pinpointing (whole-attempt quarantine is fine at
MVP scale) · SOC 2 / audits (audit #1 gates the *beta after* MVP) · spot
pricing/auctions · distributed triple generation · arbitrary-code tier.

## 2. MVP waves (the critical path)

Tasks listed in dependency order; a wave closes only when all its tasks are
Done per the Definition of Done.

### Wave 0 — Rails (everything else builds on this)
| Task | What |
|---|---|
| PF-001 ✅→ | CI on every PR (live this session) |
| PF-002 | branch protection + CODEOWNERS |
| PF-003 | production monorepo layout (Cloudflare/Supabase/Vercel per DR-PF-03) |
| PF-004 | lint/type configs |
| PF-006 | dependency audit + secret scan stages |
| PF-007 | coverage gates |
| PF-010 | pipeline meta-suite |
| SEC-003 | key management architecture (unblocks HA-005, PF-008) |
| OO-001 | telemetry schema + scrubber |

### Wave 1 — Protocol core in production form
| Task | What |
|---|---|
| CC-001 | protocol spec |
| CC-010..CC-014 | Rust crypto core (field, sharing, MACs, Beaver, encoding) |
| CC-020 | adversarial load-bearing-check suite |
| PF-005 | golden-transcript harness |
| CC-030 | Node↔Rust parity gate |
| CC-031 | Python bindings |

### Wave 2 — The fabric (one cell, end to end)
| Task | What |
|---|---|
| CP-001 | job API on Workers/DO |
| CP-002 | registry + device certs |
| CP-003 | placement + anti-collusion |
| CP-004, CP-005 | dealer + verifier |
| CP-006 | share router (R2) |
| CP-007, CP-008 | quarantine/receipt emission + quotes |
| HA-002 | agent core (enroll, work loop) |
| HA-003, HA-004 | WASM substrate + resource caps |
| HA-005 | device identity/attestation |
| HA-007 | owner policy UX (tray) |
| HA-009 | churn resilience |
| SDK-001, SDK-002, SDK-003 | Python SDK: lifecycle, quotes/budgets, idempotency |

### Wave 3 — Money (the seam, the ledger, the payouts)
| Task | What |
|---|---|
| CP-013 | metering seam producer (DO+R2 log+Queue) |
| MB-001 | Postgres double-entry ledger (projection of R2 log) |
| MB-002 | receipt consumer, idempotent |
| MB-013 | reconciliation + stale-watermark guards + rebuild runbook |
| MB-003 | pricing config |
| MB-004, MB-005 | Stripe onboarding + payout runs (escrow) |
| MB-006 | customer billing (quote==bill, no-bill-on-reject) |
| OO-010 | seam observability pack |

### Wave 4 — Trust & launchability
| Task | What |
|---|---|
| PF-008 | reproducible signed agent builds |
| HA-006 | signed auto-update |
| HA-008 | artifact cache |
| HA-011 | fleet (MSP) enrollment |
| OO-002..OO-006 | dashboards, SLOs, canaries (OO-004), alerting, runbooks |
| MB-007, MB-008 | reputation + fraud v0 |
| MB-009, MB-010 | minimal consoles (Vercel) |
| SEC-001, SEC-002 | threat-model ratification + CI check |
| SEC-005, SEC-006 | KYC policy + legal pack v1 |
| PF-011, OO-007 | chaos harness + seam chaos suite |

**MVP exit = ROADMAP M2 exit criteria:** 10 real jobs/week for design
partners; a real host paid real money; 100% injected-fault detection;
reconciliation clean for 30 consecutive days; quote==bill on every verified
job.

## 3. Scale-out backlog (post-MVP, in rough order)

1. **Trust upgrades:** SDK-004/005 strict mode; CC-040 Shamir; CP-009
   cheater pinpointing; CC-050/SEC-004 external audit #1.
2. **Supply expansion:** HA-010 mobile tier; HA-015 Android-TV/Fire-TV
   variant (wall-powered, better-than-phone constraints); HA-014 Tier-W
   web/WASM agent (zero-install onboarding funnel + Tizen/webOS reach);
   HA-016 NAS/router packages; HA-013 homelab containers; public host
   onboarding. Sealed ecosystems via OEM SDK partnerships (OQ-HA-03) when
   MVP revenue proves the payout engine — see DEVICE-RUNTIME.md Addendum A.
3. **New demand:** FT-06 LLM serving pilot (LS-001..LS-009); T3 kernels;
   storage product.
4. **Scale hardening:** CP-010/CP-011 cells + placement perf; OO-008 churn
   models; CP-012 transparency log; SEC-007..009 SOC 2/export/bounty;
   SDK-007 TS SDK.
5. **Research:** CC-060 distributed dealing; metadata privacy; spot market.

## 4. Sequencing rules

- A Blocked task never starts; unblock by finishing the dependency or by a
  DR explicitly descoping it.
- Wave overflow: if a wave stalls > 2 weeks on one task, split that task
  (new rows), don't skip the wave.
- Anything pulled forward from scale-out requires a DR in FT-00 naming what
  MVP work it displaces.

## Change log
- 2026-07-03: created; ratified as DR-PF-04.

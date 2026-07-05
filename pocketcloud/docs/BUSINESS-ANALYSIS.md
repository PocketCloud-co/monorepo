# Pocket Cloud — First-Principles & Business Analysis

> **Status:** Founder-review draft. Analysis + concrete refinements; items
> marked **[PROPOSED-DR]** are business decisions awaiting founder
> ratification (per the never-guess rule). Companion: the externally-cited
> market research lands in `FEASIBILITY-GTM.md` (deep-research run in
> flight); this document is the internal reasoning that research will
> confirm or correct.

## 1. First principles — what is irreducibly true

**P1. Compute value is not FLOPs.** A unit of compute is worth
f(FLOPs, latency, reliability, trust, data locality, power). Consumer
fleets are rich in FLOPs and trust-diversity, poor in latency and
reliability. Any strategy that sells our FLOPs against a datacenter's
latency/reliability loses; any strategy that sells trust-diversity and
already-paid-for capacity wins. Sell what the fleet is rich in.

**P2. The scarce input in AI is not silicon — it's powered, cooled,
networked silicon in one place.** Datacenter buildout is gated on power and
interconnect (multi-year queues), not chips. A distributed fleet's power is
already provisioned, distributed, and *paid for by someone else*. That is
the physical arbitrage under the whole idea.

**P3. …but the arbitrage has a floor.** Hosts pay residential power
(~$0.10–0.20/kWh, often 2–3× industrial rates). A 250 W GPU costs the host
~$0.03–0.05/hour to run. Payout below that is negative-sum and supply
churns as soon as hosts notice (this killed goodwill in prior "rent your
PC" attempts). **Design law: payout floor > marginal power cost, and we
show hosts net-of-power earnings** (already PRD OQ-4; now a principle, not
a question).

**P4. Coordination and verification are a tax.** Redundancy r, MAC checks,
and MPC's n× multiplier are real costs. A tax is only payable by buyers who
value what it buys (provable confidentiality, auditability). Therefore
margin concentrates where the tax is a *feature* — compliance workloads —
and evaporates in commodity compute, where we must be cost-competitive or
absent.

**P5. Two-sided marketplaces die of cold start; software licenses don't.**
Liquidity is the marketplace's chicken-and-egg. Private pools (DR-08)
sidestep it entirely: supply and demand arrive together inside one
customer. That's not a feature addition — it's the solution to the
category's classic failure mode.

**P6. Trust is the only durable differentiator in this category.** Anyone
can build a job queue over strangers' GPUs (a dozen have). Nobody else has
committed to: information-theoretic confidentiality below threshold,
unconditional tamper detection, deterministic pre-priced metering, and
dual-signed receipts. The **trust spine is the product**; scheduling is
plumbing.

## 2. Where the value concentrates (segment × willingness-to-pay)

| Segment | What they buy | WTP | Our cost to serve | Verdict |
|---|---|---|---|---|
| Compliance-constrained batch AI (health/legal/finance docs) | provable "no host can read it" + audit trail | High (alternative is *not doing the workload*) | High (MPC multiplier) but priced in | **Margin core** |
| Enterprise private pools | capacity from fleet they already own; showback; sovereignty | Medium-high, budget-line friendly ($/device/mo) | Low (no payouts, no stranger trust) | **Revenue anchor** |
| Commodity batch (render, transcode, embeddings) | price | Low (spot-market buyers) | Low | Utilization filler only; never anchor here |
| Interactive LLM serving | latency | High | We're structurally weak (P1) | Homelab/GPU tier niche; don't lead with it |
| Sealed-device OEM fleets | new revenue per shipped unit | n/a (partner economics) | High BD cost, long cycles | North-star option (DR-09) |

## 3. Unit economics — license vs marketplace (the anchor decision)

**Private pool (license):** price like the MSP channel already prices
agents (RMM/EDR norms ≈ $1–3/device/month). At $2: a 1,000-device org =
$24k ARR; PDC-like channel (100 clients × ~300 endpoints) ≈ 30k devices ≈
**$720k ARR at ~85% gross margin with near-zero CAC** (existing trust
relationship, MDM deployment). Predictable, compounding, sellable by
people who already sell per-endpoint subscriptions.

**Marketplace (take):** a 4090-class host at ~$0.20–0.30/h customer price,
60% payout ⇒ host nets ~$70–150/mo (above power floor ✓); platform takes
~$0.08–0.12/h/device *minus* redundancy and verification costs, *minus*
payment-rail costs, *minus* host+customer CAC on both sides. Real, but
GMV-hungry: matching $720k of license ARR requires roughly ~1,000
continuously-utilized premium GPUs' worth of take. That's a Series-A-scale
liquidity problem, not a bootstrap one.

**Conclusion [PROPOSED-DR BIZ-01]:** invert the framing. Pocket Cloud is
**an enterprise fleet-compute software company (per-device license) with a
marketplace growth option attached** — not a marketplace with an enterprise
feature. Changes the KPI hierarchy (ARR, net revenue retention, devices
under license — before GMV), the fundraising story, and what "MVP success"
means. The public marketplace remains the destination (P6 moats need it);
the license business funds the road.

## 4. Five forces, honestly

| Force | Reading | Implication |
|---|---|---|
| Host (supplier) power | Individually nil, but **multi-homing is frictionless** — hosts will run Salad/vast.ai/us simultaneously | Don't buy exclusivity; win the *scheduler's share* via payout reliability, net-of-power transparency, trust-tier premiums |
| Buyer power | High for commodity (spot markets everywhere); **low for provable-privacy batch** (nearly no substitutes) | Price commodity at market, price privacy on value |
| New entrants | Trivial to clone a GPU job queue; hard to clone audited MPC + receipts + reliability data | Keep the moat where entry is hard (§5) |
| Substitutes | TEE/confidential VMs (Azure/AWS/GCP, Apple PCC) are the privacy buyer's default alternative | Positioning must be crisp: TEEs require trusting the cloud operator + silicon vendor and have a side-channel history; IT-MPC removes both. Sell *threat-model fit*, not "TEE bad" |
| Rivalry | DePIN players compete on token-subsidized price (supply paid in speculation, demand often thin) | **Refuse their game.** Anchor on fiat revenue from real enterprises; recruit their disillusioned hosts when subsidies fade |

## 5. Moat inventory (ranked by durability)

1. **Reliability/churn dataset → placement quality.** Per-device
   availability curves and verified-work history let us hit SLAs at lower
   redundancy cost than any newcomer. Compounds with fleet-age; impossible
   to shortcut. *(Already OO-008 — elevate: this is a strategic asset,
   instrument from day one.)*
2. **The trust spine + external audits.** Receipts, MACs, deterministic
   metering, audit reports. Slow to build, verifiable, and referenceable.
3. **Channel embed (MSP/MDM/OEM).** Distribution through people who already
   own the endpoint relationship; switching us out means touching fleets.
4. **Two-sided liquidity.** Classic but only after scale; weakest early.
5. **Neutrality vs hyperscalers** (DR-09) — structural, but only monetized
   through 1–4.

## 6. Refinements adopted into the design (R1–R7)

- **R1 [PROPOSED-DR BIZ-01].** Revenue anchor = per-device license
  (private pools); marketplace = growth option. KPI hierarchy: devices
  under license / ARR / NRR → then GMV/take. *(Founder to ratify; touches
  ROADMAP KPIs and fundraising narrative.)*
- **R2.** Price private pools **per-device-per-month** in RMM/EDR terms
  ($1–3 proposed default, OQ-MB-04) — the MSP channel can quote it
  tomorrow; no new buying motion to teach.
- **R3.** Publish **net-of-power host earnings** and a payout floor above
  marginal power cost (P3) — trust > short-term signups; also the exact
  wedge to poach hosts from token-subsidized rivals when their yields sag.
- **R4.** Treat the reliability dataset as a first-class asset (moat #1):
  retention policy, schema stability, and "placement-quality vs naive
  scheduler" as a tracked internal benchmark (OO-008 acceptance criteria
  extended).
- **R5.** Meet commodity demand **through aggregators** (inference routers
  / spot brokers) rather than direct sales — it's utilization filler
  (P4/§2), and aggregators squeeze margin we shouldn't defend. Direct
  relationships reserved for compliance/MPC and private-pool buyers.
- **R6.** Don't fight disintermediation — productize it: an enterprise or
  MSP that wants to self-host the control plane is a **license upsell**
  (self-hosted cell, our trust spine, our updates), not a lost customer.
- **R7.** Positioning one-liner vs TEEs (the real substitute): *"Confidential
  computing without trusting anyone's silicon or anyone's cloud — and with a
  mathematical receipt."* Use threat-model-fit selling, never FUD.

## 7. Real-options view & kill gates (staged capital discipline)

Each layer is a cheap option bought by the previous layer's success:

| Option | Bought by | Exercise trigger | Kill/pivot gate |
|---|---|---|---|
| Private-pool license business (MVP) | PoC + MSP channel | now | <3 paying orgs or <5k licensed devices by MVP+2Q ⇒ revisit pricing/ICP, not the tech |
| Public marketplace | license revenue + trust spine | ≥1 compliance design-partner demanding burst | take-rate contribution negative after 2 quarters of GA ⇒ shrink to burst-only |
| Consumer fleet tiers (TV/web/NAS) | marketplace liquidity | MPC demand > MSP-fleet supply | per-device support cost > 25% of per-device take ⇒ freeze tier |
| OEM embedded (DR-09) | shipped footprint + metrics | MVP exit (HA-018) | no signed P-1 LOI within 3 quarters of first pitch ⇒ park, revisit at 10× fleet |

**Capital structure note:** the fabric scales with ~zero capex (hosts own
the hardware) — spend concentrates in engineering, audits, and channel.
That is the inverse of every datacenter competitor and the correct story
for early-stage capital: *we grow capacity without buying it.*

## 8. Risks this analysis surfaces (tracked, not buried)

| Risk | Mechanism | Mitigation home |
|---|---|---|
| Multi-homed supply arbitrages us | hosts chase highest per-hour bidder | R3 net-of-power trust + trust-tier premiums; never bid against subsidies |
| Aggregator margin squeeze | demand consolidates behind routers | R5: filler via aggregators, margin via direct compliance/pool sales |
| MSP channel conflict | MSPs fear we go direct to their clients | channel-first pricing (MSP margin share), named-account protection — OQ-BIZ-02 |
| License complacency | anchor revenue makes marketplace optional forever | kill gates (§7) force the option decisions on a clock |
| MPC performance disappoints buyers | overhead misread as slowness | quotes state the multiplier upfront (F18); sell batch SLAs, never interactivity |

## 9. Decisions queued for founder

- **OQ-BIZ-01** (R1): ratify license-anchored model + KPI hierarchy.
- **OQ-BIZ-02**: MSP channel economics — margin share % and named-account
  protection (default: 20–30% margin to the operating MSP; PDC is the
  design-partner MSP).
- **OQ-MB-04** (R2): private-pool list price (default $2/device/mo, volume
  tiers; annex to FT-05 pricing config — registered in FT-05 PRD §8).
- **OQ-BIZ-03** (owner: founder; default: refresh before any investor or
  public use): competitor traction/pricing figures in FEASIBILITY-GTM.md
  §2 are training-knowledge [K] — re-verify with live sources and complete
  the deferred adversarial verification pass (workflow `wf_7854635d-c4c`).

## Change log
- 2026-07-03: created (first-principles + MBA pass); R1–R7 integrated as
  proposals; awaits FEASIBILITY-GTM.md external validation.

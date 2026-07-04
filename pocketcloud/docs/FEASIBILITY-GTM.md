# Pocket Cloud — Feasibility & Go-To-Market Analysis

> **Evidence status (read first):** the deep-research pipeline completed its
> search/extraction phases (sources below are real and cited) but the
> 3-vote adversarial verification stage failed on an account spend limit —
> so claims marked **[E]** are extracted-from-source but panel-unverified,
> and claims marked **[K]** are from training knowledge (~Jan 2026 cutoff),
> unverified. Re-run the verification pass (workflow resume
> `wf_7854635d-c4c`) when budget allows. Nothing here contradicts
> `BUSINESS-ANALYSIS.md`; where evidence bears on our design, the verdicts
> agree — cited below.

## 1. What the academic record says about our core bets

The flagship distributed-inference and MPC papers map almost one-to-one
onto Pocket Cloud's design choices:

| Evidence | What it says | What it means for us |
|---|---|---|
| Petals (arXiv 2209.01188, 2312.08361) **[E]** | 176B model served on geo-distributed consumer GPUs at ~1 token-step/s (0.83 in a real 14-server EU/NA deployment) vs 4.18 tok/s batch-1 on 8×A100; throughput halves as RTT goes 5 ms→100 ms | **Interactive serving over residential WAN is RTT-bound physics, not an engineering gap.** Validates NG1 and Appendix B: batch is the wedge; interactive lives on the homelab/GPU tier or nowhere |
| Petals limitations sections **[E]** | Authors concede **no input privacy** (first-layer peers can read tokens) and **no result integrity** (only an economic "bounty hunter" idea, which "still leaves a chance of receiving wrong outputs") | **Our two differentiators are exactly the flagship system's two acknowledged unsolved gaps.** MPC-private batch + MAC-verified results is a filled hole, not a me-too |
| Split-inference inversion attack (arXiv 2602.16760) **[E]** | ~59% of tokens recoverable from intermediate activations at a 2-layer split, ~35% at 8 layers; WAN split inference of 7B reaches 8.7–9.3 tok/s at ~80 ms RTT | Two-sided: (a) marginally-interactive distributed 7B-class serving is real; (b) **"sandwich mode" is transport-privacy, not cryptographic privacy — activation inversion is a demonstrated attack.** PRD Appendix B honesty note strengthened accordingly |
| PUMA (arXiv 2307.12533), Marill (arXiv 2408.03561) **[E]** | MPC inference of LLaMA-7B ≈ 5 min/token (2023 SOTA); best 2024 mitigations gain 3.6–11.3× and require fine-tuning-time model changes; 7B was the largest model ever run under MPC | **Full-LLM MPC inference is off the table for years — exactly why we scoped MPC to T1–T3 kernels** (linear algebra, embeddings, aggregation, small-model scoring), not chat. Anyone pitching "MPC-private ChatGPT on phones" is selling vapor; we are not |
| INTELLECT-1 (arXiv 2412.01152) **[E]** | 10B model trained across 3 continents at 83–96% utilization — but on **datacenter H100s over 500 Mb/s–4 Gb/s WAN**, with DiLoCo cutting communication ~400× | Distributed *training* is a datacenter-GPU-over-WAN story (Prime Intellect's segment), not a consumer-fleet story. Training is correctly out of our scope |
| Parallax (arXiv 2509.26182) **[E]** | Decentralized serving gains 1.6–3.6× from scheduling, on 4090/5090-class nodes at ~10 ms inter-node latency; placement+routing under heterogeneity is NP-hard | Scheduler quality is a real, durable differentiator (supports BUSINESS-ANALYSIS moat #1); and even optimized systems assume better-than-residential links |
| MPC benchmark survey (eprint 2026/183) **[E]** | First systematic cross-framework MPC benchmark appears only in early 2026; WAN-condition MPC performance was previously uncharacterized | The MPC-over-real-networks space is immature — early movers get to define credible benchmarks (and should publish ours) |

**Net:** the literature independently confirms our three load-bearing
verdicts — batch-first (RTT physics), MPC scoped to kernels not chat
(overhead reality), verification as unsolved-elsewhere differentiation —
and corrects one claim we must state more carefully (sandwich mode ≠
cryptographic privacy).

## 2. Competitor landscape **[K]** (traction as of ~Jan 2026; re-verify before investor use)

| Player | Model | Real traction signal | Weakness we exploit |
|---|---|---|---|
| **Vast.ai** | GPU rental marketplace (prosumer + small DC) | Profitable price leader; ~$0.20–0.40/h consumer 4090-class | No privacy story, no verification; hosts run arbitrary containers |
| **Salad** | Consumer idle GPUs, container workloads | Real paying demand (image gen, transcription); host payouts ~$50–150/mo top GPUs; high take (~50%) | Hosts execute opaque customer containers (trust burden on host); no enterprise/fleet story |
| **io.net / Aethir / Nosana** | Token-incentivized GPU DePIN | Large raised sums, big advertised fleets | Demand thin relative to token-subsidized supply; utilization questions; we refuse this game (BUSINESS-ANALYSIS §4) |
| **Akash** | Token-settled open cloud | Modest real usage incl. GPUs | Crypto-payment friction for enterprise buyers |
| **Render** | GPU rendering network | Genuine niche demand (Octane) | Single vertical |
| **Golem** | OG 2016 decentralized compute | Never found PMF | Cautionary tale: generality without a buyer |
| **Prime Intellect** | Distributed *training* over WAN | INTELLECT-series real | Different segment (datacenter GPUs); not consumer fleets |
| **BOINC / Folding@home** | Volunteer grid | Proved planetary supply exists (F@h hit ~2.4 exaFLOPS in 2020, briefly exceeding the top supercomputers combined) | No money loop; proved supply churns without one |
| **2000s enterprise grid wave** (United Devices, Grid MP, Condor pools; CycleCloud→MSFT) | "Idle corporate PCs as cluster" | Real deployments, then died | Killed by: complexity, security fears, and cloud's arrival. **What changed: MDM is now universal, AI demand is insatiable, and datacenter capacity/power is scarce — the exact gaps that killed it are now our tailwinds** |
| **TEE/confidential VMs** (Azure/AWS/GCP, Apple PCC) | The enterprise default for "private AI" | First-class hyperscaler products | Requires trusting silicon vendor + cloud operator; side-channel history; zero neutrality. Our true substitute — sell threat-model fit (BUSINESS-ANALYSIS R7) |
| **Enterprise idle-fleet AI pools (our private-pool wedge)** | — | **Effectively vacant in 2026** | The white space DR-08 targets; closest analogs died a generation ago for reasons that no longer hold |

## 3. Feasibility verdicts by workload class

| Workload | Verdict | Basis |
|---|---|---|
| Batch inference / embeddings / rendering / transcode | **Feasible now; the commercial wedge** | Salad/Vast prove paying demand [K]; RTT irrelevant to batch [E] |
| MPC-private kernels (T1–T3: linear algebra, aggregation, small-model scoring) | **Feasible now; the margin core; near-zero competition** | PoC demonstrates it; Petals names it unsolved [E]; PUMA/Marill bound the ceiling we correctly avoided [E] |
| Interactive LLM serving from consumer fleet | **Not credible; do not promise** | RTT physics [E, three independent papers] |
| Interactive serving from homelab/GPU tier (10–20 ms cells) | **Marginal-to-viable niche** (8–15 tok/s of 7–12B class) | 2602.16760 + Parallax [E] |
| Distributed training | **Out of scope** | INTELLECT-1 is a datacenter-GPU story [E] |

## 4. GTM (confirmed sequence)

The evidence strengthens the BUSINESS-ANALYSIS sequence rather than
changing it:

1. **Private pools via the MSP channel** (DR-08) — vacant category, MDM
   solves the 2000s failure modes, license economics fund everything.
   Anchor offer: $/device/month (OQ-MB-04), sold by people who already
   sell per-endpoint agents. Design partner: PDC's own fleet + clients.
2. **Compliance-constrained batch AI** (P4 buyers) on the MPC tier —
   the only competitor-free margin in the table above; price on value
   vs "don't do the workload at all."
3. **Commodity batch via aggregators** for utilization (R5) — never the
   anchor; refuse token-subsidy price wars.
4. **Homelab/GPU serving cells** for latency-tolerant LLM batch and the
   8–15 tok/s niche where it honestly fits.
5. **OEM embedded** (DR-09) once MVP metrics exist.

## 5. "Could we technically become the biggest hyperscaler?"

Split the question, because it equivocates two different things:

**Biggest by aggregate capacity — arithmetically yes, with precedent.**
Folding@home briefly aggregated ~2.4 exaFLOPS from volunteers in 2020 —
more than the top 500 supercomputers combined at the time [K]. One billion
embedded/consumer devices contributing an average of 10–20 W of useful
compute is 10–20 GW of powered silicon — the same order of magnitude as a
hyperscaler's entire datacenter fleet, acquired with **zero capex** (P2,
BUSINESS-ANALYSIS). At OEM scale (DR-09), "world's largest compute fabric
by device count and aggregate FLOPs" is a defensible long-term claim.

**Biggest hyperscaler in what hyperscalers actually sell — no, and we
shouldn't want to be.** AWS sells single-digit-millisecond storage, five-9s
SLAs, free-flowing east-west bandwidth, egress economics, managed
databases, and an ecosystem. Those properties are physically downstream of
*co-located, owned* infrastructure; a residential fabric cannot replicate
them, ever — the RTT evidence in §1 is that wall. Chasing that axis means
losing on it.

**The winnable claim** is a different axis they cannot occupy:
- the **largest pool of latency-tolerant compute** on earth (batch AI,
  the fastest-growing compute category, and one where the scarcity is
  power — which our fleet has already paid for), and
- the **only hyperscale trust-diverse privacy fabric** — millions of
  independent households is a security property no single-operator
  datacenter can manufacture at any price (BUSINESS-ANALYSIS P1; the
  anti-collusion value of scale).

So the honest headline: **not the biggest hyperscaler — the biggest
computer for work that doesn't need one, and the only one whose privacy
guarantee improves as it grows.** That second clause is the sentence to
build the company on.

## 6. Follow-ups

- Re-run the adversarial verification pass (resume `wf_7854635d-c4c`) when
  the spend limit resets; promote **[E]**→verified or amend.
- Refresh competitor traction/pricing **[K]** with live sources before any
  investor-facing use (tracked: OQ-BIZ-03).
- PRD Appendix B updated this commit: sandwich mode described as transport
  privacy with citation of the activation-inversion numbers.

## Change log
- 2026-07-03: created from deep-research extraction (25 sources) + internal
  analysis; verification pass pending budget.

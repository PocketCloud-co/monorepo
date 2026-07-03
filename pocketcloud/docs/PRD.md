# Pocket Cloud — Product Requirements Document

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Date** | 2026-07-03 |
| **Owner** | Founder / Product |
| **Companion artifact** | `pocketcloud/poc/` — runnable proof of concept of the core privacy-preserving compute fabric |

---

## 1. Executive Summary

Pocket Cloud is a two-sided marketplace and distributed computing fabric that lets everyday people **rent out the idle compute, storage, and network capacity of devices they already own** (desktops, gaming rigs, NUCs, home servers, eventually phones and routers), and lets workload owners — especially AI teams — **run sensitive workloads on that fabric without trusting any individual device**.

The differentiator is not price or performance. It is **confidentiality by construction**: workloads are cryptographically split so that each participating device receives only an information-theoretically meaningless *share* of the data. A device (or any colluding group of devices below a declared threshold) cannot read, reproduce, or undetectably tamper with the data it processes. The fabric is verifiable: tampered or fabricated results are detected before they reach the customer.

This gives AI and data teams a third option beyond (a) hyperscaler clouds they don't control and (b) on-prem hardware they can't afford: a **sovereign, provider-neutral edge fabric** where privacy is enforced by mathematics rather than by a vendor's terms of service.

**One-sentence pitch:** *Airbnb for idle compute, with the guarantee that no host can ever look inside the suitcase.*

---

## 2. Problem Statement

### 2.1 For workload owners (demand side)

1. **Cloud concentration risk.** Three hyperscalers control the substrate that most AI inference and data processing runs on. They set pricing, impose quotas (GPU allocation waitlists are the norm), can deplatform tenants, and are single points of legal/jurisdictional compulsion.
2. **Confidentiality gaps.** Even with encryption at rest and in transit, data is plaintext *in use* on hardware the customer doesn't own. Confidential-computing enclaves (SEV-SNP, TDX, Nitro) reduce but don't eliminate trust in the cloud operator and the silicon vendor, and have a history of side-channel breaks.
3. **Regulated and paranoid workloads are stuck.** Healthcare, legal, defense-adjacent, and financial teams routinely reject SaaS AI because "our data leaves the building and sits readable on someone else's machine." They will accept "our data leaves the building as meaningless shares that provably cannot be reassembled by the hosts."

### 2.2 For device owners (supply side)

4. **Idle capacity is worthless today.** A gaming PC delivers useful work perhaps 4 hours a day; the other 20 hours of paid-for compute, storage, and (increasingly fast) home bandwidth earn nothing. Prior "rent your PC" attempts (BOINC, Golem, Salad, Akash for the datacenter-lite tier) either pay in goodwill, pay poorly, or require hosts to run *opaque customer code* — a security nightmare for the host.
5. **Hosts fear the workload as much as customers fear the host.** Any credible platform must protect the *device owner* too: sandboxed, resource-capped, content-neutral computation where the host cannot be accused of possessing the customer's data, because the host provably never had it.

### 2.3 Why now

- Consumer hardware is absurdly capable (NPUs shipping in commodity laptops, 8+ core desktops standard, symmetric fiber spreading).
- AI inference demand is outstripping datacenter buildout; batch/offline inference is latency-tolerant and parallelizable — a perfect fit for an edge fabric.
- MPC (secure multi-party computation) has matured from academic curiosity to practical engineering: linear-algebra-heavy workloads (exactly what neural network inference is) are the *best case* for MPC because linear operations on secret shares are essentially free.

---

## 3. Goals and Non-Goals

### Goals (in priority order)

| # | Goal | Measure |
|---|------|---------|
| G1 | Data confidentiality by construction: no single node — and no colluding set of nodes below the job's declared threshold *t* — can recover any information about workload data | Formal security argument per protocol; external cryptographic review before GA |
| G2 | Integrity/verifiability: tampered, fabricated, or dropped results are detected with overwhelming probability before delivery | MAC/verification failure detection rate = 100% in adversarial tests |
| G3 | A supply-side experience so safe and simple that a non-technical person will install the agent | Install-to-first-payout < 24h; host NPS > 50 |
| G4 | A demand-side developer experience comparable to a serverless batch API | Job submission → results with a 5-line SDK call |
| G5 | Honest, sustainable unit economics: hosts paid fairly, platform take rate covers coordination + verification overhead | Contribution margin positive per job class by MVP+2 quarters |

### Non-Goals (explicit)

- **NG1 — Not a low-latency serving platform.** MPC and share distribution add latency and 2–10× compute overhead. Target workloads are batch/asynchronous: offline inference, embedding generation, ETL, rendering, scientific compute, encrypted archival storage. Real-time chat inference is out of scope until Phase 4+.
- **NG2 — Not a blockchain project.** No token. Payments are fiat (Stripe Connect payouts). A ledger is an implementation detail, not a product.
- **NG3 — Not general arbitrary-code hosting at launch.** The MVP runs a curated set of *workload templates* (see §6.4). Arbitrary containers come later, and only inside the sandbox + shares model.
- **NG4 — Not competing with hyperscalers on raw $/FLOP.** We compete on sovereignty, confidentiality, and the ability to say "no one can read this, including us."

---

## 4. Users and Personas

### Supply side

- **P1 "Weekend Miner" (host, prosumer).** Owns a gaming PC and fast fiber. Wants passive income with zero legal exposure and no fan noise at 2 a.m. Cares about: payout, resource caps, "can I get in trouble for what runs on my box?"
- **P2 "Homelab Harry" (host, enthusiast).** Runs a rack of NUCs and a Proxmox box. Wants API access, Prometheus metrics, higher tiers for reliability. This is the beachhead supply persona — quality supply, tolerant of early friction.
- **P3 "Fleet Frank" (host, small business).** An MSP or shop with 40 idle desktops overnight. Wants org-level enrollment, one invoice, one policy. (Strategically important: PDC itself and its MSP peers are exactly this persona — instant supply.)

### Demand side

- **P4 "Compliance-Constrained Clara" (customer, ML lead at a healthcare/legal/finance SMB).** Has batch inference and embedding jobs over sensitive documents. Blocked by counsel from sending plaintext to third-party APIs. Will pay a premium for a provable "no plaintext ever leaves your VPC" story.
- **P5 "Cost-Squeezed Carlos" (customer, indie AI developer).** Needs cheap batch embeddings/rendering; privacy is a bonus. Price-sensitive filler demand that keeps utilization up.
- **P6 "Sovereign Sam" (customer, public sector / research).** Procurement requires demonstrable independence from US hyperscalers and/or data-residency pinning ("shares never leave Country X").

---

## 5. Product Overview

Pocket Cloud consists of five product surfaces:

1. **Host Agent** — a small installable daemon (Windows/macOS/Linux; Docker for homelab) that meters idle capacity, enforces owner-set resource caps (CPU %, RAM, disk quota, bandwidth, active-hours schedule, battery/thermal rules), executes *share-level* computation inside a sandbox, and attests its integrity to the fabric.
2. **Fabric Control Plane** — the coordination service: job intake, share dealing, worker selection, dispatch, verification, reassembly, metering, payouts. Runs as a conventional multi-region SaaS initially (see §8.6 for the honest discussion of the trust this implies and the roadmap to distribute it).
3. **Customer Console + SDK/API** — job submission (Python/TS SDKs, REST), budget controls, residency and threshold policy ("shares split 5 ways, tolerance for 2 colluding, EU-only devices"), observability (job status, verification proofs, spend).
4. **Host Console** — earnings, device health, resource policy, tax documents.
5. **Marketplace layer** — pricing, matching, reputation, SLAs.

### 5.1 The core user promise, stated precisely

> For a job submitted with privacy parameters (n, t): the input data is split into *n* shares such that **any t−1 or fewer shares reveal zero information** about the data (information-theoretic, not "hard to compute" — literally zero, like a one-time pad). Each device receives shares from at most one share-index, so reconstructing the input requires **collusion of at least t devices chosen by the platform to be pairwise unrelated** (different owners, networks, geographies). Every result carries an unconditionally-checkable integrity tag; a device that modifies its computation is caught with probability ≥ 1 − 2⁻⁶⁴.

This is the *true* version of the founding claim "no subset of machines can combine back the original workload." The honest qualifier — *no subset smaller than t* — is a feature, not a weakness: t is customer-chosen, collusion across strangers' living rooms is a fundamentally harder attack than compromising one cloud tenant, and the anti-collusion placement policy (§8.4) makes assembling t shares operationally unrealistic. Marketing must never drop the qualifier; auditors will not.

---

## 6. Functional Requirements

### 6.1 Job lifecycle (demand side)

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Customer submits a job = (workload template, input data, privacy params (n, t), redundancy factor r, budget cap, deadline, residency constraints) via SDK/REST | P0 |
| F2 | Input is secret-shared **client-side** (in the SDK, inside the customer's environment) so the platform itself never holds plaintext for `privacy=strict` jobs; platform-side dealing offered as `privacy=managed` convenience tier | P0 (managed), P1 (strict) |
| F3 | Coordinator selects n·r workers satisfying constraints (capability, reputation, residency, anti-collusion policy), dispatches shares, tracks liveness | P0 |
| F4 | Workers compute over shares only; coordinator (or customer SDK, in strict mode) reassembles, verifies MACs, and delivers results | P0 |
| F5 | Verification failure ⇒ automatic re-dispatch to fresh workers, offending worker flagged, customer never billed for bad work | P0 |
| F6 | Job observability: per-stage status, verification transcript, cost meter, exportable audit log | P1 |
| F7 | Storage product: erasure-coded + secret-shared blob storage with proof-of-retrievability challenges | P2 (Phase 3) |

### 6.2 Host lifecycle (supply side)

| ID | Requirement | Priority |
|----|-------------|----------|
| F8 | One-click agent install; enrollment binds device → owner → payout account (Stripe Connect) | P0 |
| F9 | Owner-set caps: CPU %, RAM cap, disk quota, bandwidth cap, schedule, "pause when I'm using it," thermal/battery guards | P0 |
| F10 | Sandboxed execution (WASM runtime as default execution substrate; container fallback for homelab tier) with no outbound network except the fabric control plane | P0 |
| F11 | Earnings dashboard, payout history, 1099/tax export | P0 |
| F12 | Device reputation score visible to owner, with reasons (uptime, verification failures, latency) | P1 |
| F13 | Org enrollment (fleet policy, consolidated payout) for P3 | P1 |

### 6.3 Marketplace

| ID | Requirement | Priority |
|----|-------------|----------|
| F14 | Posted-price model at launch (platform sets $/share-hour by device class); auction/spot later | P0 |
| F15 | Reputation: stake-free, history-based (uptime, verified-result rate, speed). New devices start in "probation" — only redundant slots on jobs, never sole holders of a share index | P0 |
| F16 | SLA tiers: Best-effort / Standard (r=2 redundancy) / Assured (r=3 + probation-free workers only) | P1 |
| F17 | Deterministic metering: work units are a pure function of job shape (template + input sizes), computed by the platform at dispatch — never self-reported by devices; receipts become payable only on verified results (§9.4) | P0 |
| F18 | Upfront exact quote: because F17 units are deterministic, every job gets a binding price quote before dispatch; burst rentals are pre-authorized against the quote | P0 |

### 6.4 Workload templates (launch set)

The MVP ships **templates**, not arbitrary code — this bounds both the security surface and the MPC engineering:

1. **T1 — Private linear algebra / embedding & inference primitives.** Matrix–vector and matrix–matrix products, additive layers, dot products over secret-shared inputs with public (or secret) model weights. Covers: embedding generation, linear/logistic scoring, recommendation dot-products, the linear layers of small NN inference. *This is the PoC's demonstrated capability.*
2. **T2 — Private aggregation.** Sums, means, weighted aggregates over shared numeric data (federated-analytics style: telemetry, surveys, financial rollups).
3. **T3 — Nonlinear ML kernels via Beaver triples.** Secret×secret multiplication, squaring (variance), polynomial approximations of activations. *Beaver-triple multiplication is also demonstrated in the PoC.*
4. **T4 — Content-neutral bulk compute (non-private tier).** Rendering, transcoding, scientific batch where confidentiality isn't required — priced lower, uses the same fabric with encryption but not secret sharing. Keeps utilization high while MPC demand ramps.

---

## 7. Security Model (the heart of the product)

### 7.1 Threat model

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| **Curious host** (honest-but-curious) | Reads everything on its own device: RAM, disk, network taps | Additive/threshold secret sharing — a share is uniformly random noise without ≥ t counterparts |
| **Malicious host** | Deviates from protocol: corrupts results, lies about work done, drops shares | Information-theoretic MACs (SPDZ-style) on every shared value; redundant execution (r-of-n); reputation slashing |
| **Colluding hosts (< t)** | Pool their shares | Zero information by construction (see 7.2) |
| **Colluding hosts (≥ t)** | Pool shares to reconstruct | Residual risk. Mitigated by anti-collusion placement (§8.4), per-job ephemeral share indices, customer-chosen t, and detection economics (colluders must find each other without the platform noticing) — **never claimed to be impossible; stated in ToS and docs** |
| **Compromised coordinator** | Sees routing metadata; in `managed` mode sees plaintext during dealing | `strict` mode moves dealing/reassembly into the customer SDK — coordinator only ever routes ciphertext-equivalent shares; long-term: distributed dealing (§8.6) |
| **Network adversary** | Intercepts share traffic | mTLS everywhere; but note shares are *individually worthless anyway* — capturing one share ≠ capturing data |
| **Malicious customer** | Submits illegal/abusive workloads | Template-only execution at launch; content-neutrality is real for T1–T3 (platform literally cannot inspect shared data) — abuse policy therefore operates on *customer identity, payment, and workload shape*, not content (§10.3) |
| **Sybil host** (one actor enrolls many fake devices to capture ≥ t shares of one job) | Undermines anti-collusion placement | Device fingerprinting, payout-account clustering, network/ASN diversity requirements, probation, per-job placement constraint: no two share indices on devices sharing owner, payout, /24, or hardware fingerprint |

### 7.2 Cryptographic construction (launch protocols)

- **Secret sharing:** additive sharing over a prime field 𝔽_p (p ≈ 2⁶¹−1 for the PoC; 128-bit for production). Data x is split as x = x₁ + x₂ + … + xₙ mod p with x₁…xₙ₋₁ uniform random. Any n−1 shares are jointly uniform ⇒ zero information. For t < n threshold flexibility and dropout tolerance, Shamir sharing (degree t−1 polynomials) is the Phase-2 upgrade; additive (t = n per share-group, with r redundant groups) ships first because it is simpler to verify and audit.
- **Linear computation is free:** for public matrix W, each worker computes W·xᵢ locally; Σᵢ W·xᵢ = W·x. No inter-worker communication. This is why ML linear algebra is the launch workload.
- **Multiplication (secret × secret):** Beaver triples dealt by the coordinator (Phase 1: trusted dealer; Phase 2: distributed triple generation). One round of masked-value exchange per multiplication layer.
- **Integrity:** SPDZ-style unconditional MACs. Every secret x is accompanied by a sharing of α·x under a global MAC key α. All operations are performed on both. At reassembly, the verifier checks the MAC relation; a worker that alters its share of x must alter its share of α·x consistently, which requires guessing α — success probability ≤ 1/p ≈ 2⁻⁶¹. **The PoC implements exactly this and demonstrates a tampering worker being caught.**
- **Fixed-point encoding** for real-valued ML data (configurable scale; the PoC uses 2¹⁶) with documented precision bounds per template.
- **Transport & identity:** mTLS with per-device certificates; agent binaries signed; share payloads additionally sealed to the worker's enrolled key so the coordinator's storage layer never holds a share it can open in strict mode.

### 7.3 What we do NOT claim

Honesty section — these go verbatim into public security docs:

1. We do not claim security against ≥ t colluding, actively coordinating hosts. We make that collusion operationally hard and economically irrational, and we let the customer set t.
2. `managed` mode requires trusting the platform's dealer during a job's setup window. `strict` mode exists precisely to remove this; regulated customers should use it.
3. MPC does not hide *workload shape* (sizes, timing, template ID). Metadata privacy is a Phase-4 research item (padding, batching, mixing).
4. Availability is weaker than a datacenter: consumer devices churn. We handle it with redundancy (r), erasure coding, and deadline-aware scheduling — not by pretending home PCs are servers.
5. Side channels on the *customer's own* SDK machine, and denial-of-service by the coordinator, are out of scope.

---

## 8. System Architecture

### 8.1 Component map

```
┌────────────────────────────────────────────────────────────────────┐
│ CUSTOMER ENVIRONMENT                                               │
│  SDK (deal shares, MAC, submit, reassemble+verify in strict mode)  │
└───────────────┬────────────────────────────────────────────────────┘
                │ HTTPS/mTLS (shares only, in strict mode)
┌───────────────▼────────────────────────────────────────────────────┐
│ FABRIC CONTROL PLANE (multi-region SaaS)                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐  │
│  │ Job API  │ │ Scheduler│ │ Dealer*   │ │ Verifier │ │ Metering│  │
│  │ /intake  │ │ +placement│ │ (managed │ │ + MAC    │ │ billing │  │
│  └──────────┘ └──────────┘ │  mode only)│ │  check   │ │ payouts │  │
│  ┌──────────┐ ┌──────────┐ └───────────┘ └──────────┘ └─────────┘  │
│  │ Registry │ │Reputation│  ┌────────────────────────────────────┐ │
│  │ devices  │ │ + fraud  │  │ Share Router (store-and-forward,   │ │
│  │ certs    │ │ engine   │  │ never holds openable plaintext)    │ │
│  └──────────┘ └──────────┘  └────────────────────────────────────┘ │
└───────┬───────────────┬───────────────┬────────────────────────────┘
        │ mTLS          │ mTLS          │ mTLS
┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐
│ HOST AGENT 1 │ │ HOST AGENT 2 │ │ HOST AGENT n │   (WASM sandbox,
│  share x₁    │ │  share x₂    │ │  share xₙ    │    resource caps,
│  compute W·x₁│ │  compute W·x₂│ │  compute W·xₙ│    owner policy)
└──────────────┘ └──────────────┘ └──────────────┘
   each share individually = uniform random noise
```

### 8.2 Workload lifecycle (strict mode)

1. **Deal (customer-side):** SDK encodes data to 𝔽_p fixed-point, samples shares + MAC shares, encrypts each share bundle to its target worker's enrolled public key.
2. **Submit:** job manifest + sealed bundles → Job API. Coordinator sees only sizes and routing labels.
3. **Place:** Scheduler picks n·r workers subject to: capability ≥ template requirement, reputation tier, residency, anti-collusion constraints (§8.4). Assigns share-index groups.
4. **Execute:** agents pull bundles, decrypt inside sandbox, run the template kernel over the share, produce result-share + MAC-result-share, sign, return.
5. **Collect & cross-check:** Verifier collects r redundant results per share index, majority-checks, then returns result shares to the SDK.
6. **Reassemble & verify (customer-side):** SDK sums shares, checks MAC relation. On failure: automatic report → re-dispatch → reputation event.
7. **Settle:** metering finalizes share-hours per worker; payouts accrue; customer invoice line created; verification transcript archived (hash-chained) for audit.

### 8.3 Technology choices (initial)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Host agent core | Rust | memory safety on hostile-adjacent devices, small static binaries, WASM host (wasmtime) |
| Execution substrate | WASM (wasmtime) with fuel metering | deterministic, sandboxed, cross-platform, meterable; GPU/NPU via WASI-NN later |
| Control plane | TypeScript/Node or Go services; Postgres; NATS or Kafka for dispatch; Redis for liveness | boring, hireable, fast to iterate |
| Crypto kernels | Rust crate shared by SDK + agent (same code both sides), audited | one implementation to audit, no drift |
| SDKs | Python first (ML audience), TypeScript second | demand-side reality |
| Payments | Stripe Connect (hosts as connected accounts) | 1099 handling, KYC, payouts solved |
| PoC (this repo) | Node.js, zero dependencies | prove the protocol end-to-end in an afternoon, runnable anywhere |

### 8.4 Anti-collusion placement policy

For a job with share indices S = {1…n}: no two distinct share indices may be placed on devices that share **any** of: owner account, payout account, public IP /24, ASN + city, or hardware fingerprint cluster. Redundant replicas (same index) may share attributes — colluding replicas of the *same* share learn nothing more than one copy. Placement solver treats these as graph-coloring constraints; jobs that cannot be placed at the requested diversity fail fast with a clear error rather than silently degrading privacy.

### 8.5 Scaling architecture

- **Cell-based design.** The fabric is partitioned into geographic **cells** (e.g., us-east, eu-central), each with its own scheduler + share router; the registry and billing are global. A job's shares stay within cells satisfying its residency policy. Cells cap blast radius and keep share-routing latency sane.
- **Scheduler scale:** placement is a constraint-solve over the cell's live device set (10⁴–10⁶ devices). Live set kept in memory per cell scheduler shard; shards partition by device geohash. Target: place a 1,000-worker job in < 5 s.
- **Churn as a first-class input:** expected device availability is modeled per device (time-of-day curves learned from history). Scheduler over-provisions r based on predicted dropout so that P(job completes by deadline) ≥ SLA. Storage product uses (k, m) erasure coding *of shares* with proactive repair.
- **Data plane:** share bundles move via regional object stores (store-and-forward) so the coordinator never needs a live socket to both sides simultaneously; agents pull. Wide-area NAT traversal problems disappear — agents only ever dial out.
- **Throughput math (sanity check):** T1 embedding job, 1 GB input, n=5, r=2 ⇒ 10 GB egress from customer, 10 GB fabric ingress. At 10k concurrent jobs/day this is object-storage-scale traffic, not exotic. MPC compute overhead for linear templates ≈ n× raw FLOPs (each worker does full-size linear algebra on its share) — priced accordingly (§9).
- **Verification scale:** MAC check is O(result size) field ops on customer SDK (strict) or verifier fleet (managed); negligible.
- **Growth phases:** 1 cell / 500 devices (friends-and-fleet beta) → 3 cells / 10k devices (public host beta) → 10+ cells / 250k devices (GA). Registry, reputation, and billing are conventional horizontally-scalable services throughout; the novel scaling risk is concentrated in the placement solver and share router, both cell-local by design.

### 8.6 Decentralization roadmap (control-plane trust)

Phase 1 ships with a centralized coordinator — pragmatic, but it concentrates metadata and (in managed mode) dealing trust. Committed roadmap: (a) strict mode default for all privacy templates (dealing already out of the platform's hands), (b) distributed Beaver-triple generation between worker committees (removes dealer trust for multiplication), (c) multi-party dealing service run by independent operators (n-of-m coordinators must collude to break managed mode), (d) published transparency log of placement decisions so customers can audit anti-collusion policy compliance.

---

## 9. Economics

### 9.1 Pricing model (launch)

- **Unit:** share-hour, normalized by device class benchmark score (a published, agent-run benchmark — CPU vector throughput, RAM, sustained bandwidth).
- **Customer price:** posted price per template per SLA tier. Privacy templates carry the n·r multiplier explicitly in the quote (e.g., "effective compute = 10× raw due to n=5, r=2") — customers see exactly what confidentiality costs. Target launch price for T1: competitive with hyperscaler spot for the *effective* compute, i.e., the privacy premium is the multiplier, not a markup on top.
- **Host payout:** 55–65% of customer price flows to hosts (benchmark-weighted). Platform take covers coordination, verification, redundancy waste, fraud reserve, and payment costs. Take rate reviewed quarterly against contribution margin.
- **Non-private tier (T4)** priced near Salad/vast.ai levels to keep the fleet warm.

### 9.2 Fraud & gaming economics

- Fabricated results: caught by MACs/redundancy ⇒ no payout + reputation slash ⇒ negative EV.
- Benchmark gaming: periodic re-benchmark with canary workloads (known-answer jobs indistinguishable from real ones).
- Sybil supply: payout requires KYC'd Stripe Connect account; device-count per account capped until history accrues.
- Idle-faking (agent reports capacity it throttles): canary jobs measure effective throughput; payouts are for *delivered verified work*, not advertised capacity.

### 9.3 Open business questions (tracked, not guessed)

| ID | Question | Proposed default |
|----|----------|------------------|
| OQ-1 | Payout floor / minimum viable host earnings — is $15–40/mo/device enough to retain P1 hosts? | Validate in beta with real payout data before GA marketing |
| OQ-2 | Take rate 35–45% — defensible vs. Salad (~50%+) and vast.ai (~25%)? | Start 40%, publish it, adjust with margin data |
| OQ-3 | Do we subsidize demand or supply first? | Supply via P3 fleets (MSPs) — cheapest reliable capacity, then chase demand |
| OQ-4 | Electricity cost disclosure — do we show hosts net-of-power earnings? | Yes; trust > short-term signups |

---

### 9.4 Metering architecture — measuring usage on hardware nobody trusts

Metering is the trust spine of the marketplace: hosts join to earn, customers pay for bursts, and neither side trusts the other's meter. The design principle: **never meter what a device claims; meter what the platform dispatched and verified.**

1. **Deterministic work units.** Because workloads are templates (F17), the work content of a job is a pure function of its shape: a matvec of dimensions m×n over share+MAC streams is exactly 2·m·n field multiplications per worker; a length-k Beaver dot product is ~12·k operations; a stored share is its byte size × months. The coordinator computes the meter reading *at dispatch time* — device clocks, agent-reported CPU%, and host honesty are all irrelevant to the number of units. Side benefit (F18): the customer gets an exact, binding quote **before** the job runs — a materially better burst-rental experience than hyperscaler post-hoc billing surprises. For the later arbitrary-code tier, the WASM runtime's fuel metering (deterministic instruction counting) plays the same role.
2. **Pay only for verified work.** A receipt becomes payable only when the attempt's MAC verification (or redundancy cross-check, per template) passes. This collapses metering fraud into result fraud, which the fabric already detects with probability 1−2⁻⁶¹ per corrupted value. A host cannot inflate earnings without forging results, and forging results is a losing game.
3. **Dual-signed, hash-chained receipts.** Each receipt (job, share index, worker, units, result hash) is signed by the worker's device key and countersigned by the verifier, then appended to a hash-chained ledger. Host payouts and customer invoices reconcile to the *same* receipts, so disputes on either side resolve against one auditable record. **Double-entry invariant, continuously checked:** every customer millicredit = worker payouts + platform take; any imbalance halts payouts and pages engineering.
4. **Time and speed are measured by the platform, not the device.** Latency = coordinator-observed round-trip timestamps. Device speed class = a signed, agent-run benchmark, continuously re-validated by **canary jobs** — known-answer workloads indistinguishable from real ones. Canaries catch both cheating (wrong answers) and idle-faking/throttling (a host advertising a class it doesn't deliver gets re-classed and re-priced, not paid for phantom capacity).
5. **Bandwidth and storage.** All share traffic transits platform rendezvous points (agents only dial out), so byte counts are platform-observed on infrastructure we run. Storage-months are payable only while random proof-of-retrievability challenges keep passing.
6. **Failed attempts.** Customers are never billed for rejected attempts (F5). Honest workers caught in a quarantined attempt also receive nothing for it — strict "verified work only" keeps the rule simple and un-gameable; the expected cost of collateral quarantine is priced into the platform take, and reputation restoration (production pinpoints cheaters via redundancy) limits how often honest hosts are hit.
7. **Phones and small devices.** Mobile agents run only on Wi-Fi + charging by default (owner-configurable), with thermal/battery guards; OS attestation (Play Integrity / App Attest) raises the cost of emulated Sybil fleets; earnings accrue as micro-payouts and disburse above a threshold so payment-rail fees don't eat the host's margin.
8. **Anti-gaming backstop.** Statistical monitors flag physically implausible performance (completing faster than the device class allows), payout escrow windows allow clawback on late-detected fraud, and per-account device caps limit Sybil blast radius until history accrues (§9.2).

*PoC note:* items 1, 2, 3 (units, pay-on-verify, double-entry invariant) and the upfront quote are implemented and tested in `pocketcloud/poc/` — see Appendix A.

## 10. Legal, Compliance, Abuse

### 10.1 Host protection (as important as customer privacy)

- Hosts execute only signed platform templates in a sandbox with no general egress; hosts cannot access share contents; therefore hosts have a strong "mere conduit of random noise" posture. Counsel to produce a host-facing plain-English "what's on my machine" document before public beta.
- Resource caps and schedules are enforced agent-side and are owner-sovereign: the platform can never exceed what the owner set.

### 10.2 Customer compliance posture

- `strict` mode + shares-as-noise supports GDPR/HIPAA arguments that personal data is never *processed* by hosts in intelligible form; still, we will obtain formal DPIA templates and (Phase 3) SOC 2 Type II for the control plane, and publish the cryptographic design for review. Residency pinning (cell policy) supports data-localization requirements.
- Export control: MPC/crypto distribution reviewed under EAR §740.17 (mass-market encryption) before international host onboarding.

### 10.3 Abuse policy under content-blindness

We cannot inspect T1–T3 data (by design), so abuse control shifts to: KYC on customers above a spend threshold, template whitelisting (no arbitrary code), workload-shape anomaly detection, sanctions screening on both sides, and a published lawful-process policy. Accepting this trade-off explicitly is a leadership decision — **flagged as a decision record, DR-01: content-blind compute means we police actors, not payloads.**

### 10.4 Tax & payments

Hosts are independent contractors; Stripe Connect handles 1099-K/1099-NEC. International host payouts gated until tax review per country.

---

## 11. Rollout Plan

| Phase | Timeframe | Scope | Exit criteria |
|-------|-----------|-------|---------------|
| **0 — PoC** (this repo) | now | Protocol demo: additive sharing + SPDZ MACs + Beaver mult, coordinator/worker over HTTP, tamper detection | Demo runs; crypto approach validated; PRD reviewed |
| **1 — Private alpha** | +1 quarter | Rust agent (CPU-only), WASM T1/T2 kernels, single cell, managed mode, fleet supply from P3 (MSP partners), 5 design-partner customers | 10 real jobs/week; verification catches 100% of injected faults; payout loop works end-to-end |
| **2 — Host beta** | +2–3 quarters | Public host onboarding (P1/P2), strict mode SDK (Python), Shamir t-of-n, reputation v1, Stripe payouts GA, security audit #1 | 2k devices; churn-tolerant completion SLA ≥ 99% on Standard tier |
| **3 — Commercial GA** | +4–6 quarters | T3 nonlinear kernels, storage product (F7), SOC 2, EU cell + residency, published transparency log | Revenue-positive job classes; NPS targets; audit #2 clean |
| **4 — Scale & research** | ongoing | Distributed dealing, GPU/NPU via WASI-NN, metadata privacy, spot market, arbitrary-code sandbox tier | — |

## 12. KPIs

- **Supply:** enrolled devices, share-hours offered, host 90-day retention, payout NPS.
- **Demand:** jobs/week, verified-result rate (target ≥ 99.99%), job completion-by-deadline rate, revenue per template.
- **Trust:** verification failures caught / injected (100%), time-to-detect malicious worker, external audit findings closed.
- **Economics:** contribution margin per job class, take rate vs. margin, fraud loss < 0.5% of GMV.

## 13. Top Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MPC overhead makes pricing uncompetitive for all but compliance buyers | Med | High | Lead with compliance buyers (P4/P6); T4 non-private tier keeps fleet utilized |
| Supply-side cold start | High | High | P3 fleet supply first (MSP channel — PDC's own network is the wedge) |
| Crypto implementation bug destroys the core promise | Low-Med | Existential | Single audited Rust crate, external audits before Phase 2 and 3, bug bounty, conservative protocol choices (no novel crypto) |
| Collusion/Sybil breaks anti-collusion placement | Med | High | §7.1 Sybil row; publish placement transparency log; cap value-at-risk per job in early phases |
| Regulatory surprise (money transmission, export, host classification) | Med | Med | Counsel review gates each phase; Stripe Connect narrows payment exposure |
| A hyperscaler ships "confidential batch inference" cheaply | Med | Med | Our moat is provider-neutrality + information-theoretic (not enclave) guarantees; lean into sovereignty positioning |

## 14. Decision Records

- **DR-01 (2026-07-03):** Content-blind compute — we police actors (KYC, shape analysis), not payloads. Accepted as a founding trade-off.
- **DR-02 (2026-07-03):** No token / no blockchain. Fiat payouts via Stripe Connect.
- **DR-03 (2026-07-03):** Templates before arbitrary code. Security surface first, generality later.
- **DR-04 (2026-07-03):** Additive sharing + SPDZ MACs at launch; Shamir t-of-n in Phase 2. Simplicity and auditability over flexibility.
- **DR-05 (2026-07-03):** The collusion threshold qualifier is always stated. No absolute-security marketing.
- **DR-06 (2026-07-03):** Nothing merges without the full test + regression gate sequence; the gates are CI-enforced and may not be weakened to unblock work. Canon: `ENGINEERING-STANDARDS.md`.
- **DR-07 (2026-07-03):** All work is defined ahead of execution in the hierarchical feature-PRD framework (`docs/prds/`) with task IDs, dependencies, and acceptance criteria, so delegated agents — of any capability tier — execute from self-contained specs.

---

## 15. Delivery Framework (how this PRD becomes shipped software)

This master PRD states product truth. Execution is governed by three
companion layers, all in this repo and all binding:

| Layer | Document | Role |
|---|---|---|
| Standards | [`ENGINEERING-STANDARDS.md`](ENGINEERING-STANDARDS.md) | The enforceable canon: Definition of Done, CI/CD gate sequence, testing policy (unit/property/adversarial/e2e/golden/chaos), security engineering rules, dependency policy, and the agent execution contract |
| Roadmap | [`ROADMAP.md`](ROADMAP.md) | Milestones M0–M5 with deliverables mapped to feature areas and hard exit criteria |
| Work breakdown | [`prds/`](prds/) | Nine feature areas (FT-00…FT-08), each a self-contained `PRD.md` (requirements, interface contracts, threat model, QA obligations, decision records, open questions) plus a `TASK-TRACKER.md` (every task with ID, priority, dependencies, acceptance criteria, status, artifacts, change log) |

Enforcement is mechanical, not aspirational: `.github/workflows/
pocketcloud-ci.yml` runs the full PoC suite and framework-integrity checks on
every PR, and the gate set only grows (FT-00 owns it; changes require a
Decision Record). Work not present in a tracker does not exist; guidance for
downstream agents is embedded in every feature folder so it survives
delegation to smaller models (see `prds/README.md`, "The rules").

---

## Appendix A — Mapping the PoC to this PRD

The proof of concept in `pocketcloud/poc/` implements, in dependency-free Node.js:

| PRD element | PoC artifact |
|---|---|
| Additive secret sharing over 𝔽_p (§7.2) | `src/crypto/field.js`, `src/crypto/secret-sharing.js` |
| SPDZ-style MACs + tamper detection (§7.2, G2) | `src/crypto/secret-sharing.js` (MAC dealing), verification in `src/coordinator/` |
| T1 private linear algebra (§6.4) | worker kernel `matvec` — private-input embedding/inference layer |
| T3 Beaver-triple multiplication (§6.4) | `src/crypto/beaver.js` + coordinator dealer + two-round masked exchange |
| Coordinator / dealer / verifier / reassembly (§8.1–8.2, managed mode) | `src/coordinator/server.js` |
| Host agent computing on shares only (§5, F10 conceptually) | `src/worker/server.js` |
| Malicious-host detection demo (F5) | `--tamper` flag on a worker; demo shows MAC failure catching it |
| Fixed-point real-number encoding (§7.2) | `src/crypto/encoding.js` |
| Customer SDK/CLI (F1) | `src/client/client.js`, `demo.js` |
| Deterministic work units + upfront quote (F17, F18, §9.4) | `WORK_UNITS` / `POST /jobs/estimate` in `src/coordinator/coordinator.js` |
| Pay-only-on-verified receipts, per-worker payouts, double-entry invariant (§9.4) | metering ledger + `GET /ledger` in `src/coordinator/coordinator.js`; `test/metering.test.js` |

Run instructions: `pocketcloud/poc/README.md`.

---

## Appendix B — Serving GLM-class LLMs on the fabric

Full MPC inference of a frontier-scale MoE model (hundreds of GB of weights, 60+ layers, autoregressive token loops) is not feasible on WAN-connected consumer devices: nonlinearities cost interactive rounds under MPC, and generation would need thousands of sequential round trips per token. Instead, large open-weight models (GLM, Llama, DeepSeek class) run on the same fabric in **three modes** along a privacy/performance spectrum:

**Mode 1 — Distributed serving, transport-private.** Petals-style sharding: the model is split by transformer blocks and — because these models are MoE — by *experts* across hosts; activations flow through a pipeline of devices over mTLS. MoE is a structural gift for edge serving: only a few experts activate per token, so each host serves a handful of experts on commodity hardware, and aggregate fleet memory is what matters, not any single box. Privacy here is trust dispersion (no single party sees the whole computation, anti-collusion placement applies to pipeline stages), **not** cryptography — activations can leak information about inputs, and public docs must say so.

**Mode 2 — The sandwich (flagship).** The customer SDK runs the model's *edges* locally: tokenizer + embedding layer on input, final LM head + sampling on output. The fabric runs only the middle blocks. Consequences: raw tokens never leave the customer in either direction — the fabric streams final hidden states (~10–30 KB/token) back to the SDK, which decodes them locally, so the fabric never learns which words went in **or came out**. Client-side cost is small (embedding/unembedding is a tiny fraction of total weights).

**Mode 3 — MPC, applied surgically.** The T1 `matvec` template is exactly a transformer linear layer over secret-shared activations with public weights. Viable today for batch, latency-tolerant jobs on small models (embeddings, classifiers, rerankers, LoRA-scale heads) and for private sub-steps (e.g., secret-shared retrieval scoring) feeding a Mode-2 session. The full-model MPC boundary moves as MPC-friendly nonlinearity protocols mature; the fabric doesn't change, templates do.

**Session scheduling.** LLM serving lands on the capable-supply tier (P2/P3: homelab GPUs, MSP fleets); conversations are pinned to a pipeline group within one geographic cell so the KV cache stays resident; a dropped stage is recovered by re-prefilling on a standby replica (redundancy factor r applied to pipeline stages).

**Response delivery.** Hosts only ever dial out, so no NAT traversal into homes. Batch/MPC jobs return result *shares* via store-and-forward — the response never exists as an assembled whole anywhere in transit; it materializes for the first time inside the originator's SDK at reassembly. Interactive sessions use a thin per-cell **relay**: client and final pipeline stage both hold outbound QUIC/WebSocket connections, and the relay stitches sealed frames it cannot read (in Mode 2 the frames are hidden states, not text). Relay frame counts double as the session meter (§9.4). Integrity in Modes 1–2 is redundant spot-checking + reputation (probabilistic detection), not MACs — an honest gap versus Mode 3, stated in the docs.

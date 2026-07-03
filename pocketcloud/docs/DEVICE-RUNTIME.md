# Device Runtime Architecture — Pocket Cloud Worker Agent

**Status:** Decision-ready engineering document. Answers the founders' open question ("does the worker installer need a runc-equivalent container runtime to run open-source models / assigned MoE experts?") and specifies the runtime, delivery, and governance architecture per device class.

**Method note:** Load-bearing platform-policy and model-architecture claims were verified by live web fetch (Google Play/Apple policies, Android 15 FGS limits, HuggingFace `config.json` for Mixtral/DeepSeek-V3/GLM-4.5/Qwen3, llama.cpp backend docs, Petals published throughput). Performance and economics figures not directly verified are labeled estimates from training knowledge (~Jan 2026 cutoff). Confidence labels: **[H]** high, **[M]** medium, **[L]** low.

---

## 0. TL;DR

1. **No, you do not need a runc-equivalent — and on the platforms in your pitch it is mostly impossible to ship.** Android apps run as `untrusted_app` with no namespace/cgroup access; iOS has no fork/exec of downloaded code and no writable+executable memory for third-party apps. **[H]** A container runtime isolates *arbitrary code*; Pocket Cloud v1 never runs anyone's code but its own. Models and MoE experts are **tensor files — data, not programs**. The agent embeds one fixed, code-signed inference engine (llama.cpp/ggml-class) and downloads signed GGUF/safetensors artifacts. The isolation problem collapses from "sandbox untrusted code" to "safely parse untrusted files." **[H]**
2. **Containers appear in exactly one place: Linux homelab, as packaging** (rootless Podman/OCI image, because homelab owners expect it), never as the security boundary. A future arbitrary-customer-code tier gets **gVisor or Firecracker microVMs on Linux hosts only — never bare runc** on hardware you don't own. **[H]**
3. **The honest supply map:** GPU desktops + homelab Linux boxes carry essentially all LLM revenue; Android is a bounded overnight-batch trickle (≤6h/night sanctioned compute); iOS, Echo/Alexa, Google Home, Tizen/webOS TVs, consumer routers, and game consoles are effectively zero. **[H]**
4. **The MoE-experts-on-phones pitch fails the arithmetic.** Interactive serving over residential WAN hits a 250–500 ms/token network floor (2–4 tok/s ceiling before compute); batch expert hosting on a 20 Mbps phone uplink grosses **~$0.50–2/month** — below owner electricity + attention cost. **[H on the math]** What survives: whole-small-model batch on phones, whole/pipeline models on homelab fiber, MPC batch everywhere.
5. **Winning architecture: Tiered Fleet** — one control plane and one shared Rust core, three execution substrates (Tier-M mobile / Tier-D desktop / Tier-H homelab), capability-vector scheduling, TUF-signed content-addressed artifact delivery, two decoupled update channels (slow app binary, fast data artifacts), and layered soft+hard resource caps. Build order: Tier-H first (it pays), Tier-M last (with a month-4 kill gate).

---

## 1. The runc question, answered explicitly

**Question:** Would the worker installer need a low-level runc-equivalent container runtime to run open-source models / the experts assigned to that device?

**Answer: No.** Per platform:

| Platform | Can a runc-equivalent even exist in app-distributed software? | Is one needed to run models? | What we use instead |
|---|---|---|---|
| Android | **No.** APK runs as `untrusted_app` (SELinux + seccomp): no `CLONE_NEWUSER`, no cgroup writes; since API 29 apps can only `exec()` binaries shipped read-only inside the signed APK **[H, verified]** | No | llama.cpp/ggml as JNI `.so` inside the signed APK; weights downloaded as data |
| iOS | **No.** No fork/exec of downloaded binaries, no writable+executable memory (JIT entitlement is EU-browser-engines-only); guideline 2.5.2 bans downloaded executable code **[H, verified]** | No (moot — iOS is not supply, §2) | Embedded engine + Metal; iOS ships as demand-side app |
| Windows | runc is Linux-only; WSL2/Docker Desktop costs 1–2 GB RAM and destroys plug-and-play for consumers **[H]** | No | Native signed service; workers in **Job Objects** (kernel-hard CPU%/RAM/IO/egress caps) |
| macOS | runc is Linux-only; a Linux VM is heavyweight and unnecessary **[H]** | No | Notarized, App-Sandboxed launchd agent; QoS-background workers |
| Linux (homelab/SBC) | Yes — trivially | No for models; cgroups v2 + systemd slice provide everything runc would | **OCI image as optional packaging** (rootless Podman one-liner) wrapping the identical binary; security comes from cgroups/namespaces/seccomp either way |

**Why "no" is safe rather than reckless — the model-as-data argument [H]:**

- An open-weight model or a MoE expert shard is a tensor file (GGUF/safetensors). You never need a container to *run data*; you need one only to run *arbitrary code*. Pocket Cloud v1 runs exactly two things: (a) a fixed, signed inference engine on vetted weight artifacts, and (b) a fixed MPC circuit interpreter (wasmtime, fuel-metered) on platform-authored circuit descriptions. Both are our code; jobs are data.
- The residual threat is the **parser**, not code isolation. Malicious model files exploiting deserialization bugs are a real class (llama.cpp had GGUF heap-overflow CVEs in 2024 **[M on identifiers, H on the class]**; Python pickle is RCE by design). Mitigations are cheap and specified in §5: format allowlist (GGUF + safetensors only, never pickle, no ONNX custom ops), platform-side vetting + dual signatures, memory-safe (Rust) header validation before ggml touches bytes, continuous fuzzing, low-privilege capped worker processes.
- On mobile, the OS already wraps the entire agent in a sandbox **stricter than anything runc would build** (per-app UID + SELinux + seccomp on Android; seatbelt + code-signing on iOS). Adding a container inside an app sandbox is impossible and would be redundant if it were.

**The one hard product boundary to write down today [H]:** the moment a customer can submit code — a custom Python tokenizer, a custom op, "bring your own container" — the entire arbitrary-code isolation problem reopens. That feature is a **separate tier** (Tier-H only, gVisor where no KVM / Firecracker microVMs (~125 ms boot) where KVM exists, explicit owner opt-in, higher payout), never a patch to this agent. Bare runc is never acceptable for stranger code on stranger hardware: a container escape on someone's home PC is an existential-liability event.

---

## 2. Device-class supply matrix (the brutal version)

| Device class | Installable? | Sustained background compute? | Store/policy risk | Supply verdict |
|---|---|---|---|---|
| **Windows/Linux/macOS desktops (esp. GPU)** | Yes — direct download (EV-signed / notarized; not OS app stores) | Yes (desktops); laptops sleep/battery-gated | No store gate; permanent AV/EDR whitelisting tax **[H]** | **YES — this is the actual business.** RTX 3060-class: 30–50+ tok/s on 7–8B Q4 **[M]**; worth 10–100× a CPU laptop |
| **Homelab Linux / SBC (Pi 5 etc.)** | Yes, trivially (systemd or OCI image) | Yes, 24/7 | None | **YES.** High-trust kernel-hard fleet; Pi-class value is cents/day **[M]** — goodwill, not revenue |
| **Android phones/tablets** | Yes (Play with fragility, or sideload — Honeygain precedent lives off-Play **[H, verified]**) | Only foreground-service; `dataSync` FGS ≤ **6h/24h** on Android 15+ **[H, verified]**; Doze kills everything else | High — Play bans on-device crypto mining and scrutinizes resource-monetizing apps **[H, verified]** | **TRICKLE.** ~4–6 usable h/night while charging+idle+Wi-Fi; MPC/batch only |
| **iPhone/iPad** | App only; no daemons | `BGProcessingTask` = minutes/day, charger-gated, unscheduled **[H, verified]** | Guideline 2.4.2 (battery-drain / unrelated background processes) — likely rejection **[H on text, M on outcome]** | **~ZERO paid supply.** Nuance for honesty: DreamLab (2015–2025) proved Apple-approved *foreground-overnight charity* compute on millions of iPhones — a UX no paid marketplace can demand. Ship iOS as buyer/dashboard app |
| Echo/Alexa, Google Home/Nest | **No code path exists** (Skills run in the cloud) **[H]** | — | — | **NO. Full stop.** Anyone counting "500M Alexa devices" as supply is selling hype |
| Android TV / Fire TV | Yes (store/sideload) | Poor: 3–5 h/day awake, weak SoCs **[M]** | Medium | **Trickle, not worth engineering** |
| Tizen / webOS TVs | HTML5 apps only, no background model **[H]** | No | — | **NO** |
| Consumer routers | Stock firmware: no. OpenWrt niche: hardware too weak, ISP ToS issues **[H]** | — | — | **NO** |
| Game consoles | No third-party agent path (FAH-on-PS3 was first-party Sony) **[H]** | — | — | **NO** |

**Precedent calibration [H, corrected]:** every successful *paid* compute marketplace (Salad, io.net) is a direct-download desktop GPU client. Store-app *volunteer* compute has succeeded twice at scale (BOINC on Google Play since 2013; DreamLab on both stores 2015–2025, millions of phones) — proving a charging-overnight mobile batch channel exists, but only ever as donation-ware. Also inherit this: security vendors label the earn-from-idle category "proxyware"; expect AV flags, reviewer skepticism, and hostile press framing on day one regardless of conduct.

---

## 3. The architecture: Tiered Fleet (Tier-M / Tier-D / Tier-H)

**Design invariants:**

1. **Code is ours; jobs are data.** No customer code on any tier in v1.
2. **One shared Rust core crate** (control-plane client, CAS/Merkle verifier, policy/caps engine, payout ledger, wasmtime MPC harness) compiled for all targets; only per-platform shims and UI differ. This caps the mobile engineering tax and keeps three substrates from becoming three codebases.
3. **Capability-based scheduling, never tier stereotypes.** Nodes advertise a signed capability vector: platform, substrate set, grantable RAM/VRAM, measured benchmark (tok/s on a canary model, memory-stream GB/s), measured uplink/RTT, hard-cap class (kernel-hard vs soft), 30-day availability, owner policy window, **cold/warm model-cache state**. The scheduler matches jobs to capabilities.
4. **Weights are mmap'd read-only, content-addressed, signed.** Never pickle.
5. **Interactive LLM serving is Tier-H-only, and even there sold as latency-tolerant batch first** (§7 math).

### Execution substrate per tier

| | Tier-M (Android; iOS = dashboard only) | Tier-D (Windows, macOS) | Tier-H (Linux homelab/server) |
|---|---|---|---|
| Process model | Single app; worker = `dataSync` foreground service; WorkManager gates (charging + idle + unmetered + battery-not-low, OS-enforced) | Signed service/daemon + tray; workers = separate low-privilege child processes | systemd service in its own slice; **also published as OCI image** (rootless Podman) |
| LLM engine | llama.cpp/ggml `.so` in signed APK (CPU NEON/i8mm; Vulkan/OpenCL-Adreno opt-in; Hexagon NPU deferred) | Native llama.cpp worker (CUDA/Vulkan on Windows, Metal on macOS) | Native llama.cpp (CUDA/ROCm/Vulkan); big nodes may host whole 30–70B models or layer blocks; vLLM-class servers ship as containers *inside this tier* (packaging convenience) |
| MPC engine | wasmtime AOT module in-app, **fuel + epoch metered** | Same wasmtime module, low-privilege worker | Same module — one MPC engine fleet-wide |
| Container runtime | **Impossible** | **None** (optional WSL2 "Pro" add-on only if a customer-code tier ever ships) | OCI as packaging; gVisor/Firecracker reserved for future customer-code tier |
| Workloads | Whole-small-model batch (0.5B–8B Q4: embeddings, extraction, classification, eval — 5–25 tok/s decode on 2023+ flagships **[M]**), MPC shards. **No expert serving, no pipeline stages** | Same + GPU batch inference (the revenue) | Everything, incl. the only (marginal) pipeline-parallel serving |

**Engine choice rationale [H, corrected for precision]:** llama.cpp/ggml is the broadest-coverage engine for the stated model families (GLM/Llama/DeepSeek incl. MoE): one MIT-licensed ~5–12 MB statically-linkable library, one model format (GGUF) with day-zero support for new *checkpoints* of supported architectures and the fastest community turnaround (days-to-~2-weeks) on new *architectures* — e.g., GLM-4.5's `Glm4MoeForCausalLM` was unsupported at its 2025-07-28 release and merged ~a week later. Do not promise day-zero support for brand-new architectures; on mobile, engine updates ride the app release train (plan monthly). ExecuTorch/ORT-QNN NPU fast-paths are a later optimization (per-SoC packaging tax); MLC-LLM's per-architecture compiled artifacts fight our distribution model; WASI-NN adds a shim without adding isolation (its inference runs in a native host plugin anyway).

**Where WASM genuinely earns its keep (grafts adopted):** (a) **fuel metering as the MPC billing and dispute unit** — the same shard costs the same fuel on every device; payouts = fuel × device-rate; disputes are re-derivable (fuel instrumentation ~10–50% overhead on tight loops **[M]**, so epoch-only on throughput inference paths); (b) **deterministic re-execution as fraud control** — ban `relaxed-simd` in verification-critical modules, pin imports, no wall-clock/random capabilities, so 2-of-3 quorum results are byte-comparable; (c) **no-sockets-by-construction** — WASM job logic gets no network capability at all, all transfer is host-mediated; (d) a **portable hard RAM trap** via linear-memory maximums. Pure-WASM inference is rejected: no GPU/NPU path and a 1.5–4× CPU haircut **[M]** on exactly the machines carrying the revenue.

### One control plane

All tiers speak gRPC-over-HTTP/2 (WebTransport fallback), **outbound-only** — no inbound ports, which sidesteps CGNAT for everything except Tier-H interactive serving (relay/TURN rendezvous when QUIC hole-punching fails). Messages: `Register(capability_vector, attestation)` · `Heartbeat(utilization, thermal, budget_remaining, cache_warmth)` · `LeaseJob` · `FetchArtifact` (CDN redirect) · `SubmitResult(proof)` · `Yield(reason)`. Lease TTLs and checkpointing encode the tiers' different failure semantics (a Tier-H lease means "will complete"; a Tier-M lease means "might, if the charger stays in").

---

## 4. Model & expert delivery: signing, chunking, dedup

One mechanism for all artifact types (whole models, expert tensor packs, LoRAs, MPC circuits, WASM modules):

1. **Content-addressed store (CAS).** Artifacts split into 8–64 MiB chunks, SHA-256 addressed, fetched via CDN with HTTP range requests — resumable and per-chunk verified, which is the difference between "survives a flaky evening Wi-Fi window" and "redownload 5 GB." Peer-assisted (webseed-backed) distribution is default-on for Tier-H only; metered/mobile links never seed.
2. **Signed manifests, TUF-rooted, transparency-logged.** Each manifest carries: artifact id/version, architecture + quant metadata, Merkle root + ordered chunk hashes, resource envelope (min RAM, expected RSS, max disk, expected egress), **engine-compat range**, and allowed capabilities (for WASM modules). Two signatures: the platform publishing key (offline HSM root, TUF role hierarchy — prevents rollback/freeze attacks) and the vetting pipeline's key attesting "parsed clean under fuzzer-hardened loader, format allowlist, no executable content." A **Sigstore-style transparency log** over manifests means a compromised signing key cannot silently target a single device. Customers never hand files directly to devices.
3. **Format allowlist, enforced at parse time.** GGUF + safetensors + our WIT-typed circuit format. Never pickle, never arbitrary ONNX custom ops, no scripts in artifacts. Rust validator checks magic/version/tensor-shape sanity before ggml loads a byte.
4. **Dedup is automatic from content addressing.** Fine-grained expert packs (DeepSeek-class expert ≈ 25 MB ≈ 1–3 chunks) and whole-model artifacts share chunks where tensor alignment allows; the local CAS is refcounted with LRU-under-owner-disk-cap (defaults: 20 GB Tier-D/H, 6 GB Tier-M) and scheduler `Prefetch` pinning hints.
5. **mmap read-only + cold/warm scheduling.** The kernel can reclaim weight pages instantly under owner memory pressure — but refault costs a NAND re-read (seconds for multi-GB sets) **[H]**. Nodes report cache warmth in heartbeats; the scheduler re-warms cold nodes with low-priority work before assigning latency-sensitive jobs.
6. **Two decoupled update channels (load-bearing operational decision).** Channel A = the agent/interpreter binary: store review or signed installers, staged rollout 1%→10%→50%→100%, auto-rollback on health-check regression, server-side halt within one 60 s heartbeat. Channel B = artifacts: hours-latency data updates with no store review. The engine-compat range in every manifest means a GGUF format bump can never brick the fleet; scheduler supports an N−2 agent-version window because a sideloaded Android fleet cannot be force-updated.

---

## 5. Resource governance — owner caps → enforcement mechanism

Owner sets: CPU %, RAM GB, VRAM GB, disk GB, network Mbps (up/down separately), schedule window, charging/battery policy, thermal ceiling, pause-when-in-use. Enforcement is **layered — agent-soft everywhere, plus the hardest OS backstop that exists** — and the capability vector honestly reports which layer a node has (kernel-hard nodes get higher-trust work).

Legend: **HARD** = OS/kernel-enforced even if the agent misbehaves; **SOFT** = agent's own policy engine.

| Cap | Android (Tier-M) | iOS | Windows (Tier-D) | macOS (Tier-D) | Linux (Tier-H) |
|---|---|---|---|---|---|
| CPU % | Thread count + `THREAD_PRIORITY_BACKGROUND` (HARD deprioritize; % is SOFT) | Thread QoS `.background` only | Job Object `CPU_RATE_CONTROL_HARD_CAP` (**HARD %**) + EcoQoS + `PROCESS_MODE_BACKGROUND_BEGIN` | `taskpolicy -b`/QoS bg → E-core confinement (HARD deprioritize); % via duty-cycle (SOFT — say "approximate" in the UI) | `cpu.max` (**HARD %**) + `SCHED_IDLE` |
| RAM | Self-meter vs LMKD; mmap weights (SOFT; LMKD kill = blunt HARD) | Jetsam (fixed) | Job Object `LIMIT_JOB_MEMORY` (**HARD**) | RSS self-meter + mmap (SOFT; jetsam ledger limits exist but no public API) | `memory.max` + `memory.high` ≈ 90% of max (**HARD**) |
| Disk I/O / space | App-private quota; I/O SOFT | App container | Job Object IO rate control (**HARD**); space SOFT | I/O throttled with bg QoS; space SOFT | `io.max` (**HARD**); project quotas |
| Network | Token bucket; honor metered/Data Saver (SOFT) | Token bucket | Job Object net-rate (**HARD, egress only** — ingress weight downloads must self-pace) | Token bucket (pf+dummynet per-uid capping exists as a root option, best-effort) | `tc`/cake or fq pacing (**HARD**); token bucket fallback |
| Schedule/battery | WorkManager constraints (**HARD**); FGS ≤6h/24h ceiling (**HARD**) | BGProcessingTask — OS decides, minutes/day (**HARD and tiny**) | Agent scheduler + AC/idle conditions | Agent scheduler + launchd | systemd timers + `ConditionACPower` |
| Thermal | `getThermalHeadroom` (NaN fallback heuristics), throttle at ~0.9 | `thermalState` | No good public API — freq/power heuristics (SOFT) | `thermalState` + IOPS power info | `/sys/class/thermal` + power_supply |
| Yield-on-use | Pause on `isInteractive` + OS bg-demotion backstop | Moot (suspended) | `GetLastInputInfo` + fullscreen detect (`SHQueryUserNotificationState`); pause ≤500 ms | `CGEventSourceSecondsSinceLastEventType`; QoS backstop | logind IdleHint / ext-idle-notify; mostly headless |

Three rules the verified research forces: (1) **priority backstops do not govern memory bandwidth, swap pressure, or thermal/turbo budget** — an idle-priority worker streaming weights can still lag the owner's game **[H]** — so default worker concurrency is capped at (physical cores − 2), thermal headroom is a first-class throttle input, and the default policy halves RAM footprint when the user is active; (2) **the heaviest flow is ingress** (weight downloads), which Windows Job Objects cannot cap — ingress pacing is always agent-side; (3) yield does not merely deprioritize — it **suspends inference at a token boundary (<1 s) and drops the working set to mmap-reclaimable state**.

---

## 6. Attestation & verification — honest limits

**What we cannot have:** datacenter-style TEE attestation of consumer devices. Owners are anonymous, can be root, and consumer GPUs have no usable TEE path. Anyone claiming cheap trustless verified inference on consumer hardware today is selling hype.

**What we build:** (1) platform attestation where it exists — Play Integrity + hardware keystore (Android; also excludes rooted devices from sensitive MPC pools), App Attest (iOS buyer app), opt-in TPM 2.0 quotes on Tier-D/H with a payout bonus; ironically strongest where supply value is lowest. (2) **Verification by redundancy — the actual workhorse:** maliciously/covert-secure MPC protocols (a lying node is *caught*), with placement rules that never put >1 share of a secret in one household/ASN — this is also Tier-M's one genuine architectural advantage (many independent low-trust parties = collusion resistance); canary jobs (5–10% pre-solved probes, indistinguishable from real work); deterministic re-execution spot checks (greedy decoding, pinned engine+quant+ISA cohorts — cross-GPU-vendor float nondeterminism means same-cohort comparison only); 3–5% cross-node duplication; a probation→trust reputation ladder with slashing of accrued unpaid earnings and KYC-lite at payout threshold to make Sybil re-entry costly. This is industry-standard probabilistic policing, **not "verified compute" — sales copy must not claim otherwise**.

**Confidentiality, stated plainly [H]:** the MPC tier genuinely protects customer data (each device holds information-theoretic noise). The LLM tier does **not** — a host running inference sees prompts, activations, and KV cache, and no container runtime on the honest side fixes a malicious host reading its own RAM. Sell tier 2 explicitly as "not for sensitive prompts," in the ToS and the customer console.

---

## 7. MoE feasibility — the numbers that killed the original pitch

All model figures verified against live HuggingFace `config.json` (2026-07-03).

**Expert sizes (SwiGLU: 3 × d_model × d_ff params/expert/layer, realistic ~4.5-bit quant):**

| Model | d_model | d_ff (expert) | Params/expert | ~4.5-bit size | Experts, layout |
|---|---|---|---|---|---|
| Mixtral 8×7B | 4096 | 14336 | 176 M | **~99 MB** | 8/layer, top-2, 32 L |
| DeepSeek-V3/R1 | 7168 | 2048 | 44 M | **~25 MB** | 256 routed + 1 shared, top-8, 58 MoE L |
| GLM-4.5 | 5120 | 1536 | 24 M | **~13 MB** | 160 + 1 shared, top-8, 92 L |
| Qwen3-30B-A3B | 2048 | 768 | 4.7 M | **~2.7 MB** | 128, top-8, 48 L |

**What the arithmetic says:**

- **Storage/compute per expert is trivial; network is not.** One DeepSeek expert forward pass costs **~1–3 ms** on a 2022 phone or Pi 5 (memory-bound: ~25 MB streamed at 10–20 GB/s) — 1–2 orders of magnitude cheaper than a 20–80 ms WAN RTT. Network:compute ≈ 50–100:1. The phone is a bad expert server not because it is slow but because its pipe is thin and far away. **[H, corrected arithmetic]**
- **A 2 GB phone covers ~0.5% of DeepSeek-V3's 14,906 expert slots**; a single fine-grained MoE layer (257 experts ≈ 6.4 GB) exceeds the budget tier entirely. Only expert-parallel sharding or Mixtral-style coarse layer blocks are even structurally possible. **[H]**
- **Interactive serving: infeasible from consumer swarms.** A ~10-stage phone pipeline over residential WAN has a **250–500 ms/token pure-network floor (2–4 tok/s ceiling)**; adding ~100–170 ms of per-token device compute yields ~1.5–3 tok/s end-to-end — consistent with Petals' published 1–6 tok/s on much beefier GPU nodes. Availability compounds: at 95% per-device session reliability a 10-stage chain survives with p ≈ 0.60. Expert-parallel is worse for interactive: each token waits on the slowest of 8 WAN round-trips, ~58 times. **[H]**
- **Batch expert hosting: economically dead on phones.** A 20 Mbps uplink caps a phone at ~174 DeepSeek expert-calls/s ≈ 0.38 token-equivalents/s of MoE-FFN work → **~$0.49/month gross at $0.50/M output tokens, ~$1.95 at $2/M** — before the platform take, electricity, and data caps. This is the single most load-bearing negative result in the research. **[M on prices, H on the arithmetic]**
- **KV cache forces a stable stateful core.** Pipeline stages are stateful (Mixtral: ~134 MB KV per 4-layer stage at 8k ctx; migration at 20 Mbps ≈ 54 s — unusable mid-session); MoE experts are stateless but attention/router/KV must live on reliable nodes. Flaky phones can at best hang off a stable core as stateless offload — and per the economics above, shouldn't.
- **Per-token activation traffic is small** (8–16 KB fp16 per hop; ~0.7–1.3 Mbps at 10 tok/s single-stream) — so the binding variable is **latency × jitter × churn**, not per-token bandwidth; bandwidth binds during prefill, weight shipping, and multi-stream serving.

**What survives, and is the product:** (1) phones as whole-small-model batch workers (job-in/result-out, no per-token WAN hops, churn-tolerant); (2) large/MoE models confined to Tier-H on symmetric fiber, whole-node or pipeline-parallel, sold as cheap latency-tolerant batch; (3) MPC batch across the whole fleet. Delete "phones host MoE experts and activations flow between hosts" from the deck.

---

## 8. Install UX — steps to first payout

**Provider (device owner):**

- **Tier-D Windows (flagship funnel — target ≤4 clicks, ≤10 min to first earning cent):** download EV-signed installer (SmartScreen-clean; AV whitelisting workstream running from day 1) → one screen: Eco/Balanced/Max slider mapping to caps, schedule defaults "only when idle," Advanced overrides → sign in with email or QR-pair from phone → 3-minute benchmark (canary model ~500 MB; measures tok/s, memstream, uplink) → **honest earnings estimate shown before commitment** ("this PC: ~$4–9/month at current demand" — under-promise; earnings disappointment is the category's #1 churn and review-bomb driver) → first probation-grade job within 10 minutes, visible cents same day, payout at $5 via PayPal/gift card/ACH. No wallet, no crypto vocabulary in the default path.
- **Tier-M Android:** install (Play, or guided APK sideload with SHA display) → ≤3 permission screens (FGS notification yes; battery-optimization exemption **not** requested — we live inside WorkManager) → "work while charging at night" toggle (default on) → blunt in-app expectation: **"phones typically earn cents per day; your PC earns dollars."** The mobile app's real jobs: fleet dashboard/payout, and a QR-driven viral path to the desktop installer.
- **Tier-H:** `curl -fsSL get.pocketcloud.dev | sh` (inspectable) or a `podman run` one-liner with a claim token; prints a URL to claim the node; GPU auto-detected; caps default 80% + `SCHED_IDLE`.
- **iOS:** buyer/dashboard app only. Never promise supply.

**Consumer (compute buyer):** sign up on web console → API key → submit (a) MPC batch jobs as circuit + secret-shared inputs (shares generated client-side; the platform never sees plaintext), or (b) batch inference jobs (embeddings/completions against the vetted model catalog, hour-scale SLA tiers) → per-job cost estimate up front (fuel-denominated for MPC — re-derivable in disputes) → results + verification report (redundancy level, canary pass rate) → the console states in plain text which tier is confidential (MPC) and which is not (LLM).

---

## 9. First 90 days

**Days 0–30 — skeleton + the only fleet that pays:**
- Shared Rust core v0: registration, capability vector, heartbeat, job lease, result submit, canary verification. Postgres + a boring queue. No blockchain.
- Tier-H/Linux agent (systemd slice, cgroups caps, llama.cpp CUDA/CPU) — internal dogfood fleet of 20–50 nodes.
- CAS pipeline v0: GGUF vetting (fuzzer-hardened loader in CI), TUF root ceremony (offline keys), manifest signing + transparency log, chunked CDN delivery, local CAS with LRU.
- wasmtime MPC harness with fuel metering, first shard type end-to-end on two platforms; pick the MPC protocol library (maliciously/covert-secure).
- Start the long-lead-time items day 1: EV cert procurement (weeks), macOS notarization pipeline, AV-vendor whitelisting outreach (months).

**Days 31–60 — Tier-D + first paying workload:**
- Windows agent (service + Job Objects + EcoQoS + yield-on-use + A/B updater); macOS agent (notarized, QoS + duty-cycle).
- Installer funnel per §8 including benchmark + honest earnings estimator.
- **First sellable product: batch inference API (embeddings + small-model completions, hour-scale SLA) on Tier-H/D-GPU** — no per-token WAN hops, matches the fleet we actually have. Redundancy/canary verification live; PSP payout rails in sandbox.
- Staged-rollout update system exercised weekly on the dogfood fleet.

**Days 61–90 — Tier-M + hardening:**
- Android app: `dataSync` FGS worker, WorkManager gating, llama.cpp `.so` + wasmtime module, thermal governor; Play submission **and** sideload channel in parallel.
- Play Integrity + TPM-quote ingestion into the reputation ladder.
- External security review of the artifact-parsing path; GGUF fuzz corpus; incident runbooks (key compromise, fleet halt).

**Scheduled decision gate (month 4, written into the plan now):** if MPC demand has not materialized, **demote Tier-M to dashboard + referral app.** Mobile spend is a reversible bet, not a sunk identity.

**Explicitly NOT in 90 days:** any container-runtime feature work, interactive distributed LLM serving, per-expert WAN sharding, iOS supply, customer-code tier, crypto payouts.

---

## 10. Open risks — the honest register

| # | Risk | Severity | Confidence / basis |
|---|---|---|---|
| 1 | **Batch-inference margin may not close.** Datacenter GPU spot prices keep falling; our unit economics = free-ish hardware minus paid verification overhead (3–10% duplication + canaries) minus payouts. Deserves its own financial review. | Existential to tier 2 | **[L–M]** — the design's own admission |
| 2 | **Play policy fragility.** The category's precedent (Honeygain) lives off-Play; Google's developer-identity rules tighten sideloading yearly. Tier-M's channel can narrow through no fault of ours. | High for mobile supply | **[H on precedent, M on trajectory]** |
| 3 | **AV/EDR reputation is a permanent tax.** Earn-from-idle apps get heuristically flagged; every agent update re-rolls the dice. Budgeted at ~1 person-day/week; could be worse in launch quarter. | Medium, chronic | **[H]** |
| 4 | **Verification is probabilistic, not proof.** Same-cohort determinism + canaries catches most fraud; a sophisticated cheater is caught only by canary coverage. Never market "verified compute." | Medium | **[H]** |
| 5 | **Tier-2 confidentiality is unsolved without TEEs.** Hosts see prompts/activations. ToS and console must say so; one leaked-prompt press cycle could poison the marketplace. | High reputational | **[H]** |
| 6 | **MPC demand is unproven.** The tier that justifies phones and carries the confidentiality story has no validated buyer yet. Hence the month-4 gate. | High for Tier-M | **[M]** |
| 7 | **Scheduler complexity is under-budgeted.** Lease TTLs, checkpointing, cold/warm routing, and cohort pinning across heterogeneous failure semantics is the hardest, least glamorous engineering in the plan. | Medium | **[M]** |
| 8 | **Residential ISP ToS.** Reselling connection capacity from residential lines is prohibited by many AUPs — the legal soft spot the proxyware category lives in. Needs counsel review before launch. | Medium legal | **[H that the clauses exist, M on enforcement risk]** |
| 9 | **Customer-code tier is a promissory note.** KVM/nested-virt availability across homelab hardware is inconsistent; the gVisor/Firecracker-eligible fleet will be smaller than marketing wants. | Low now, medium later | **[M]** |
| 10 | **Engine treadmill.** llama.cpp has no stable ABI; new architectures lag upstream days-to-weeks and mobile engine updates ride store review. We own a fork-and-pin discipline forever. | Low-medium, chronic | **[H]** |

---

*Prepared 2026-07-03 from verified device-landscape, runtime, sandboxing, resource-governance, and MoE-feasibility research plus a judged three-way design competition (Tiered Fleet selected; SISA and WASM-Everywhere grafts incorporated).*

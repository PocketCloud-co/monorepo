# Pocket Cloud

A platform for everyday people to rent out the idle compute, storage, and
networking of devices they already own — and for workload owners (especially
AI teams) to run sensitive batch workloads on that fabric **without trusting
any individual device**. Data is cryptographically split so each device works
on one meaningless piece of a distributed workload: no device, and no
colluding subset below the job's threshold, can read, reproduce, or
undetectably tamper with it.

| | |
|---|---|
| **Product Requirements Document** | [`docs/PRD.md`](docs/PRD.md) — vision, personas, functional requirements, security model, architecture, scaling plan, economics + metering, legal posture, rollout phases, risks, decision records, LLM-serving appendix |
| **Engineering Standards** | [`docs/ENGINEERING-STANDARDS.md`](docs/ENGINEERING-STANDARDS.md) — the binding canon: Definition of Done, CI gate sequence, testing policy, security engineering, agent execution contract |
| **Roadmap** | [`docs/ROADMAP.md`](docs/ROADMAP.md) — milestones M0–M5, deliverables, exit criteria |
| **MVP Plan** | [`docs/MVP-PLAN.md`](docs/MVP-PLAN.md) — binding execution order: MVP definition, waves 0–4 with task IDs, scale-out backlog |
| **Seam Standard** | [`docs/SEAMS.md`](docs/SEAMS.md) — durability/metrics/observability rules for every cross-component boundary; seam registry; the Cloudflare→Supabase metering reference design |
| **Device Runtime** | [`docs/DEVICE-RUNTIME.md`](docs/DEVICE-RUNTIME.md) — the runc answer, honest device-class supply matrix, tiered fleet architecture (M/D/H/W), artifact delivery, resource-cap spec |
| **North Star Strategy** | [`docs/STRATEGY-NORTH-STAR.md`](docs/STRATEGY-NORTH-STAR.md) — the embedded home-edge play (DR-09): OEM/ISP partner sequencing, competitive clock vs hyperscalers, security-bundle option |
| **Business Analysis** | [`docs/BUSINESS-ANALYSIS.md`](docs/BUSINESS-ANALYSIS.md) — first-principles + MBA pass: where value concentrates, license-vs-marketplace unit economics, five forces, moat ranking, refinements R1–R7, kill gates, queued founder decisions |
| **Feasibility & GTM** | [`docs/FEASIBILITY-GTM.md`](docs/FEASIBILITY-GTM.md) — cited evidence review (Petals/PUMA/Marill/INTELLECT-1/Parallax), competitor table, feasibility verdicts per workload class, GTM sequence, the honest hyperscaler answer |
| **Feature PRDs & task trackers** | [`docs/prds/`](docs/prds/) — nine feature areas (FT-00…FT-08), each with a self-contained PRD and a task tracker (IDs, dependencies, acceptance criteria) built for delegation to subagents |
| **Proof of Concept** | [`poc/`](poc/) — runnable Node.js (zero dependencies) implementation of the core protocol: additive secret sharing, SPDZ-style MACs, Beaver-triple MPC, coordinator + host agents over HTTP, malicious-host detection with quarantine and self-healing re-dispatch, deterministic metering with a balancing ledger |
| **CI** | [`.github/workflows/pocketcloud-ci.yml`](../.github/workflows/pocketcloud-ci.yml) — full test suite + demo smoke + framework integrity on every PR |

## Quick start

```bash
cd pocketcloud/poc
node demo.js                                      # 3-act end-to-end demo
node --test test/crypto.test.js test/e2e.test.js  # 15 protocol tests
```

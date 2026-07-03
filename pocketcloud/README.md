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
| **Product Requirements Document** | [`docs/PRD.md`](docs/PRD.md) — vision, personas, functional requirements, security model, architecture, scaling plan, economics, legal posture, rollout phases, risks, decision records |
| **Proof of Concept** | [`poc/`](poc/) — runnable Node.js (zero dependencies) implementation of the core protocol: additive secret sharing, SPDZ-style MACs, Beaver-triple MPC, coordinator + host agents over HTTP, malicious-host detection with quarantine and self-healing re-dispatch |

## Quick start

```bash
cd pocketcloud/poc
node demo.js                                      # 3-act end-to-end demo
node --test test/crypto.test.js test/e2e.test.js  # 15 protocol tests
```

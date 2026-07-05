# Pocket Cloud — Proof of Concept

A runnable, **zero-dependency** (Node.js ≥ 18) demonstration of the core
Pocket Cloud claim from [`../docs/PRD.md`](../docs/PRD.md):

> Untrusted edge devices can do useful computation on your data while each
> device holds only information-theoretic noise — and any device that
> tampers with its piece of the work is caught before you ever see a result.

## What it implements

| Piece | Where | PRD ref |
|---|---|---|
| Prime-field arithmetic (𝔽_p, p = 2⁶¹−1) | `src/crypto/field.js` | §7.2 |
| Fixed-point encoding of reals | `src/crypto/encoding.js` | §7.2 |
| Additive secret sharing (any n−1 shares = uniform noise) | `src/crypto/secret-sharing.js` | §7.2 |
| SPDZ-style information-theoretic MACs | `src/crypto/secret-sharing.js` | §7.2, G2 |
| Beaver-triple multiplication (secret × secret) | `src/crypto/beaver.js` | §6.4 T3 |
| Coordinator: registry, LRU placement, dealer, verifier, quarantine + re-dispatch | `src/coordinator/coordinator.js` | §8.1–8.2 |
| Metering: deterministic work units, upfront quote, pay-only-on-verified receipts, double-entry ledger | `src/coordinator/coordinator.js` (`WORK_UNITS`, `/jobs/estimate`, `/ledger`) | §9.4, F17–F18 |
| Host agent: computes kernels **on shares only**, stateless, optional tamper mode | `src/worker/worker.js` | §5, F10 |
| Customer SDK | `src/client/client.js` | F1/F4 |

Two workload templates run end-to-end over HTTP:

1. **`matvec`** (T1 — private inference): public model matrix W, **private**
   input x. Linear algebra on additive shares needs zero worker-to-worker
   interaction: each host computes W·xᵢ on its noise-share; the shares sum to
   W·x. This is the primitive under embeddings and NN linear layers.
2. **`private-dot`** (T3 — private similarity): dot product of **two private
   vectors** using Beaver triples — two online rounds, with the opened
   masking values themselves MAC-checked (a mis-opened value is equivalent to
   substituting the input, and is caught at that step).

Integrity everywhere: every secret is dealt alongside a sharing of α·secret
under a per-job random MAC key α. A host that perturbs its result share by Δ
must also perturb its MAC share by α·Δ — without knowing α. Catch
probability per corrupted value: 1 − 2⁻⁶¹.

## Run it

```bash
cd pocketcloud/poc

node demo.js   # the full 4-act demo (see below)
npm test       # 19 unit + end-to-end protocol tests
```

The demo:

1. **Private inference** — a model layer is applied to a private input across
   3 hosts; result matches plaintext to fixed-point precision; the demo
   prints the literal noise a host sees instead of your data — and the exact
   price quote, computed *before* dispatch.
2. **Private similarity** — two private vectors are multiplied without either
   ever existing on any host.
3. **Malicious host** — `host-MALLORY` joins and corrupts its result share.
   The MAC check rejects the attempt, the coordinator quarantines it and
   re-dispatches to fresh hosts, and the job completes correctly anyway.
4. **Metering** — per-host earnings ledger: verified work pays (60% to the
   host), the rejected attempt bills the customer nothing, MALLORY's receipt
   exists but is worth zero, and the double-entry invariant (customer billed
   = host payouts + platform take) balances to the millicredit.

### Run it as actual separate processes

```bash
PORT=4600 node src/coordinator/main.js
WORKER_ID=w1 PORT=4601 COORDINATOR_URL=http://127.0.0.1:4600 node src/worker/main.js
WORKER_ID=w2 PORT=4602 COORDINATOR_URL=http://127.0.0.1:4600 node src/worker/main.js
WORKER_ID=w3 PORT=4603 COORDINATOR_URL=http://127.0.0.1:4600 node src/worker/main.js
# optionally: TAMPER=1 WORKER_ID=evil PORT=4604 ... node src/worker/main.js

curl -s http://127.0.0.1:4600/jobs -H 'content-type: application/json' -d '{
  "template": "matvec",
  "matrix": [[0.25, -0.5, 1.0], [1.5, 0.125, -0.25]],
  "input": [3.25, -1.5, 2.0],
  "n": 3
}'
```

## Honest scope notes (what a PoC is and is not)

- This is the PRD's **managed mode**: the coordinator deals shares and
  verifies, so it sees plaintext at the edges of a job. **Strict mode**
  (dealing/verifying inside the customer SDK) uses the *same protocol* with
  the dealer code moved client-side — Phase 2 work, not a research risk.
- Beaver triples come from a trusted dealer (the coordinator). Distributed
  triple generation replaces this in Phase 2+ (PRD §8.6).
- Transport is plain HTTP on localhost; production is mTLS with per-device
  certificates and share bundles sealed to worker keys (PRD §7.2).
- Quarantine takes out the whole failed attempt; production uses redundant
  execution (r replicas per share index) to pinpoint the cheater (PRD §7.1).
- The security claim is exactly the PRD's §5.1 statement: zero information
  below the collusion threshold, never "unhackable."

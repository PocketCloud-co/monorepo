# SPEC-003 — Customer Job API

| | |
|---|---|
| Version | v0 (PoC-exact; v1 with CP-001 adds auth, pools, async status, strict-mode bundles) |
| Producer | FT-02 | Consumers | FT-04 (SDKs), FT-05 (consoles) |
| Reference impl | `poc/src/coordinator/coordinator.js`, `poc/src/client/client.js` |

## 1. Submit
`POST /jobs` →
```json
{ "template": "matvec" | "private-dot",
  "n": 3,                  // share count (default 3)
  "maxAttempts": 3,        // re-dispatch budget (default 3)
  // matvec:      "matrix": [[float]], "input": [float]
  // private-dot: "x": [float], "y": [float]
}
```
200 (verified) →
```json
{ "ok": true, "jobId": "job-<seq>",
  "result": [float] | float,
  "attempts": [ { "attempt": 1, "workers": [id], "verified": true } ],
  "billing": { "unitsPerWorker": int, "workersPaid": n,
               "customerMillicredits": int, "perWorkerMillicredits": int,
               "rejectedAttemptsNotBilled": int } }
```
502 (exhausted attempts) → `{ ok:false, jobId, error, attempts, billing:{customerMillicredits:0,...} }`.

**Invariants (contract-tested):** a non-verified result is never returned;
`rejectedAttemptsNotBilled` attempts contribute 0 to `customerMillicredits`;
for a single-attempt success, billing equals the §2 estimate exactly.

## 2. Estimate (quote before dispatch)
`POST /jobs/estimate` (same shape minus data-dependent execution) →
`{ template, n, unitsPerWorker, customerMillicredits, perWorkerMillicredits }`.
Work units are pure functions of job shape (PRD §9.4): matvec = 2·rows·cols;
private-dot = 12·len. New templates MUST publish their unit function here.

## 3. Ledger & fleet (v0 — admin/console surface)
- `GET /ledger` → `{ receipts:[SPEC-004], payoutsByWorker, customerBilledMillicredits, workerPayoutMillicredits, platformMillicredits, invariantHolds }`.
- `GET /workers` → `{ workers: [ { id, url, quarantined, quarantineReason? } ] }`.

## 4. v1 additions (`TBD`, sized but not final)
Org-scoped API keys + pool targeting (CP-014/SDK-010: `pool` field;
private-pool credentials cannot place public work); async job status +
webhooks (F6); strict-mode sealed share bundles replacing plaintext inputs
(SDK-004); residency/privacy params `(t, r, residency)` (SDK-006);
idempotency tokens (SDK-003).

## Change log
- 2026-07-04: v0 extracted from PoC.

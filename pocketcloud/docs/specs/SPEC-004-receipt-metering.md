# SPEC-004 — Receipt & Metering Schema

| | |
|---|---|
| Version | v0 (PoC-exact; v1 adds signatures, pool_id, R2 log entry format per SEAMS §4) |
| Producer | FT-02 (emission) + FT-05 (ingestion) — jointly owned | Consumers | FT-08 (metrics), consoles |
| Reference impl | `poc/src/coordinator/coordinator.js` (ledger) |

## 1. Receipt (one per worker per attempt)
```json
{ "receiptId": int,          // v1: ULID
  "jobId": "job-<seq>",
  "attempt": int,
  "workerId": string,
  "template": string,
  "units": int,               // deterministic, from SPEC-003 §2 unit functions
  "verified": bool,
  "payable": bool,            // == verified; NEVER independently settable
  "workerMillicredits": int } // = payable ? units * 600 : 0
```

## 2. Denominations (v0 constants; v1 = FT-05 pricing config, MB-003)
- Customer: **1000 millicredits / unit / worker** on verified attempts only.
- Worker payout: **600 millicredits / unit** on payable receipts.
- Platform: the remainder (400/unit) — implicit, never stored separately.

## 3. The invariant (halt-the-world class)
`customerBilled == Σ workerPayout + platformTotal` over all receipts, always.
An imbalance is a P0: payouts freeze, humans paged (MB-R1). Implementations
MUST expose `invariantHolds` and MUST NOT auto-correct an imbalance.

## 4. Billing rules (contract-tested)
- Rejected attempts: receipt exists, `payable:false`, worth 0, customer
  billed 0 for that attempt.
- Duplicate ingestion: idempotent on `receiptId` (`ON CONFLICT DO NOTHING`).
- Quote == bill for single-attempt verified jobs.

## 5. v1 additions (`TBD(CP-013/MB-002)`)
`workerSig` (device key over receipt hash), `verifierSig` (countersign),
`poolId` (private pools; payable may be true with payout disabled per pool —
license mode, MB-014), hash-chain fields for the R2 append-only log
(prevHash, chainSeq) per SEAMS §4, rev-share party lines (DR-09 OEM splits).

## Change log
- 2026-07-04: v0 extracted from PoC.

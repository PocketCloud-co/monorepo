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

**Scope honesty:** each leg must be computed from an independent source so
the check can actually fail. v0 (PoC) computes the platform leg from
`units × rate` independently of the stored `workerMillicredits`, so it
detects rate/record inconsistencies — but full double-entry with
independently-sourced legs (billing events vs receipt log vs payout rows)
is MB-001's job; v0's check is necessary, not sufficient.

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

## 6. Durable-format hedges (BINDING on v1 — decided now, before CP-013
builds the chain; per one-way-door audit 2026-07-05, finding 1)

The receipt log is an append-only financial source of truth: its format is
a one-way door the moment the first production receipt is appended.
Therefore v1 MUST include, from the first appended entry:

1. **`schemaVersion`** on every receipt — the chain will outlive the schema.
2. **Canonical serialization for chain hashing**: the chain-hash input is
   the receipt in JCS canonical JSON (RFC 8785). Never hash ad-hoc
   serializations — two implementations must produce identical chain hashes.
3. **Independent re-priceability**: every receipt carries
   `priceConfigVersion` (referencing MB-003's versioned pricing config) AND
   an explicit platform-take line — nothing about a historical receipt's
   money may be "implicit" once denominations become configurable.
4. **Cross-partition anchoring**: chains are partitioned by day/cell; each
   partition's head hash is (a) written to Postgres and (b) embedded in the
   next partition's genesis entry, so the full history is one verifiable
   chain, not islands.

## Change log
- 2026-07-04: v0 extracted from PoC.

# R2 → Postgres metering seam (CP-013 / MB-013)

The reference implementation of the SEAMS §4 standard for the one seam the
business cannot get wrong: moving priced, sealed receipts from the compute
fabric into the durable ledger **without ever losing money**. The R2
hash-chained log is the financial source of truth; Postgres (`pc.receipts`) is
a *projection* of it. This module is how "Supabase down = lag, never loss"
becomes real and tested rather than aspirational.

## The pipeline

```
verifier ──► producer ──►  R2 log  ──► queue ──► consumer ──► Postgres projection
             (CP-013)   (source of    (at-least  (MB-013)     (pc.receipts)
                         truth, S1)    -once)       │
                                                    └──► reconcile / rebuild ◄── R2 log
```

1. **Producer** (`src/producer.js`) — for each receipt: **(1)** append to the R2
   log (durable write-ahead, **S1**), **then (2)** enqueue. A crash between the
   two loses nothing: reconciliation re-enqueues from the log.
2. **Queue** (`src/queue.js`) — at-least-once with bounded retry + DLQ (**S2/S3**).
   A poison message dead-letters with an alert, never silently drops.
3. **Consumer** (`src/consumer.js`) — idempotently upserts into the projection
   (`ON CONFLICT (receipt_id) DO NOTHING`). Duplicate deliveries → one row
   (**S2**). If the projection is down the upsert throws, the queue retries, and
   the failure mode is **lag, not loss** (**S4**).
4. **Reconcile / rebuild** (`src/reconcile.js`) — compares the log to the
   projection (go/no-go for payouts, **S6**); rebuilds the projection from the R2
   log *alone* (the Postgres-loss drill, **S8**); the freshness watermark refuses
   payouts on a stale ledger (**S5**).

## Source of truth: the hash chain

`src/r2log.js` is an append-only, hash-chained receipt log. Within a partition
(`cell/yyyy-mm-dd`) each entry's `prevHash` is the prior entry's `hash`;
partitions are **anchored** (a partition's genesis `prevHash` = the prior
partition's head) so the whole history is one verifiable chain, not islands.
`verifyChain()` detects any reorder, gap, or in-place edit. Canonical hashing is
shared with the ledger (RFC 8785 JCS subset) so hashes are cross-component
identical. Two interchangeable backends — `inMemoryR2Log()` and
`filesystemR2Log(dir)` (a faithful NDJSON stand-in for R2) — behind one
interface; production swaps in an R2 client with the same shape.

## Projections

Both satisfy the same contract (`upsertReceipt`/`has`/`count`/`summary`):

- `src/projection-memory.js` — in-memory, for the portable seam tests; enforces
  the same double-entry + payable invariants the SQL CHECKs do.
- `src/projection-postgres.js` — writes the real `pc.receipts` schema
  (`platform/supabase`). Every receipt value is a bound parameter (`$1..$n`),
  never concatenated into SQL — no injection surface (Standards §4).

## Test

```bash
node --test 'test/*.test.js'      # portable seam invariants (S1-S6, tamper, rebuild)
bash tests/run-pg-integration.sh  # the same path vs an ephemeral REAL Postgres
```

`test/seam.test.js` covers S1 durable write-ahead, S2 idempotent at-least-once,
S3 DLQ + alert, S4 lag-not-loss under a simulated outage, S5 stale-watermark
payout guard, S6 reconciliation, rebuild-from-R2, cross-partition anchoring, and
chain-tamper detection.

`tests/run-pg-integration.sh` stands up an ephemeral Postgres 16, applies the
`platform/supabase` schemas, and runs `test/pg-integration.mjs`: produce →
consume into real `pc.receipts`, idempotent re-delivery (`ON CONFLICT` holds),
the `ledger_summary` aggregate invariant computed by real SQL, reconcile
converged, then truncate + rebuild-from-R2. Zero external services. On a root
dev box it re-execs as `RUN_AS_USER` (default `ubuntu`); CI runs it directly.

## Production swap-ins (interfaces unchanged)

- R2 log → Cloudflare R2 client (+ Durable Object transactional storage for the
  write-ahead in step 1).
- Queue → Cloudflare Queues.
- `postgresProjection({ query })` → a real `pg`/Supabase driver's parameterized
  `query`.
- Reconciliation updates `pc.ledger_watermark`; payout/invoice runs check
  `canSettle()` before releasing money.

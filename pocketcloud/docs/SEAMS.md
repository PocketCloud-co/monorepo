# Pocket Cloud — Seam Standard: Durability, Metrics, Observability at Every Boundary

> **Status: BINDING** (extension of `ENGINEERING-STANDARDS.md`; referenced as
> Standards §8). A "seam" is any place where data or state crosses a
> component, vendor, or failure-domain boundary. Seams are where distributed
> systems actually break, so every seam must implement the pattern below and
> register in the Seam Registry before its first production merge.

## 1. Hosting decision this standard is built around (DR-PF-03)

- **Cloudflare** runs the fabric data plane: Workers, Durable Objects (cell
  schedulers, session/relay state, verification state machines), Queues, R2
  (share bundles + append-only logs), agent connectivity.
- **Supabase Postgres** holds business records: ledger, registry projection,
  reputation, billing.
- **Vercel** serves the consoles/marketing frontend — deliberately a third
  failure domain: Cloudflare down ⇒ pages still up; Vercel down ⇒ fabric
  still running and metering.

Consequence: the metering path crosses vendors (Cloudflare → Supabase), so it
is the reference implementation of this standard (§4).

## 2. The universal seam pattern (rules S1–S7)

Every seam MUST implement all seven. PRs adding a seam cite this section and
add a Seam Registry row.

- **S1 — Durable write-ahead at the producer.** The producer persists the
  event to durable storage it controls (DO storage / R2 / local disk WAL on
  agents) *before* acknowledging or forwarding. An event that matters is
  never only in memory or only in flight.
- **S2 — At-least-once delivery + idempotent consumer.** Transport may
  duplicate; consumers dedupe on a natural key (receiptId, jobId+attempt,
  frameSeq). Exactly-once is achieved at the *consumer*, never assumed of the
  transport.
- **S3 — Bounded retry with backoff + DLQ.** Retries are capped and jittered;
  poison messages land in a dead-letter queue with an alert. A DLQ entry is a
  defect to triage, never silently discarded.
- **S4 — Defined degraded mode: lag, not loss.** Every seam documents what
  happens when the downstream is unavailable. The invariant across all seams:
  **work already performed is never lost and never becomes unbillable/**
  **unpayable; the failure mode is staleness, and staleness is measured.**
- **S5 — Watermark, lag, and DLQ metrics with budget alerts.** Every seam
  exports: producer high-watermark, consumer high-watermark, lag (count and
  age), retry rate, DLQ depth. Alerts fire on lag-age budget burn (OO-003),
  not on individual errors.
- **S6 — Continuous reconciliation.** A scheduled job compares the durable
  source-of-truth log against the downstream projection (counts + hash
  chains) and alerts on divergence. Reconciliation is how we *know* S1–S4
  worked, rather than hoping.
- **S7 — Explicit backpressure policy.** When buffers grow past thresholds:
  what slows down (new job intake), what never stops (result collection,
  receipt writing), and at what depth humans are paged.

## 3. Seam Registry

| # | Seam (producer → consumer) | Transport | S1 durability | Idempotency key | Degraded mode (downstream down) | Owning tasks |
|---|---|---|---|---|---|---|
| 1 | Verifier receipts → Ledger (Cloudflare → Supabase) | CF Queue | DO txn storage + R2 append-only receipt log (hash-chained) | receiptId | queue buffers; ledger lags; payouts/invoices pause on stale watermark; rebuildable from R2 log | CP-013, MB-002, MB-013 |
| 2 | SDK → Job API (customer → Cloudflare) | HTTPS | client-side job journal until acked | submission token | client retries safely; duplicate submits = one job one bill | SDK-003 |
| 3 | Dealer/scheduler → Agent dispatch | pull via router | bundle in R2 until result or expiry | jobId+shareIndex+attempt | agents idle-poll; jobs queue; deadline-aware re-place | CP-006 |
| 4 | Agent results → Verifier | HTTPS push to router | agent local WAL until acked | jobId+shareIndex+attempt+workerId | agent retries across restarts (HA-009); duplicate results deduped | HA-009, CP-006 |
| 5 | Ledger → Stripe payouts (Supabase → Stripe) | Stripe API | payout-run rows in Postgres before API calls | payout item id (Stripe idempotency key) | payouts delayed, never doubled; retry queue; vendor-status runbook | MB-005 |
| 6 | Canary verdicts → Fraud/Reputation | CF Queue | verdict log in R2 | canaryJobId | scoring lags; placement uses last-known reputation | OO-004, MB-008 |
| 7 | Relay frames → Session metering | DO-local counters | DO storage checkpoint every N frames | sessionId+frameSeq range | metering checkpoint lags ≤ N frames; session continues | LS-004, LS-010 |
| 8 | Services/agents → Telemetry backend | OTLP batched | bounded local buffer, drop-oldest **metrics** only; **audit/security events use seam pattern in full** (never dropped) | event id | dashboards stale; out-of-band health probes still up (OO-R4) | OO-001, OO-010 |
| 9 | Artifact publisher → Agent caches | R2 pull | R2 is the durable store; manifests signed | content hash | agents serve cached artifacts; new pins wait | HA-008, LS-002 |
| 10 | Registry writes (enrollment) → Postgres projection | CF Queue | enrollment event log in R2 | deviceId+eventSeq | new enrollments queue; existing fleet unaffected (placement reads DO-cached registry view) | CP-002, CP-013 |

## 4. Reference design — the metering seam (answers "how does Cloudflare report metering back, and what if Supabase is down?")

**Normal flow:**

1. The verifier (Durable Object) finishes an attempt. In ONE DO transaction
   it: marks the attempt verified/rejected, writes the receipt to its
   storage, and enqueues the receipt to the `receipts` Cloudflare Queue.
   (S1: the receipt exists durably in the same failure domain as the
   decision that created it.)
2. A batcher Worker also appends receipts to an **append-only, hash-chained
   receipt log in R2**, partitioned by day/cell. **This log — not Postgres —
   is the financial source of truth.**
3. A queue consumer batches receipts into Supabase Postgres with
   `INSERT ... ON CONFLICT (receipt_id) DO NOTHING` (S2). The double-entry
   invariant check (MB-R1) runs on the Postgres projection.
4. Reconciliation (S6): hourly job recomputes counts + chain heads from R2
   and compares to Postgres; any divergence pages and freezes payouts.

**Supabase outage:** the queue retains and retries with backoff (S3). The
fabric keeps scheduling, verifying, and logging receipts to R2 — **no work
goes unmetered, nothing is lost**. What degrades: the ledger projection goes
stale. Consumers of the projection protect themselves with the **freshness
watermark** (S5): payout runs and invoice generation refuse to execute if
`ledger_watermark_age > threshold` (they pause, they never guess). Consoles
show "earnings updating" rather than wrong numbers. On recovery, the queue
drains, idempotent inserts make replay safe, reconciliation confirms
completeness, payouts resume. For a catastrophic Postgres loss, the ledger
projection is **rebuilt from the R2 receipt log** (rebuild runbook = MB-013
acceptance criterion; also standard Postgres PITR/replicas via Supabase).

**Why this shape:** money data gets *two* independent durability layers (DO
transactional storage at the point of decision, R2 hash-chained log) before
it ever depends on a third vendor's uptime. Postgres remains the *query and
invariant* layer, which is what it's good at — not the only copy.

## 5. Frontend failure domain (Vercel)

Consoles are read-mostly projections + a thin write path through the Job/
console APIs. Vercel down ⇒ fabric unaffected (agents/SDKs never touch
Vercel). Cloudflare API outage ⇒ consoles render cached/stale data with an
explicit staleness banner (never fabricate freshness). Status page (OO-009)
hosted on a fourth, independent domain.

## 6. QA obligations for seams

- Every seam ships a **chaos test**: kill the downstream mid-flow, assert
  degraded mode matches this document, assert zero loss after recovery
  (drain + reconcile = clean). Wired into OO-007 nightly.
- Every seam ships a **duplication test**: replay the transport twice,
  assert consumer state identical.
- Watermark metrics are asserted present by a CI fixture (a seam without
  metrics fails the meta-suite, PF-010).

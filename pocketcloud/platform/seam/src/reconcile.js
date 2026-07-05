// Reconciliation + rebuild + freshness watermark (SEAMS §4 step 4, §5/S6).
//
// The R2 log is the source of truth; the Postgres projection is derived. These
// utilities are how we KNOW the seam worked, rather than hoping:
//   - reconcile(): compare log vs projection (count + chain head + per-receipt
//     presence). Divergence pages and (in production) freezes payouts.
//   - rebuildProjection(): reconstruct the projection from the R2 log ALONE —
//     the catastrophic-Postgres-loss drill (MB-013 acceptance / SEAMS S8).
//   - watermark: reconciliation updates it; payout/invoice runs refuse when it
//     is stale (S5) — "lag, never loss" made operational.

import { verifyChain } from './r2log.js';

// Compare the R2 log against the projection. Returns a structured result;
// `converged` is the go/no-go for payouts.
export async function reconcile({ r2log, projection }) {
  const chain = verifyChain(r2log);
  const logReceipts = r2log.readAll();
  const projCount = await projection.count();

  const missing = [];
  for (const r of logReceipts) {
    if (!(await projection.has(r.receiptId))) missing.push(r.receiptId);
  }

  const converged =
    chain.ok && missing.length === 0 && projCount === logReceipts.length;

  return {
    converged,
    chainOk: chain.ok,
    chainHead: chain.ok ? chain.head : null,
    chainReason: chain.ok ? null : chain.reason,
    logCount: logReceipts.length,
    projectionCount: projCount,
    missingInProjection: missing,
  };
}

// Rebuild the projection from the R2 log alone. Idempotent (upsert), so it is
// safe to run against a partially-populated projection too.
export async function rebuildProjection({ r2log, projection }) {
  let inserted = 0;
  for (const r of r2log.readAll()) {
    if ((await projection.upsertReceipt(r)) === 'inserted') inserted += 1;
  }
  return { inserted, total: r2log.readAll().length };
}

// Freshness watermark (S5). `nowFn` is injectable for deterministic tests.
export function makeWatermark({ maxAgeMs, nowFn }) {
  let lastReconciledAt = null;
  let lastChainHead = null;
  return {
    // Called after a SUCCESSFUL reconcile.
    markReconciled(chainHead) {
      lastReconciledAt = nowFn();
      lastChainHead = chainHead;
    },
    ageMs() {
      return lastReconciledAt == null ? Infinity : nowFn() - lastReconciledAt;
    },
    chainHead: () => lastChainHead,
    // Payout/invoice runs call this; a stale (or never-reconciled) ledger
    // refuses to pay — it pauses, it never guesses (SEAMS §4).
    canSettle() {
      return this.ageMs() <= maxAgeMs;
    },
  };
}

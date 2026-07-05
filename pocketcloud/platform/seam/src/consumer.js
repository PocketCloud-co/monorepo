// Metering seam CONSUMER (MB-013, SEAMS §4 step 3).
//
// Drains the queue into the Postgres ledger projection, IDEMPOTENTLY
// (ON CONFLICT (receipt_id) DO NOTHING). Duplicate deliveries (at-least-once)
// produce one row (S2). If the projection is unavailable (Supabase down), the
// upsert throws, the queue retries, and NOTHING is lost — the failure mode is
// lag, not loss (S4). Work already in the R2 log is safe regardless.
//
// `projection` implements:
//   async upsertReceipt(sealedReceipt) -> 'inserted' | 'duplicate'  (throws if down)
//   async count() -> number
// Both the in-memory and the Postgres-backed projection satisfy this.

export function makeConsumer({ queue, projection }) {
  return {
    // Drain the queue once. Returns { delivered, retried, deadLettered }.
    async drainOnce() {
      return queue.drain(async (sealed) => {
        // May throw if the projection is unavailable — the queue will retry.
        await projection.upsertReceipt(sealed);
      });
    },
  };
}

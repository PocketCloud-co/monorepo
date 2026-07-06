// In-memory ledger projection for portable seam tests. Mirrors the Postgres
// projection's contract: idempotent upsert (ON CONFLICT DO NOTHING) + the
// per-row double-entry invariant enforced on write (as the SQL CHECK does).
// A `fail` switch simulates "Supabase down" so S4 (lag-not-loss) is testable.

export function memoryProjection() {
  const byId = new Map();
  let down = false;

  return {
    setDown(v) {
      down = v;
    },
    async upsertReceipt(r) {
      if (down) throw new Error('projection unavailable (simulated Supabase outage)');
      // Enforce the same invariants the SQL CHECKs do, so a malformed receipt
      // is rejected here too (defense in depth; the seam never launders bad money).
      if (r.customerMillicredits !== r.workerMillicredits + r.platformMillicredits) {
        throw new Error(`double-entry violation on ${r.receiptId}`);
      }
      if (r.payable !== r.verified) throw new Error(`payable!=verified on ${r.receiptId}`);
      if (byId.has(r.receiptId)) return 'duplicate';
      byId.set(r.receiptId, r);
      return 'inserted';
    },
    async has(receiptId) {
      return byId.has(receiptId);
    },
    async count() {
      return byId.size;
    },
    async summary() {
      let c = 0;
      let w = 0;
      let p = 0;
      for (const r of byId.values()) {
        c += r.customerMillicredits;
        w += r.workerMillicredits;
        p += r.platformMillicredits;
      }
      return { customer: c, worker: w, platform: p, invariantHolds: c === w + p };
    },
    clear() {
      byId.clear();
    },
  };
}

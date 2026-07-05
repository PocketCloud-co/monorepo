// Metering seam PRODUCER (CP-013, SEAMS §4 step 1-2).
//
// When the verifier finishes an attempt, for each worker receipt it:
//   1. writes the receipt to the R2 hash-chained log (the source of truth) —
//      DURABLE WRITE-AHEAD (S1): nothing is acknowledged before it is durable
//      in the log's failure domain;
//   2. enqueues the sealed receipt for the Postgres consumer (at-least-once).
//
// In production step 1 also writes to Durable Object transactional storage in
// the same txn; here the R2 log IS the durable substrate we test against. The
// receipt legs are computed by the ledger's pricing (independent legs), so the
// seam never invents money — it transports already-priced, already-sealed
// receipts.

// partitionKey: production uses `${cell}/${yyyy-mm-dd}`; passed in so tests are
// deterministic (no wall-clock/Date dependence).
export function makeProducer({ r2log, queue }) {
  return {
    // receiptBodies: array of receipt bodies WITHOUT prevHash/hash (the log
    // seals them). Returns the sealed receipts. S1: appended to R2 before
    // enqueue, so a crash after append but before enqueue loses nothing —
    // reconciliation will re-enqueue from the log.
    publish(partitionKey, receiptBodies) {
      const sealed = [];
      for (const body of receiptBodies) {
        const s = r2log.append(partitionKey, body); // (1) durable write-ahead
        sealed.push(s);
        queue.enqueue(s); // (2) at-least-once handoff
      }
      return sealed;
    },
  };
}

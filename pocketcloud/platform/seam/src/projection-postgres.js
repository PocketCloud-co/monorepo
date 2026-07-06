// Postgres-backed ledger projection (MB-013): the same contract as the
// in-memory projection, but writing to the real `pc.receipts` schema
// (platform/supabase). Idempotent upsert = INSERT ... ON CONFLICT
// (receipt_id) DO NOTHING — exactly the at-least-once safety the seam relies
// on. The per-row double-entry + payable CHECKs in the schema reject bad money
// at the boundary, so a malformed receipt throws here just as it would in prod.
//
// To keep the platform modules dependency-free, this talks to Postgres via a
// caller-supplied `query(text, params)` that returns rows as string[][] (fields
// in column order). The test harness passes a tiny psql-subprocess adapter;
// production passes a real driver (pg / Supabase). No SQL is string-built from
// receipt VALUES — every value is a parameter ($1..$n), so there is no
// injection surface (Standards §4).

export function postgresProjection({ query }) {
  // Receipt -> ordered parameter list matching the INSERT column order.
  const params = (r) => [
    r.schemaVersion ?? 1,
    r.receiptId,
    r.jobId,
    r.attempt,
    r.workerId,
    r.template,
    r.units,
    r.verified,
    r.payable,
    r.poolId ?? '',
    r.priceConfigVersion,
    r.customerMillicredits,
    r.workerMillicredits,
    r.platformMillicredits,
    r.prevHash,
    r.hash,
  ];

  return {
    async upsertReceipt(r) {
      const rows = await query(
        `insert into pc.receipts
           (schema_version, receipt_id, job_id, attempt, worker_id, template, units,
            verified, payable, pool_id, price_config_version,
            customer_millicredits, worker_millicredits, platform_millicredits, prev_hash, hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         on conflict (receipt_id) do nothing
         returning receipt_id`,
        params(r),
      );
      return rows.length ? 'inserted' : 'duplicate';
    },
    async has(receiptId) {
      const rows = await query('select 1 from pc.receipts where receipt_id = $1', [receiptId]);
      return rows.length > 0;
    },
    async count() {
      const rows = await query('select count(*)::int from pc.receipts');
      return Number(rows[0][0]);
    },
    async summary() {
      // ledger_summary columns, in order: customer_billed, worker_payout,
      // platform, invariant_holds (psql renders booleans as 't'/'f').
      const [c, w, p, inv] = (await query('select * from pc.ledger_summary'))[0];
      return {
        customer: Number(c),
        worker: Number(w),
        platform: Number(p),
        invariantHolds: inv === 't' || inv === 'true',
      };
    },
  };
}

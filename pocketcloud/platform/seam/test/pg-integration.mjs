// Postgres integration test for the seam (MB-013): runs the real consumer path
// against the real pc.receipts schema. Proves idempotent upsert, S6
// reconciliation, and rebuild-from-R2 work against actual SQL + the schema's
// double-entry CHECKs. Invoked by run-pg-integration.sh, which provides a live
// Postgres via env PGHOST/PGPORT/PGUSER/PGDATABASE and applies the schema.

import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

import { inMemoryR2Log } from '../src/r2log.js';
import { inMemoryQueue } from '../src/queue.js';
import { makeProducer } from '../src/producer.js';
import { makeConsumer } from '../src/consumer.js';
import { reconcile, rebuildProjection } from '../src/reconcile.js';
import { postgresProjection } from '../src/projection-postgres.js';
import { receiptBody } from './helpers.js';

const FS = '|'; // psql field separator for row parsing

// Minimal psql-subprocess query adapter: runs one parameterized statement via a
// server-side PREPARE/EXECUTE and returns rows as string[] (fields split on FS).
// Every value is bound as a typed SQL literal server-side — no receipt value is
// concatenated into the statement text, so there is no injection surface
// (Standards §4). Production swaps in a real driver with the same contract.
function makeQuery(conn) {
  return async function query(text, params = []) {
    // Value-bearing statements bind receipt data via a server-side PREPARE so
    // nothing is concatenated into the statement. Parameterless statements are
    // static SQL from our own code (no receipt values, no injection surface)
    // and include non-preparable utility statements like TRUNCATE, so they run
    // as-is.
    const sql = params.length
      ? `prepare _q as ${text};\nexecute _q (${bindLiterals(params)});\ndeallocate _q;`
      : text;
    const r = spawnSync(
      'psql',
      [...conn, '-v', 'ON_ERROR_STOP=1', '-A', '-F', FS, '-t', '-q', '-c', sql],
      { encoding: 'utf8' },
    );
    if (r.status !== 0) {
      throw new Error((r.stderr || r.stdout || 'psql failed').trim());
    }
    return r.stdout
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => l.split(FS));
  };
}

// Bind params as typed SQL literals for EXECUTE: numbers/bools inline, strings
// single-quote-escaped. Test-only; production uses a driver's parameter bind.
function bindLiterals(params) {
  return params
    .map((p) => {
      if (p === null || p === undefined) return 'null';
      if (typeof p === 'number') return String(p);
      if (typeof p === 'boolean') return p ? 'true' : 'false';
      return `'${String(p).replace(/'/g, "''")}'`;
    })
    .join(',');
}

async function main() {
  const conn = [
    '-h', process.env.PGHOST, '-p', process.env.PGPORT,
    '-U', process.env.PGUSER, '-d', process.env.PGDATABASE,
  ];
  const query = makeQuery(conn);
  const projection = postgresProjection({ query });

  const r2log = inMemoryR2Log();
  const queue = inMemoryQueue();
  const producer = makeProducer({ r2log, queue });
  const consumer = makeConsumer({ queue, projection });
  const PART = 'us-east-1/2026-07-05';

  // Seed the price config the receipts reference (FK).
  await query(
    `insert into pc.price_configs(version, customer_per_unit, worker_per_unit)
       values ('pc-v1', 1000, 600) on conflict (version) do nothing`,
  );

  // 1. produce + consume into REAL Postgres
  producer.publish(PART, [
    receiptBody({ jobId: 'j1', workerId: 'w1' }),
    receiptBody({ jobId: 'j1', workerId: 'w2' }),
    receiptBody({ jobId: 'j2', workerId: 'w3', verified: false }), // rejected: bills 0
    receiptBody({ jobId: 'j3', workerId: 'w4', poolId: 'pool-acme', payoutsEnabled: false }), // license mode
  ]);
  const d = await consumer.drainOnce();
  assert.equal(d.delivered, 4, 'all four receipts delivered to Postgres');
  assert.equal(await projection.count(), 4);

  // 2. idempotent upsert: re-deliver everything; still 4 rows
  for (const r of r2log.readAll()) queue.enqueue(r);
  await consumer.drainOnce();
  assert.equal(await projection.count(), 4, 'ON CONFLICT DO NOTHING held');

  // 3. the schema's aggregate invariant holds, computed by real SQL
  const sum = await projection.summary();
  assert.equal(sum.invariantHolds, true, JSON.stringify(sum));

  // 4. reconciliation converges (log == projection, chain ok)
  const rec = await reconcile({ r2log, projection });
  assert.equal(rec.converged, true, JSON.stringify(rec));

  // 5. rebuild-from-R2 against real Postgres: truncate, rebuild, reconcile
  await query('truncate pc.receipts');
  assert.equal(await projection.count(), 0);
  const rb = await rebuildProjection({ r2log, projection });
  assert.equal(rb.inserted, 4, 'ledger rebuilt from the R2 log alone');
  assert.equal((await reconcile({ r2log, projection })).converged, true);

  console.log('PG INTEGRATION: all seam-vs-real-Postgres assertions passed');
}

main().catch((e) => {
  console.error('PG INTEGRATION FAILED:', e.message);
  process.exit(1);
});

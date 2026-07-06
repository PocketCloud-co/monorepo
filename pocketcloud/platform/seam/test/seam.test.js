// Metering seam tests (CP-013/MB-013, SEAMS §4). The headline tests are the
// seam invariants: durable write-ahead (S1), idempotent at-least-once (S2),
// lag-not-loss under a downstream outage (S4), reconciliation (S6), rebuild
// from the log alone, chain-tamper detection, and the stale-watermark payout
// guard (S5).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inMemoryR2Log, filesystemR2Log, verifyChain } from '../src/r2log.js';
import { inMemoryQueue } from '../src/queue.js';
import { makeProducer } from '../src/producer.js';
import { makeConsumer } from '../src/consumer.js';
import { reconcile, rebuildProjection, makeWatermark } from '../src/reconcile.js';
import { memoryProjection } from '../src/projection-memory.js';
import { receiptBody } from './helpers.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PART = 'us-east-1/2026-07-05';

function rig() {
  const r2log = inMemoryR2Log();
  const queue = inMemoryQueue();
  const projection = memoryProjection();
  const producer = makeProducer({ r2log, queue });
  const consumer = makeConsumer({ queue, projection });
  return { r2log, queue, projection, producer, consumer };
}

test('S1 durable write-ahead: receipt is in the R2 log before the consumer runs', async () => {
  const { r2log, producer } = rig();
  producer.publish(PART, [receiptBody({ jobId: 'j1', workerId: 'w1' })]);
  // Even though nothing has been consumed, the receipt is already durable.
  assert.equal(r2log.readAll().length, 1);
  assert.equal(verifyChain(r2log).ok, true);
});

test('happy path: produce -> consume -> projection matches, reconcile converges', async () => {
  const { r2log, producer, consumer, projection } = rig();
  producer.publish(PART, [
    receiptBody({ jobId: 'j1', workerId: 'w1' }),
    receiptBody({ jobId: 'j1', workerId: 'w2' }),
  ]);
  const res = await consumer.drainOnce();
  assert.equal(res.delivered, 2);
  assert.equal(await projection.count(), 2);
  const rec = await reconcile({ r2log, projection });
  assert.equal(rec.converged, true);
  assert.equal(rec.logCount, 2);
  assert.equal(rec.projectionCount, 2);
});

test('S2 idempotent at-least-once: a duplicate delivery yields one row', async () => {
  const { r2log, queue, producer, consumer, projection } = rig();
  const [sealed] = producer.publish(PART, [receiptBody({ jobId: 'j1', workerId: 'w1' })]);
  // Simulate the queue re-delivering the same message (at-least-once).
  queue.enqueue(sealed);
  await consumer.drainOnce();
  assert.equal(await projection.count(), 1, 'duplicate must not double-insert');
  assert.equal((await reconcile({ r2log, projection })).converged, true);
});

test('S4 lag-not-loss: Supabase down mid-flow loses nothing; drains clean on recovery', async () => {
  const { r2log, queue, producer, consumer, projection } = rig();
  // Downstream is down. The fabric keeps producing (R2 + queue keep working).
  projection.setDown(true);
  producer.publish(PART, [receiptBody({ jobId: 'j1', workerId: 'w1' })]);
  producer.publish(PART, [receiptBody({ jobId: 'j2', workerId: 'w2' })]);

  // Consumer attempts fail; messages are retried, not lost.
  const r1 = await consumer.drainOnce();
  assert.equal(r1.delivered, 0);
  assert.ok(r1.retried >= 2);
  assert.equal(await projection.count(), 0, 'nothing written while down');
  // The source of truth is intact regardless.
  assert.equal(r2log.readAll().length, 2);
  assert.equal(queue.dlqDepth(), 0);

  // Recovery: drain succeeds, projection catches up, reconcile converges.
  projection.setDown(false);
  const r2 = await consumer.drainOnce();
  assert.equal(r2.delivered, 2);
  assert.equal(await projection.count(), 2);
  assert.equal((await reconcile({ r2log, projection })).converged, true);
});

test('S3 poison message dead-letters after maxAttempts, with an alert (never dropped)', async () => {
  const r2log = inMemoryR2Log();
  const queue = inMemoryQueue({ maxAttempts: 3 });
  const projection = memoryProjection();
  const producer = makeProducer({ r2log, queue });
  const consumer = makeConsumer({ queue, projection });
  let alerted = null;
  queue.onDeadLetter((body) => (alerted = body.receiptId));

  projection.setDown(true); // this message will never succeed
  producer.publish(PART, [receiptBody({ jobId: 'poison', workerId: 'w1' })]);
  for (let i = 0; i < 3; i++) await consumer.drainOnce();
  assert.equal(queue.dlqDepth(), 1);
  assert.equal(alerted, 'poison:1:w1');
  // Still recoverable: it is in the R2 log; a rebuild would restore it.
  assert.equal(r2log.readAll().length, 1);
});

test('S6 reconciliation detects a projection that has fallen behind', async () => {
  const { r2log, producer, projection } = rig();
  producer.publish(PART, [
    receiptBody({ jobId: 'j1', workerId: 'w1' }),
    receiptBody({ jobId: 'j1', workerId: 'w2' }),
  ]);
  // Only apply one of the two to the projection (simulate lost/incomplete drain).
  await projection.upsertReceipt(r2log.readAll()[0]);
  const rec = await reconcile({ r2log, projection });
  assert.equal(rec.converged, false);
  assert.equal(rec.missingInProjection.length, 1);
  assert.equal(rec.logCount, 2);
  assert.equal(rec.projectionCount, 1);
});

test('rebuild: reconstruct the projection from the R2 log ALONE (Postgres-loss drill)', async () => {
  const { r2log, producer, consumer, projection } = rig();
  producer.publish(PART, [
    receiptBody({ jobId: 'j1', workerId: 'w1' }),
    receiptBody({ jobId: 'j1', workerId: 'w2' }),
    receiptBody({ jobId: 'j2', workerId: 'w3', verified: false }),
  ]);
  await consumer.drainOnce();
  const before = await projection.summary();

  // Catastrophic loss: wipe Postgres.
  projection.clear();
  assert.equal(await projection.count(), 0);

  // Rebuild from R2 alone.
  const rb = await rebuildProjection({ r2log, projection });
  assert.equal(rb.inserted, 3);
  const after = await projection.summary();
  assert.deepEqual(after, before, 'rebuilt ledger must match the original exactly');
  assert.equal((await reconcile({ r2log, projection })).converged, true);
});

test('chain tamper: altering an R2 receipt is detected by chain verification', async () => {
  const { r2log, producer } = rig();
  producer.publish(PART, [
    receiptBody({ jobId: 'j1', workerId: 'w1' }),
    receiptBody({ jobId: 'j1', workerId: 'w2' }),
  ]);
  assert.equal(verifyChain(r2log).ok, true);
  // Tamper with a stored entry's units in place.
  r2log.read(PART)[0].units = 9999;
  const v = verifyChain(r2log);
  assert.equal(v.ok, false);
  assert.match(v.reason, /altered|mismatch/);
});

test('cross-partition anchoring: a second day chains onto the first', async () => {
  const { r2log, producer } = rig();
  producer.publish('us-east-1/2026-07-05', [receiptBody({ jobId: 'j1', workerId: 'w1' })]);
  producer.publish('us-east-1/2026-07-06', [receiptBody({ jobId: 'j2', workerId: 'w2' })]);
  // The day-2 genesis prevHash must equal the day-1 head — one continuous chain.
  const day1Head = r2log.head('us-east-1/2026-07-05');
  const day2First = r2log.read('us-east-1/2026-07-06')[0];
  assert.equal(day2First.prevHash, day1Head);
  assert.equal(verifyChain(r2log).ok, true);
});

test('S5 stale-watermark guard: payouts refuse until a fresh reconcile', async () => {
  let clock = 1000;
  const wm = makeWatermark({ maxAgeMs: 500, nowFn: () => clock });
  assert.equal(wm.canSettle(), false, 'never-reconciled ledger cannot settle');

  wm.markReconciled('head-abc');
  assert.equal(wm.canSettle(), true);
  clock += 400;
  assert.equal(wm.canSettle(), true, 'within freshness window');
  clock += 200; // now 600ms since reconcile > 500ms budget
  assert.equal(wm.canSettle(), false, 'stale ledger must refuse to pay');
});

test('filesystem R2 backend behaves identically (faithful stand-in)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r2-'));
  const r2log = filesystemR2Log(dir);
  const queue = inMemoryQueue();
  const projection = memoryProjection();
  const producer = makeProducer({ r2log, queue });
  const consumer = makeConsumer({ queue, projection });
  producer.publish(PART, [
    receiptBody({ jobId: 'j1', workerId: 'w1' }),
    receiptBody({ jobId: 'j1', workerId: 'w2' }),
  ]);
  await consumer.drainOnce();
  assert.equal(await projection.count(), 2);
  assert.equal(verifyChain(r2log).ok, true);
  assert.equal((await reconcile({ r2log, projection })).converged, true);
});

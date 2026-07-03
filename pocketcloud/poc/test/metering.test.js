// Metering tests: deterministic work units, upfront quotes, pay-only-on-
// verified receipts, and the double-entry ledger invariant. Uses its own
// coordinator + fleet so ledger totals are exact.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { estimateJob, getLedger, submitJob } from '../src/client/client.js';
import { createCoordinator } from '../src/coordinator/coordinator.js';
import { createWorker } from '../src/worker/worker.js';

let coordinator;
const workers = [];

before(async () => {
  coordinator = await createCoordinator();
  for (let i = 1; i <= 6; i++) {
    workers.push(
      await createWorker({ id: `m-host-${i}`, coordinatorUrl: coordinator.url }),
    );
  }
});

after(async () => {
  for (const w of workers) await w.close();
  await coordinator.close();
});

const W = [
  [1.0, 0.5, -0.25, 2.0],
  [-2.0, 1.25, 0.5, 0.75],
  [0.5, -1.0, 3.0, -0.5],
];
const x = [2.0, -4.0, 8.0, 1.5];
// matvec units per worker: 2 streams (share + MAC) * rows * cols.
const MATVEC_UNITS = 2 * 3 * 4;

test('estimate quotes exact units and cost before dispatch', async () => {
  const quote = await estimateJob(coordinator.url, {
    template: 'matvec',
    matrix: W,
    input: x,
    n: 3,
  });
  assert.equal(quote.unitsPerWorker, MATVEC_UNITS);
  assert.equal(quote.customerMillicredits, MATVEC_UNITS * 3 * 1000);
  assert.equal(quote.perWorkerMillicredits, MATVEC_UNITS * 600);
});

test('verified job bills the customer exactly the quote and pays each worker', async () => {
  const res = await submitJob(coordinator.url, {
    template: 'matvec',
    matrix: W,
    input: x,
    n: 3,
  });
  assert.equal(res.billing.unitsPerWorker, MATVEC_UNITS);
  assert.equal(res.billing.customerMillicredits, MATVEC_UNITS * 3 * 1000);
  assert.equal(res.billing.rejectedAttemptsNotBilled, 0);

  const ledger = await getLedger(coordinator.url);
  assert.equal(ledger.customerBilledMillicredits, MATVEC_UNITS * 3 * 1000);
  assert.equal(ledger.workerPayoutMillicredits, MATVEC_UNITS * 600 * 3);
  assert.equal(
    ledger.platformMillicredits,
    MATVEC_UNITS * 3 * 1000 - MATVEC_UNITS * 600 * 3,
  );
  assert.equal(ledger.invariantHolds, true);

  // Every receipt on a verified attempt is payable.
  for (const r of ledger.receipts) assert.equal(r.payable, true);
});

test('tampered attempt earns nothing and is never billed to the customer', async () => {
  // Warm-up so every honest host has placement history — the LRU scheduler
  // must pick freshly-registered mallory for the next job's first attempt.
  await submitJob(coordinator.url, { template: 'matvec', matrix: W, input: x, n: 3 });

  const before = await getLedger(coordinator.url);

  const mallory = await createWorker({
    id: 'm-mallory',
    coordinatorUrl: coordinator.url,
    tamper: true,
  });

  try {
    const res = await submitJob(coordinator.url, {
      template: 'matvec',
      matrix: W,
      input: x,
      n: 3,
    });
    assert.equal(res.attempts.length, 2);
    assert.equal(res.billing.rejectedAttemptsNotBilled, 1);
    // Customer pays for exactly one verified attempt.
    assert.equal(res.billing.customerMillicredits, MATVEC_UNITS * 3 * 1000);

    const ledger = await getLedger(coordinator.url);
    // Mallory has a receipt, but it is unpayable and worth zero.
    const mallorysReceipts = ledger.receipts.filter((r) => r.workerId === 'm-mallory');
    assert.equal(mallorysReceipts.length, 1);
    assert.equal(mallorysReceipts[0].payable, false);
    assert.equal(ledger.payoutsByWorker['m-mallory'], 0);

    // Customer billed grew by ONE attempt's worth; the rejected attempt cost
    // the customer nothing.
    assert.equal(
      ledger.customerBilledMillicredits - before.customerBilledMillicredits,
      MATVEC_UNITS * 3 * 1000,
    );
    // The honest workers on the failed attempt also earn nothing for it —
    // their loss is the platform's redundancy cost to absorb in production
    // (PRD 9.4); here it documents the "verified work only" rule strictly.
    assert.equal(ledger.invariantHolds, true);
  } finally {
    await mallory.close();
  }
});

test('private-dot meters by vector length', async () => {
  const a = [1.5, -2.0, 0.25];
  const quote = await estimateJob(coordinator.url, {
    template: 'private-dot',
    x: a,
    y: [1, 2, 3],
    n: 3,
  });
  assert.equal(quote.unitsPerWorker, 12 * 3);
});

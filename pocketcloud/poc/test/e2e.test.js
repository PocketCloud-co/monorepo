// End-to-end protocol tests: real coordinator + real workers over HTTP.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { listWorkers, submitJob } from '../src/client/client.js';
import { createCoordinator } from '../src/coordinator/coordinator.js';
import { createWorker } from '../src/worker/worker.js';

let coordinator;
const workers = [];

before(async () => {
  coordinator = await createCoordinator();
  // 8 hosts: two tamper tests each quarantine a 3-worker attempt, and the
  // fleet must still be able to field a fresh 3-worker set afterwards.
  for (let i = 1; i <= 8; i++) {
    workers.push(
      await createWorker({ id: `t-host-${i}`, coordinatorUrl: coordinator.url }),
    );
  }
});

after(async () => {
  for (const w of workers) await w.close();
  await coordinator.close();
});

const W = [
  [1.0, 0.5, -0.25],
  [-2.0, 1.25, 0.5],
];
const x = [2.0, -4.0, 8.0];
const expectedY = W.map((row) => row.reduce((s, w, k) => s + w * x[k], 0));

test('matvec: private input, public matrix, verified result', async () => {
  const res = await submitJob(coordinator.url, {
    template: 'matvec',
    matrix: W,
    input: x,
    n: 3,
  });
  assert.equal(res.attempts.length, 1);
  assert.equal(res.attempts[0].verified, true);
  res.result.forEach((v, k) => assert.ok(Math.abs(v - expectedY[k]) < 1e-3));
});

test('private-dot: two private vectors multiplied via Beaver triples', async () => {
  const a = [1.5, -2.0, 0.25, 3.0];
  const b = [-1.0, 0.5, 4.0, 2.5];
  const expected = a.reduce((s, ak, k) => s + ak * b[k], 0);

  const res = await submitJob(coordinator.url, {
    template: 'private-dot',
    x: a,
    y: b,
    n: 3,
  });
  assert.equal(res.attempts[0].verified, true);
  assert.ok(Math.abs(res.result - expected) < 1e-3);
});

test('tampering worker is detected, quarantined, and job self-heals', async () => {
  const mallory = await createWorker({
    id: 't-mallory',
    coordinatorUrl: coordinator.url,
    tamper: true,
  });

  try {
    // Freshly registered => least-recently-used placement includes mallory.
    const res = await submitJob(coordinator.url, {
      template: 'matvec',
      matrix: W,
      input: x,
      n: 3,
    });

    assert.equal(res.attempts.length, 2);
    assert.equal(res.attempts[0].verified, false);
    assert.ok(res.attempts[0].workers.includes('t-mallory'));
    assert.equal(res.attempts[1].verified, true);
    assert.ok(!res.attempts[1].workers.includes('t-mallory'));
    res.result.forEach((v, k) => assert.ok(Math.abs(v - expectedY[k]) < 1e-3));

    const roster = await listWorkers(coordinator.url);
    const mallorysEntry = roster.find((w) => w.id === 't-mallory');
    assert.equal(mallorysEntry.quarantined, true);
  } finally {
    await mallory.close();
  }
});

test('tampering during a Beaver opening is caught by the opening MAC check', async () => {
  const mallory2 = await createWorker({
    id: 't-mallory-2',
    coordinatorUrl: coordinator.url,
    tamper: true,
  });

  try {
    const a = [1.0, 2.0];
    const b = [3.0, -1.0];
    const res = await submitJob(coordinator.url, {
      template: 'private-dot',
      x: a,
      y: b,
      n: 3,
    });

    const failed = res.attempts.filter((att) => !att.verified);
    assert.ok(failed.length >= 1);
    assert.match(failed[0].reason, /opening MAC check failed/);
    assert.ok(Math.abs(res.result - (1 * 3 + 2 * -1)) < 1e-3);
  } finally {
    await mallory2.close();
  }
});

test('job fails cleanly when the fleet cannot satisfy n', async () => {
  await assert.rejects(
    submitJob(coordinator.url, {
      template: 'matvec',
      matrix: W,
      input: x,
      n: 16, // within the validation bound, above the 8-host fleet size
    }),
    /eligible workers/,
  );
});

test('n=1 is rejected: a single "share" would be the plaintext', async () => {
  await assert.rejects(
    submitJob(coordinator.url, { template: 'matvec', matrix: W, input: x, n: 1 }),
    /privacy floor/,
  );
});

test('malformed inputs are rejected at the boundary, not mid-protocol', async () => {
  await assert.rejects(
    submitJob(coordinator.url, { template: 'matvec', matrix: [], input: [], n: 3 }),
    /rectangular/,
  );
  await assert.rejects(
    submitJob(coordinator.url, {
      template: 'private-dot',
      x: [1, 2],
      y: [1, 2, 3],
      n: 3,
    }),
    /equal length/,
  );
  await assert.rejects(
    submitJob(coordinator.url, {
      template: 'matvec',
      matrix: W,
      input: x,
      n: 3,
      maxAttempts: 0,
    }),
    /maxAttempts/,
  );
});

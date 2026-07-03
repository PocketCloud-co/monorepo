// Pocket Cloud end-to-end demo.
//
// Spins up one coordinator and a small fleet of workers in-process, then
// runs three scenarios:
//
//   1. Private inference (T1): a model layer W (public) applied to a private
//      input vector x. Each worker computes on a share of x that is uniform
//      random noise; no worker (and no group of n-1 workers) learns anything
//      about x. Result matches plaintext computation.
//
//   2. Private similarity (T3): dot product of TWO private vectors via
//      Beaver triples — neither input is ever visible to any worker.
//
//   3. Malicious host: a worker joins the fleet and tampers with its result
//      share. The SPDZ MAC check catches it, the coordinator quarantines the
//      attempt's workers and re-dispatches, and the customer receives a
//      verified-correct result anyway.
//
// Run: node demo.js

import { encodeVector } from './src/crypto/encoding.js';
import { dealWithMac, newMacKey } from './src/crypto/secret-sharing.js';
import { createCoordinator } from './src/coordinator/coordinator.js';
import { createWorker } from './src/worker/worker.js';
import {
  estimateJob,
  getLedger,
  listWorkers,
  submitJob,
} from './src/client/client.js';

const fmt = (xs) => `[${xs.map((v) => v.toFixed(4)).join(', ')}]`;
const hr = (title) => console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);

const coordinator = await createCoordinator();
console.log(`coordinator up at ${coordinator.url}`);

const fleet = [];
for (let i = 1; i <= 6; i++) {
  fleet.push(
    await createWorker({ id: `host-${i}`, coordinatorUrl: coordinator.url }),
  );
}
console.log(`fleet of ${fleet.length} honest hosts registered`);

// ---------------------------------------------------------------- demo 1
hr('DEMO 1 — Private inference: public model layer, PRIVATE input (n=3)');

const W = [
  [0.25, -0.5, 1.0, 0.75],
  [1.5, 0.125, -0.25, 0.5],
  [-1.0, 2.0, 0.5, -0.75],
];
const x = [3.25, -1.5, 2.0, 0.5]; // the customer's private data
const expected = W.map((row) => row.reduce((s, w, k) => s + w * x[k], 0));

console.log(`private input x  = ${fmt(x)}`);
console.log(`plaintext W·x    = ${fmt(expected)}   (computed locally for comparison)`);

// Metering is deterministic in the job's shape, so the quote precedes the run.
const quote = await estimateJob(coordinator.url, {
  template: 'matvec',
  matrix: W,
  input: x,
  n: 3,
});
console.log(
  `upfront quote    = ${quote.unitsPerWorker} units/worker × ${quote.n} workers ` +
    `= ${quote.customerMillicredits} millicredits (known BEFORE dispatch)`,
);

const job1 = await submitJob(coordinator.url, {
  template: 'matvec',
  matrix: W,
  input: x,
  n: 3,
});
console.log(`fabric result    = ${fmt(job1.result)}`);
console.log(`verification     = MAC check passed on attempt ${job1.attempts.at(-1).attempt}`);
console.log(`workers used     = ${job1.attempts.at(-1).workers.join(', ')}`);

const maxErr1 = Math.max(...job1.result.map((v, k) => Math.abs(v - expected[k])));
console.log(`max abs error    = ${maxErr1.toExponential(2)} (fixed-point rounding only)`);
if (maxErr1 > 1e-3) throw new Error('demo 1 result mismatch');

// Show what a single worker actually sees: uniform random field noise.
const peek = dealWithMac(encodeVector(x), 3, newMacKey())[0].share;
console.log(
  `\nwhat ONE host sees for x (its share of the 4 values):\n  ` +
    peek.map((v) => `0x${v.toString(16)}`).join('  '),
);
console.log('…uniform random field noise. Any 2 of the 3 shares are jointly just as random.');

// ---------------------------------------------------------------- demo 2
hr('DEMO 2 — Private similarity: dot product of TWO private vectors (n=3)');

const a = [0.5, -1.25, 2.0, 0.75, 1.0];
const b = [1.5, 0.25, -0.5, 2.0, -1.0];
const expectedDot = a.reduce((s, ak, k) => s + ak * b[k], 0);

console.log(`private vector a = ${fmt(a)}`);
console.log(`private vector b = ${fmt(b)}`);
console.log(`plaintext <a,b>  = ${expectedDot.toFixed(4)}`);

const job2 = await submitJob(coordinator.url, {
  template: 'private-dot',
  x: a,
  y: b,
  n: 3,
});
console.log(`fabric result    = ${job2.result.toFixed(4)} (via Beaver-triple MPC, 2 rounds)`);
if (Math.abs(job2.result - expectedDot) > 1e-3) throw new Error('demo 2 result mismatch');
console.log('verification     = opening MACs + result MAC all passed');

// ---------------------------------------------------------------- demo 3
hr('DEMO 3 — Malicious host joins the fleet and tampers with its share');

const mallory = await createWorker({
  id: 'host-MALLORY',
  coordinatorUrl: coordinator.url,
  tamper: true,
});
console.log('host-MALLORY registered (secretly corrupts its result shares)');

const job3 = await submitJob(coordinator.url, {
  template: 'matvec',
  matrix: W,
  input: x,
  n: 3,
});

for (const att of job3.attempts) {
  console.log(
    `attempt ${att.attempt}: workers [${att.workers.join(', ')}] → ` +
      (att.verified ? 'VERIFIED ✓' : `REJECTED ✗ (${att.reason})`),
  );
}
const maxErr3 = Math.max(...job3.result.map((v, k) => Math.abs(v - expected[k])));
if (maxErr3 > 1e-3) throw new Error('demo 3 result mismatch');
console.log(`final result     = ${fmt(job3.result)} — correct despite the attack`);

const roster = await listWorkers(coordinator.url);
const quarantined = roster.filter((w) => w.quarantined).map((w) => w.id);
console.log(`quarantined      = ${quarantined.join(', ')}`);
console.log(
  '(the PoC quarantines the whole failed attempt; production uses redundant\n' +
    ' execution to pinpoint the cheater — see PRD section 7.1)',
);

// ---------------------------------------------------------------- demo 4
hr('DEMO 4 — Metering: verified work pays, rejected work does not');

console.log(
  `demo 3 billing: customer paid ${job3.billing.customerMillicredits} millicredits ` +
    `for 1 verified attempt; ${job3.billing.rejectedAttemptsNotBilled} rejected ` +
    `attempt billed at 0`,
);

const ledger = await getLedger(coordinator.url);
console.log('\nhost earnings (millicredits, verified work only):');
for (const [workerId, mc] of Object.entries(ledger.payoutsByWorker)) {
  console.log(`  ${workerId.padEnd(14)} ${String(mc).padStart(8)}`);
}
console.log(`\ncustomer billed  = ${ledger.customerBilledMillicredits}`);
console.log(`host payouts     = ${ledger.workerPayoutMillicredits}`);
console.log(`platform take    = ${ledger.platformMillicredits}`);
console.log(`double-entry OK  = ${ledger.invariantHolds}`);
if (!ledger.invariantHolds) throw new Error('ledger invariant violated');
if (ledger.payoutsByWorker['host-MALLORY'] !== 0) {
  throw new Error('malicious host must earn nothing');
}
console.log('host-MALLORY earned 0 — its receipt exists but is unpayable.');

// ---------------------------------------------------------------- wrap up
hr('SUMMARY');
console.log(`
✓ workers computed real results while holding only information-theoretic
  noise — no worker, and no colluding subset below the threshold, could
  read, reproduce, or learn anything about the customer's data
✓ two private inputs were multiplied without either being revealed
✓ a tampering host was detected by the MAC check (catch probability
  1 - 2^-61 per corrupted value), quarantined, and the job self-healed
✓ metering was deterministic (quoted before dispatch), payable only on
  verified work, and the ledger balanced to the millicredit
`);

await mallory.close();
for (const w of fleet) await w.close();
await coordinator.close();

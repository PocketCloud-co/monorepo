// Pocket Cloud fabric coordinator (PoC, "managed mode").
//
// Responsibilities, mirroring PRD section 8.2:
//   - worker registry + placement (least-recently-used spread across fleet)
//   - dealer: fixed-point encode, additive secret sharing, SPDZ MAC dealing,
//     Beaver triple generation (trusted dealer in Phase 1)
//   - dispatch of share bundles to workers over HTTP
//   - verifier: MAC checks on every opening and every reconstructed result
//   - fault handling: a failed MAC check quarantines the attempt's workers
//     and re-dispatches the job to a fresh set — the customer never receives
//     an unverified result
//
// This is the PRD's `managed` privacy mode: the coordinator handles
// plaintext during dealing/reassembly. In `strict` mode this file's dealer
// and verifier logic moves into the customer SDK; the protocol is unchanged.

import http from 'node:http';

import { dealTriples } from '../crypto/beaver.js';
import {
  decode,
  decodeVector,
  encodeMatrix,
  encodeVector,
} from '../crypto/encoding.js';
import { add, mul } from '../crypto/field.js';
import {
  dealWithMac,
  newMacKey,
  reconstructVector,
  verifyMac,
} from '../crypto/secret-sharing.js';
import { mat2s, readBody, s2f, s2vec, sendJson, vec2s } from '../util/json.js';

// --- Metering (PRD section 9.4) -------------------------------------------
//
// Work is metered in deterministic WORK UNITS derived from the job's shape,
// never from device-reported time or CPU%. Templates make this possible: the
// coordinator knows exactly what it dispatched, so the meter reading exists
// BEFORE the job runs (which also gives customers an exact upfront quote).
// A receipt becomes payable only when the attempt's MAC verification passes:
// inflating a work claim is therefore the same crime as forging a result,
// and is caught the same way.
//
// Denominations: customers are billed 1000 millicredits per unit per worker;
// each worker earns 600; the platform retains 400 (PRD section 9.1 take).
const CUSTOMER_MILLICREDITS_PER_UNIT = 1000;
const WORKER_MILLICREDITS_PER_UNIT = 600;

// Deterministic per-worker work units by template shape.
const WORK_UNITS = {
  // Each worker multiplies W against its share vector AND its MAC share.
  matvec: ({ matrix }) => 2 * matrix.length * matrix[0].length,
  // Per element: 4 share subtractions in round 1, ~8 mult/adds across the
  // share and MAC combinations in round 2.
  'private-dot': ({ x }) => 12 * x.length,
};

async function callWorker(worker, template, payload) {
  const res = await fetch(`${worker.url}/compute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ template, payload }),
  });
  if (!res.ok) throw new Error(`worker ${worker.id} returned ${res.status}`);
  return res.json();
}

export async function createCoordinator({ port = 0 } = {}) {
  // id -> { id, url, quarantined, lastUsedSeq, registeredSeq }
  const workers = new Map();
  let regSeq = 0;
  let useSeq = 0;

  // Append-only metering ledger: one dual-purpose receipt per worker per
  // attempt. `payable` is set only when the attempt verified — workers are
  // paid for delivered VERIFIED work, and customers are never billed for a
  // rejected attempt (PRD F5). Production hash-chains and dual-signs these.
  const ledger = [];
  let receiptSeq = 0;

  function recordAttempt(jobId, attempt, chosen, template, units, verified) {
    for (const w of chosen) {
      receiptSeq += 1;
      ledger.push({
        receiptId: receiptSeq,
        jobId,
        attempt,
        workerId: w.id,
        template,
        units,
        verified,
        payable: verified,
        workerMillicredits: verified ? units * WORKER_MILLICREDITS_PER_UNIT : 0,
      });
    }
  }

  function ledgerSummary() {
    const payouts = {};
    let customerBilled = 0;
    let workerTotal = 0;
    let platformTotal = 0;
    for (const r of ledger) {
      payouts[r.workerId] = (payouts[r.workerId] ?? 0) + r.workerMillicredits;
      workerTotal += r.workerMillicredits;
      if (r.payable) {
        customerBilled += r.units * CUSTOMER_MILLICREDITS_PER_UNIT;
        // Platform take computed INDEPENDENTLY of the stored worker amount,
        // so the invariant below can actually fail (e.g. a receipt whose
        // workerMillicredits was written at the wrong rate). Full
        // double-entry with independently-sourced legs lands in MB-001.
        platformTotal +=
          r.units * (CUSTOMER_MILLICREDITS_PER_UNIT - WORKER_MILLICREDITS_PER_UNIT);
      }
    }
    return {
      receipts: ledger,
      payoutsByWorker: payouts,
      customerBilledMillicredits: customerBilled,
      workerPayoutMillicredits: workerTotal,
      platformMillicredits: platformTotal,
      // Double-entry invariant: every customer millicredit is accounted for.
      invariantHolds: customerBilled === workerTotal + platformTotal,
    };
  }

  // Least-recently-used placement: spreads load across the fleet and, in
  // this PoC, stands in for the PRD's full anti-collusion placement solver.
  function selectWorkers(n) {
    const eligible = [...workers.values()]
      .filter((w) => !w.quarantined)
      .sort(
        (a, b) =>
          a.lastUsedSeq - b.lastUsedSeq || a.registeredSeq - b.registeredSeq,
      );
    if (eligible.length < n) {
      throw new Error(
        `need ${n} eligible workers, have ${eligible.length} ` +
          `(quarantined: ${[...workers.values()].filter((w) => w.quarantined).length})`,
      );
    }
    const chosen = eligible.slice(0, n);
    useSeq += 1;
    for (const w of chosen) w.lastUsedSeq = useSeq;
    return chosen;
  }

  function quarantine(chosen, reason) {
    for (const w of chosen) {
      w.quarantined = true;
      w.quarantineReason = reason;
    }
  }

  // --- Template T1: private matrix-vector product (public model, private input).
  // Linear ops on additive shares need no interaction: each worker computes
  // W * xShare_i locally and sum_i W * xShare_i = W * x.
  async function runMatvec({ matrix, input }, chosen, alpha) {
    const W = encodeMatrix(matrix);
    const dealt = dealWithMac(encodeVector(input), chosen.length, alpha);

    const results = await Promise.all(
      chosen.map((w, i) =>
        callWorker(w, 'matvec', {
          matrix: mat2s(W),
          xShare: vec2s(dealt[i].share),
          xMacShare: vec2s(dealt[i].mac),
        }),
      ),
    );

    const y = reconstructVector(results.map((r) => s2vec(r.yShare)));
    const yMac = reconstructVector(results.map((r) => s2vec(r.yMacShare)));

    if (!verifyMac(y, yMac, alpha)) {
      return { verified: false, reason: 'result MAC check failed' };
    }
    // W and x are each scaled by 2^16, so y carries scale power 2.
    return { verified: true, result: decodeVector(y, 2) };
  }

  // --- Template T3: private dot product of two private vectors, via Beaver
  // triples. Two online rounds; every opened value is itself MAC-checked.
  async function runPrivateDot({ x, y }, chosen, alpha) {
    const count = x.length;
    const xDealt = dealWithMac(encodeVector(x), chosen.length, alpha);
    const yDealt = dealWithMac(encodeVector(y), chosen.length, alpha);
    const triples = dealTriples(count, chosen.length, alpha);

    // Round 1: open d = x - a, e = y - b.
    const phase1 = await Promise.all(
      chosen.map((w, i) =>
        callWorker(w, 'dot-phase1', {
          xShare: vec2s(xDealt[i].share),
          xMacShare: vec2s(xDealt[i].mac),
          yShare: vec2s(yDealt[i].share),
          yMacShare: vec2s(yDealt[i].mac),
          aShare: vec2s(triples[i].a.share),
          aMacShare: vec2s(triples[i].a.mac),
          bShare: vec2s(triples[i].b.share),
          bMacShare: vec2s(triples[i].b.mac),
        }),
      ),
    );

    const d = reconstructVector(phase1.map((r) => s2vec(r.dShare)));
    const e = reconstructVector(phase1.map((r) => s2vec(r.eShare)));
    const dMac = reconstructVector(phase1.map((r) => s2vec(r.dMacShare)));
    const eMac = reconstructVector(phase1.map((r) => s2vec(r.eMacShare)));

    // A worker that mis-opens d effectively substitutes a different input;
    // the opening MAC check catches exactly that.
    if (!verifyMac(d, dMac, alpha) || !verifyMac(e, eMac, alpha)) {
      return { verified: false, reason: 'opening MAC check failed (round 1)' };
    }

    // Round 2: combine into shares of z = <x, y>.
    const phase2 = await Promise.all(
      chosen.map((w, i) =>
        callWorker(w, 'dot-phase2', {
          d: vec2s(d),
          e: vec2s(e),
          aShare: vec2s(triples[i].a.share),
          aMacShare: vec2s(triples[i].a.mac),
          bShare: vec2s(triples[i].b.share),
          bMacShare: vec2s(triples[i].b.mac),
          cShare: vec2s(triples[i].c.share),
          cMacShare: vec2s(triples[i].c.mac),
        }),
      ),
    );

    // Public correction terms: z += sum_k d_k * e_k, mac += alpha * that.
    let publicTerm = 0n;
    for (let k = 0; k < count; k++) {
      publicTerm = add(publicTerm, mul(d[k], e[k]));
    }

    let z = publicTerm;
    let zMac = mul(alpha, publicTerm);
    for (const r of phase2) {
      z = add(z, s2f(r.zShare));
      zMac = add(zMac, s2f(r.zMacShare));
    }

    if (!verifyMac([z], [zMac], alpha)) {
      return { verified: false, reason: 'result MAC check failed (round 2)' };
    }
    return { verified: true, result: decode(z, 2) };
  }

  const TEMPLATES = { matvec: runMatvec, 'private-dot': runPrivateDot };

  // Job runner with fault handling: on a verification failure, quarantine
  // the attempt's workers (production would use redundancy to pinpoint the
  // cheater; the PoC quarantines the whole attempt pending investigation)
  // and retry on a fresh set.
  // Boundary validation (Standards §4: validate before any math runs).
  // n >= 2 is a PRIVACY floor, not a tuning default: with n = 1 the single
  // "share" is the encoded plaintext itself. SPEC-001 §3 / SPEC-003 §1.
  function badRequest(msg) {
    const err = new Error(msg);
    err.status = 400;
    return err;
  }

  const isFiniteNumberVector = (v) =>
    Array.isArray(v) && v.length > 0 && v.every(Number.isFinite);

  function validateJob(body) {
    if (!WORK_UNITS[body.template]) {
      throw badRequest(`unknown template ${body.template}`);
    }
    const n = body.n ?? 3;
    if (!Number.isInteger(n) || n < 2 || n > 16) {
      throw badRequest('n must be an integer in [2, 16] (n >= 2 is a privacy floor)');
    }
    const maxAttempts = body.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
      throw badRequest('maxAttempts must be an integer in [1, 10]');
    }
    if (body.template === 'matvec') {
      const { matrix, input } = body;
      if (
        !Array.isArray(matrix) ||
        matrix.length === 0 ||
        !matrix.every((row) => isFiniteNumberVector(row) && row.length === matrix[0].length)
      ) {
        throw badRequest('matrix must be a non-empty rectangular array of finite numbers');
      }
      if (!isFiniteNumberVector(input) || input.length !== matrix[0].length) {
        throw badRequest('input must be a finite-number vector matching matrix columns');
      }
    }
    if (body.template === 'private-dot') {
      const { x, y } = body;
      if (!isFiniteNumberVector(x) || !isFiniteNumberVector(y) || x.length !== y.length) {
        throw badRequest('x and y must be finite-number vectors of equal length');
      }
    }
    return { n, maxAttempts };
  }

  // Upfront quote: work units are a pure function of the job's shape, so
  // the customer can see the exact meter reading before anything runs.
  function estimateJob(body) {
    const { n } = validateJob(body);
    const unitsPerWorker = WORK_UNITS[body.template](body);
    return {
      template: body.template,
      n,
      unitsPerWorker,
      customerMillicredits: unitsPerWorker * n * CUSTOMER_MILLICREDITS_PER_UNIT,
      perWorkerMillicredits: unitsPerWorker * WORKER_MILLICREDITS_PER_UNIT,
    };
  }

  let jobSeq = 0;

  async function runJob(body) {
    const { n, maxAttempts } = validateJob(body);
    const template = TEMPLATES[body.template];
    const unitsPerWorker = WORK_UNITS[body.template](body);
    jobSeq += 1;
    const jobId = `job-${jobSeq}`;

    const attempts = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const chosen = selectWorkers(n);
      const alpha = newMacKey(); // fresh MAC key per attempt
      const outcome = await template(body, chosen, alpha);
      recordAttempt(jobId, attempt, chosen, body.template, unitsPerWorker, outcome.verified);
      attempts.push({
        attempt,
        workers: chosen.map((w) => w.id),
        verified: outcome.verified,
        ...(outcome.verified ? {} : { reason: outcome.reason }),
      });
      if (outcome.verified) {
        return {
          ok: true,
          jobId,
          result: outcome.result,
          attempts,
          billing: {
            unitsPerWorker,
            workersPaid: n,
            customerMillicredits: unitsPerWorker * n * CUSTOMER_MILLICREDITS_PER_UNIT,
            perWorkerMillicredits: unitsPerWorker * WORKER_MILLICREDITS_PER_UNIT,
            rejectedAttemptsNotBilled: attempt - 1,
          },
        };
      }
      quarantine(chosen, outcome.reason);
    }
    return {
      ok: false,
      jobId,
      error: 'exhausted attempts without a verified result',
      attempts,
      billing: { customerMillicredits: 0, rejectedAttemptsNotBilled: attempts.length },
    };
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/workers/register') {
        const { id, url } = await readBody(req);
        if (!id || !url) return sendJson(res, 400, { error: 'id and url required' });
        regSeq += 1;
        workers.set(id, {
          id,
          url,
          quarantined: false,
          lastUsedSeq: 0,
          registeredSeq: regSeq,
        });
        return sendJson(res, 200, { registered: id });
      }
      if (req.method === 'GET' && req.url === '/workers') {
        return sendJson(res, 200, {
          workers: [...workers.values()].map(
            ({ id, url, quarantined, quarantineReason }) => ({
              id,
              url,
              quarantined,
              ...(quarantineReason ? { quarantineReason } : {}),
            }),
          ),
        });
      }
      if (req.method === 'POST' && req.url === '/jobs') {
        const body = await readBody(req);
        const outcome = await runJob(body);
        return sendJson(res, outcome.ok ? 200 : 502, outcome);
      }
      if (req.method === 'POST' && req.url === '/jobs/estimate') {
        return sendJson(res, 200, estimateJob(await readBody(req)));
      }
      if (req.method === 'GET' && req.url === '/ledger') {
        return sendJson(res, 200, ledgerSummary());
      }
      sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      sendJson(res, err.status ?? 500, { error: err.message });
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

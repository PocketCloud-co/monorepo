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
  async function runJob(body) {
    const template = TEMPLATES[body.template];
    if (!template) throw new Error(`unknown template ${body.template}`);
    const n = body.n ?? 3;
    const maxAttempts = body.maxAttempts ?? 3;

    const attempts = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const chosen = selectWorkers(n);
      const alpha = newMacKey(); // fresh MAC key per attempt
      const outcome = await template(body, chosen, alpha);
      attempts.push({
        attempt,
        workers: chosen.map((w) => w.id),
        verified: outcome.verified,
        ...(outcome.verified ? {} : { reason: outcome.reason }),
      });
      if (outcome.verified) {
        return { ok: true, result: outcome.result, attempts };
      }
      quarantine(chosen, outcome.reason);
    }
    return { ok: false, error: 'exhausted attempts without a verified result', attempts };
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
      sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

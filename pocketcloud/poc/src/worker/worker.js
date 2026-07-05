// Pocket Cloud host agent (PoC).
//
// A worker only ever receives SHARES — uniform-random field elements that
// carry no information about the customer's data — plus public constants
// (the model matrix in matvec, the opened d/e values in the Beaver online
// phase). It computes the requested kernel over its shares and returns
// result shares. It is stateless between requests.
//
// `tamper: true` simulates a malicious host: it perturbs its result share.
// Because it does not know the job's MAC key alpha, it cannot fix up the
// MAC share to match, and the verifier catches it (see coordinator.js).

import http from 'node:http';

import { add, mul, randomFieldElement, sub } from '../crypto/field.js';
import { readBody, s2mat, s2vec, sendJson, vec2s } from '../util/json.js';

function matVec(matrix, vector) {
  return matrix.map((row) =>
    row.reduce((acc, w, k) => add(acc, mul(w, vector[k])), 0n),
  );
}

function computeMatvec(payload, tamper) {
  const W = s2mat(payload.matrix);
  const xShare = s2vec(payload.xShare);
  const xMacShare = s2vec(payload.xMacShare);

  const yShare = matVec(W, xShare);
  const yMacShare = matVec(W, xMacShare);

  if (tamper) yShare[0] = add(yShare[0], randomFieldElement());

  return { yShare: vec2s(yShare), yMacShare: vec2s(yMacShare) };
}

// Beaver online phase 1: produce shares of the openings d = x - a and
// e = y - b, with their MAC shares so the openings themselves are checkable.
function computeDotPhase1(payload, tamper) {
  const x = s2vec(payload.xShare);
  const y = s2vec(payload.yShare);
  const xMac = s2vec(payload.xMacShare);
  const yMac = s2vec(payload.yMacShare);
  const a = s2vec(payload.aShare);
  const b = s2vec(payload.bShare);
  const aMac = s2vec(payload.aMacShare);
  const bMac = s2vec(payload.bMacShare);

  const dShare = x.map((xk, k) => sub(xk, a[k]));
  const eShare = y.map((yk, k) => sub(yk, b[k]));
  const dMacShare = xMac.map((mk, k) => sub(mk, aMac[k]));
  const eMacShare = yMac.map((mk, k) => sub(mk, bMac[k]));

  if (tamper) dShare[0] = add(dShare[0], randomFieldElement());

  return {
    dShare: vec2s(dShare),
    eShare: vec2s(eShare),
    dMacShare: vec2s(dMacShare),
    eMacShare: vec2s(eMacShare),
  };
}

// Beaver online phase 2: given the (verified) public openings d, e, combine
// triple shares into a share of the dot product sum_k x_k * y_k.
function computeDotPhase2(payload, tamper) {
  const d = s2vec(payload.d);
  const e = s2vec(payload.e);
  const a = s2vec(payload.aShare);
  const b = s2vec(payload.bShare);
  const c = s2vec(payload.cShare);
  const aMac = s2vec(payload.aMacShare);
  const bMac = s2vec(payload.bMacShare);
  const cMac = s2vec(payload.cMacShare);

  let zShare = 0n;
  let zMacShare = 0n;
  for (let k = 0; k < d.length; k++) {
    zShare = add(zShare, add(c[k], add(mul(d[k], b[k]), mul(e[k], a[k]))));
    zMacShare = add(
      zMacShare,
      add(cMac[k], add(mul(d[k], bMac[k]), mul(e[k], aMac[k]))),
    );
  }

  if (tamper) zShare = add(zShare, randomFieldElement());

  return { zShare: zShare.toString(), zMacShare: zMacShare.toString() };
}

const KERNELS = {
  matvec: computeMatvec,
  'dot-phase1': computeDotPhase1,
  'dot-phase2': computeDotPhase2,
};

export async function createWorker({
  id,
  port = 0,
  coordinatorUrl,
  tamper = false,
}) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/compute') {
        const body = await readBody(req);
        const kernel = KERNELS[body.template];
        if (!kernel) {
          return sendJson(res, 400, { error: `unknown template ${body.template}` });
        }
        return sendJson(res, 200, {
          workerId: id,
          ...kernel(body.payload, tamper),
        });
      }
      if (req.method === 'GET' && req.url === '/health') {
        return sendJson(res, 200, { workerId: id, ok: true });
      }
      sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  if (coordinatorUrl) {
    const res = await fetch(`${coordinatorUrl}/workers/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, url }),
    });
    if (!res.ok) throw new Error(`worker ${id} failed to register: ${res.status}`);
  }

  return {
    id,
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

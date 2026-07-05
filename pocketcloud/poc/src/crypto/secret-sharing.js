// Additive secret sharing with SPDZ-style information-theoretic MACs.
//
// A secret x in F_p is dealt to n workers as x = x_1 + ... + x_n (mod p),
// where x_1..x_{n-1} are uniform random. Any n-1 shares are jointly uniform
// random: they carry ZERO information about x (a one-time pad, not a
// hardness assumption).
//
// Integrity: alongside every secret x we deal a sharing of m = alpha * x,
// where alpha is a random MAC key held by the verifier, sampled fresh for
// each dispatch attempt. Linear operations are applied to both sharings. At reassembly the
// verifier checks  reconstruct(m) == alpha * reconstruct(x). A worker that
// perturbs its share of x by delta must perturb its MAC share by
// alpha * delta to stay consistent — but it does not know alpha, so it is
// caught except with probability 1/p (about 2^-61).

import { add, mul, randomFieldElement, randomVector, sub } from './field.js';

// Split one field element into n additive shares.
export function shareValue(x, n) {
  const shares = randomVector(n - 1);
  const last = shares.reduce((acc, s) => sub(acc, s), x);
  shares.push(last);
  return shares;
}

// Split a vector into n share-vectors. Returns perWorker[i] = bigint[].
export function shareVector(vec, n) {
  const perWorker = Array.from({ length: n }, () => []);
  for (const x of vec) {
    const shares = shareValue(x, n);
    for (let i = 0; i < n; i++) perWorker[i].push(shares[i]);
  }
  return perWorker;
}

export function reconstructVector(shareVectors) {
  const length = shareVectors[0].length;
  const out = new Array(length).fill(0n);
  for (const sv of shareVectors) {
    for (let k = 0; k < length; k++) out[k] = add(out[k], sv[k]);
  }
  return out;
}

export const newMacKey = () => randomFieldElement();

// Deal a vector together with its MAC sharing under key alpha.
// Returns perWorker[i] = { share: bigint[], mac: bigint[] }.
export function dealWithMac(vec, n, alpha) {
  const macVec = vec.map((x) => mul(alpha, x));
  const shares = shareVector(vec, n);
  const macShares = shareVector(macVec, n);
  return shares.map((share, i) => ({ share, mac: macShares[i] }));
}

// Check the MAC relation on reconstructed values.
export function verifyMac(values, macValues, alpha) {
  if (values.length !== macValues.length) return false;
  return values.every((v, k) => mul(alpha, v) === macValues[k]);
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dealTriples } from '../src/crypto/beaver.js';
import { decode, decodeVector, encode, encodeVector } from '../src/crypto/encoding.js';
import { P, add, mod, mul, randomFieldElement, sub } from '../src/crypto/field.js';
import {
  dealWithMac,
  newMacKey,
  reconstructVector,
  shareValue,
  shareVector,
  verifyMac,
} from '../src/crypto/secret-sharing.js';

test('field arithmetic wraps correctly', () => {
  assert.equal(add(P - 1n, 2n), 1n);
  assert.equal(sub(0n, 1n), P - 1n);
  assert.equal(mul(P - 1n, P - 1n), 1n); // (-1)^2 = 1
  assert.equal(mod(-1n), P - 1n);
});

test('random field elements are in range', () => {
  for (let i = 0; i < 1000; i++) {
    const v = randomFieldElement();
    assert.ok(v >= 0n && v < P);
  }
});

test('fixed-point encode/decode round trip, including negatives', () => {
  for (const x of [0, 1.5, -1.5, 3.14159, -2048.25, 0.0001]) {
    assert.ok(Math.abs(decode(encode(x)) - x) < 1e-4);
  }
});

test('product of encodings decodes at scale power 2', () => {
  const x = 3.25;
  const y = -2.5;
  assert.ok(Math.abs(decode(mul(encode(x), encode(y)), 2) - x * y) < 1e-3);
});

test('additive shares reconstruct the secret', () => {
  const secret = randomFieldElement();
  const shares = shareValue(secret, 5);
  assert.equal(shares.reduce((a, s) => add(a, s), 0n), secret);
});

test('any n-1 shares are independent of the secret (spot check)', () => {
  // Deal the SAME secret twice; the first n-1 shares of each dealing are
  // fresh uniform randomness, so they should (overwhelmingly) differ even
  // though the secret is identical — i.e. shares are not a function of the
  // secret. A full statistical test is out of scope for a PoC.
  const secret = 42n;
  const s1 = shareValue(secret, 3);
  const s2 = shareValue(secret, 3);
  assert.notDeepEqual(s1.slice(0, 2), s2.slice(0, 2));
});

test('vector sharing round trip', () => {
  const vec = encodeVector([1.5, -2.25, 100.0625]);
  const perWorker = shareVector(vec, 4);
  assert.deepEqual(reconstructVector(perWorker), vec);
  assert.deepEqual(decodeVector(vec), [1.5, -2.25, 100.0625]);
});

test('MAC verifies honest computation and catches tampering', () => {
  const alpha = newMacKey();
  const vec = encodeVector([7.5, -3.25]);
  const dealt = dealWithMac(vec, 3, alpha);

  const values = reconstructVector(dealt.map((d) => d.share));
  const macs = reconstructVector(dealt.map((d) => d.mac));
  assert.ok(verifyMac(values, macs, alpha));

  // Tamper with one worker's share of one value.
  dealt[1].share[0] = add(dealt[1].share[0], 1n);
  const bad = reconstructVector(dealt.map((d) => d.share));
  assert.ok(!verifyMac(bad, macs, alpha));
});

test('MAC is linear: W·x verifies from share-local computation', () => {
  const alpha = newMacKey();
  const W = [
    [encode(2), encode(-1)],
    [encode(0.5), encode(3)],
  ];
  const x = encodeVector([4, -2]);
  const dealt = dealWithMac(x, 3, alpha);

  const applyW = (v) =>
    W.map((row) => row.reduce((acc, w, k) => add(acc, mul(w, v[k])), 0n));

  const y = reconstructVector(dealt.map((d) => applyW(d.share)));
  const yMac = reconstructVector(dealt.map((d) => applyW(d.mac)));
  assert.ok(verifyMac(y, yMac, alpha));
  assert.deepEqual(
    decodeVector(y, 2).map((v) => Math.round(v * 1000) / 1000),
    [10, -4], // [2*4 + (-1)*(-2), 0.5*4 + 3*(-2)]
  );
});

test('Beaver triples satisfy c = a·b with valid MACs', () => {
  const alpha = newMacKey();
  const triples = dealTriples(4, 3, alpha);

  const a = reconstructVector(triples.map((t) => t.a.share));
  const b = reconstructVector(triples.map((t) => t.b.share));
  const c = reconstructVector(triples.map((t) => t.c.share));
  const cMac = reconstructVector(triples.map((t) => t.c.mac));

  for (let k = 0; k < 4; k++) assert.equal(c[k], mul(a[k], b[k]));
  assert.ok(verifyMac(c, cMac, alpha));
});

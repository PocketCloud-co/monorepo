// Golden-vector generator (DR-PF-01: the PoC is the reference of record).
//
// Emits DETERMINISTIC test vectors — fixed inputs, no RNG — so any production
// implementation (the Rust crate, CC-030) can assert byte-identical field
// results. Random-share generation can't be matched cross-language, but the
// deterministic math on given shares MUST be. Run:
//   node poc/tools/gen-golden.js > qa/golden/crypto/vectors.json

import { P, add, sub, mul, mod } from '../src/crypto/field.js';
import { encode, decode, SCALE } from '../src/crypto/encoding.js';
import {
  reconstructVector,
  verifyMac,
  dealWithMac,
} from '../src/crypto/secret-sharing.js';

// Deterministic field elements (no RNG): spread across the range incl. edges.
const SAMPLES = [0n, 1n, 2n, 7n, 65536n, P - 1n, P - 2n, (P - 1n) / 2n, 123456789n];

const fieldOps = [];
for (const a of SAMPLES) {
  for (const b of SAMPLES) {
    fieldOps.push({
      a: a.toString(),
      b: b.toString(),
      add: add(a, b).toString(),
      sub: sub(a, b).toString(),
      mul: mul(a, b).toString(),
    });
  }
}

// Fixed-point encode/decode round trips, incl. negatives and product scale.
const encodings = [0, 1, -1, 1.5, -2.25, 3.14159, -2048.0625, 100.5, 0.0001].map(
  (x) => ({
    x,
    encoded: encode(x).toString(),
    decoded1: decode(encode(x), 1),
  }),
);
const products = [
  [3.25, -2.5],
  [1.5, 4.0],
  [-1.25, -3.0],
].map(([x, y]) => ({
  x,
  y,
  encProduct: mul(encode(x), encode(y)).toString(),
  decoded2: decode(mul(encode(x), encode(y)), 2),
}));

// Given fixed additive shares (not random), reconstruction is deterministic.
const shareSets = [
  [[10n, 20n, 30n], [1n, 2n, 3n]],
  [[P - 5n, 3n, 4n], [100n, P - 50n, 7n]],
].map((vectors) => ({
  shares: vectors.map((v) => v.map((s) => s.toString())),
  reconstructed: reconstructVector(vectors).map((v) => v.toString()),
}));

// Given a FIXED alpha and fixed vector, MAC dealing is deterministic only in
// its relation, so we check the RELATION the verifier checks, not the shares:
// reconstruct(mac) == alpha * reconstruct(value). Emit a known-good and a
// tampered case.
const ALPHA = 777777n;
const value = [encode(5), encode(-3), encode(2.5)];
const dealt = dealWithMac(value, 3, ALPHA); // uses RNG internally, but we only
// export the reconstructed relation, which is RNG-independent:
const recVal = reconstructVector(dealt.map((d) => d.share));
const recMac = reconstructVector(dealt.map((d) => d.mac));
const macCases = {
  alpha: ALPHA.toString(),
  value: value.map((v) => v.toString()),
  reconstructedValue: recVal.map((v) => v.toString()),
  reconstructedMac: recMac.map((v) => v.toString()),
  honestVerifies: verifyMac(recVal, recMac, ALPHA),
  // tamper one value by +1; relation must now fail
  tamperedVerifies: verifyMac(
    recVal.map((v, i) => (i === 0 ? add(v, 1n) : v)),
    recMac,
    ALPHA,
  ),
};

// matvec on fixed shares: worker computes W (encoded) times a share vector.
const W = [
  [encode(2), encode(-1), encode(0.5)],
  [encode(1.5), encode(3), encode(-0.25)],
];
const xShareFixed = [encode(4), encode(-2), encode(8)];
const matvec = {
  matrix: W.map((row) => row.map((v) => v.toString())),
  xShare: xShareFixed.map((v) => v.toString()),
  yShare: W.map((row) =>
    row.reduce((acc, w, k) => add(acc, mul(w, xShareFixed[k])), 0n).toString(),
  ),
};

process.stdout.write(
  JSON.stringify(
    {
      meta: {
        note: 'Golden vectors from the Node PoC (DR-PF-01). Rust crate CC-030 must match byte-for-byte.',
        prime: P.toString(),
        scaleBits: 16,
        scale: SCALE.toString(),
      },
      fieldOps,
      encodings,
      products,
      shareSets,
      macCases,
      matvec,
    },
    null,
    2,
  ) + '\n',
);

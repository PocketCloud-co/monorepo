// Prime field arithmetic for the Pocket Cloud PoC.
//
// All secret sharing and MAC math happens in F_p with p = 2^61 - 1 (a
// Mersenne prime). 61 bits leaves ample headroom for fixed-point products
// (see encoding.js) while keeping every intermediate value a native BigInt
// operation. Production would use a 128-bit field; the protocol is identical.

import { randomBytes } from 'node:crypto';

export const P = (1n << 61n) - 1n;

export function mod(a) {
  const r = a % P;
  return r < 0n ? r + P : r;
}

export const add = (a, b) => mod(a + b);
export const sub = (a, b) => mod(a - b);
export const mul = (a, b) => mod(a * b);

// Uniform random field element via rejection sampling. Masking to 61 bits
// gives a uniform draw over [0, 2^61); the single value >= P (namely P
// itself) is rejected, so the result is uniform over [0, P).
export function randomFieldElement() {
  for (;;) {
    const v = randomBytes(8).readBigUInt64BE() & ((1n << 61n) - 1n);
    if (v < P) return v;
  }
}

export const randomVector = (length) =>
  Array.from({ length }, () => randomFieldElement());

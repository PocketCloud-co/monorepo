// Fixed-point encoding of real numbers into the prime field.
//
// Reals are scaled by 2^16 and rounded. A product of two encoded values is
// therefore scaled by 2^32 — the decoder takes the scale power so callers
// can decode linear results (power 2 after one multiplication level)
// without an interactive truncation protocol, which a PoC does not need.
// Negative numbers live in the top half of the field, exactly like two's
// complement.

import { P, mod } from './field.js';

export const SCALE_BITS = 16n;
export const SCALE = 1n << SCALE_BITS;

const HALF_P = P >> 1n;

export function encode(x) {
  if (!Number.isFinite(x)) throw new Error(`cannot encode ${x}`);
  return mod(BigInt(Math.round(x * Number(SCALE))));
}

export const encodeVector = (xs) => xs.map(encode);
export const encodeMatrix = (rows) => rows.map(encodeVector);

// scalePower: how many SCALE factors the value carries.
// 1 = raw encoded value, 2 = product of two encoded values, etc.
export function decode(v, scalePower = 1) {
  const centered = v > HALF_P ? v - P : v;
  return Number(centered) / Number(SCALE ** BigInt(scalePower));
}

export const decodeVector = (vs, scalePower = 1) =>
  vs.map((v) => decode(v, scalePower));

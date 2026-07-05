// Seeded, dependency-free PRNG for deterministic placement + property tests.
//
// The placement solver must be a PURE function of (job, devices, rng): given
// the same inputs and the same seed it emits the same placement, so a
// disputed placement decision can be replayed exactly (this is what the
// M4 transparency log — CP-012 — will need). The module itself NEVER calls
// Math.random() or Date.now(); all nondeterminism is threaded through an rng
// the caller supplies. Tests use this generator with fixed seeds.
//
// mulberry32: a small, well-distributed 32-bit generator. It is NOT a
// cryptographic PRNG and must never be used to sample shares, MAC keys, or
// any secret material — that is the crypto core's job (F_p rejection
// sampling). Its only job here is reproducible tie-breaking and fleet
// generation in tests.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle of a copy of `arr`, driven by `rng`. Deterministic
// for a given rng state.
export function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Uniform integer in [min, max] inclusive.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Uniform pick from a non-empty array.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Beaver multiplication triples.
//
// Secret x secret multiplication needs one precomputed triple (a, b, c)
// with c = a*b, dealt as MAC'd sharings. Online phase:
//   1. workers open d = x - a and e = y - b (both uniform random, so the
//      openings leak nothing about x or y); the verifier MAC-checks the
//      openings themselves — an incorrectly opened d is equivalent to
//      silently substituting a different input and MUST be caught here;
//   2. each worker computes z_i = c_i + d*b_i + e*a_i, and the same
//      combination on the MAC shares;
//   3. the verifier adds the public terms d*e (to z) and alpha*d*e (to the
//      MAC) at reconstruction, then checks mac == alpha * z.
//
// In this PoC the coordinator is the trusted dealer (the PRD's "managed
// mode", Phase 1). Distributed triple generation removes that trust later.

import { mul, randomFieldElement } from './field.js';
import { dealWithMac } from './secret-sharing.js';

// Generate `count` triples dealt to n workers under MAC key alpha.
// Returns perWorker[i] = { a: {share, mac}, b: {...}, c: {...} } where each
// share/mac is a vector of length `count` (one slot per multiplication).
export function dealTriples(count, n, alpha) {
  const a = Array.from({ length: count }, () => randomFieldElement());
  const b = Array.from({ length: count }, () => randomFieldElement());
  const c = a.map((ak, k) => mul(ak, b[k]));

  const aDealt = dealWithMac(a, n, alpha);
  const bDealt = dealWithMac(b, n, alpha);
  const cDealt = dealWithMac(c, n, alpha);

  return Array.from({ length: n }, (_, i) => ({
    a: aDealt[i],
    b: bDealt[i],
    c: cDealt[i],
  }));
}

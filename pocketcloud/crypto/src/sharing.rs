//! Additive secret sharing + SPDZ-style MACs (SPEC-001 §3, §4).
//!
//! `share(x, n)`: x = x_1 + ... + x_n, with x_1..x_{n-1} uniform. Any n-1
//! shares are jointly uniform (zero information). Integrity: every secret is
//! dealt alongside a sharing of alpha*x under a per-attempt MAC key alpha; a
//! worker that perturbs its share must also perturb its MAC share consistently
//! without knowing alpha — caught except with probability 1/p.
//!
//! `n >= 2` is a PRIVACY FLOOR (SPEC-001 §3, review finding 1): n = 1 makes the
//! single "share" the plaintext. Callers MUST enforce it; `share_value`
//! debug-asserts it.

use crate::field::Field;
use crate::rng::FieldRng;

/// Minimum share count — n = 1 would hand a worker the plaintext.
pub const MIN_SHARES: usize = 2;

/// Split one field element into `n` additive shares. `n >= MIN_SHARES`.
pub fn share_value<F: Field, R: FieldRng>(x: F, n: usize, rng: &mut R) -> Vec<F> {
    assert!(n >= MIN_SHARES, "n must be >= {MIN_SHARES} (privacy floor)");
    let mut shares: Vec<F> = (0..n - 1).map(|_| rng.next_field::<F>()).collect();
    let last = shares.iter().fold(x, |acc, s| acc.sub(*s));
    shares.push(last);
    shares
}

/// Split a vector into `n` share-vectors. `per_worker[i]` is worker i's shares.
pub fn share_vector<F: Field, R: FieldRng>(vec: &[F], n: usize, rng: &mut R) -> Vec<Vec<F>> {
    let mut per_worker: Vec<Vec<F>> = vec![Vec::with_capacity(vec.len()); n];
    for &x in vec {
        let shares = share_value(x, n, rng);
        for (i, s) in shares.into_iter().enumerate() {
            per_worker[i].push(s);
        }
    }
    per_worker
}

/// Reconstruct a vector by summing per-worker share-vectors element-wise.
pub fn reconstruct_vector<F: Field>(share_vectors: &[Vec<F>]) -> Vec<F> {
    assert!(!share_vectors.is_empty(), "need at least one share vector");
    let len = share_vectors[0].len();
    let mut out = vec![F::zero(); len];
    for sv in share_vectors {
        assert_eq!(sv.len(), len, "ragged share vectors");
        for (k, s) in sv.iter().enumerate() {
            out[k] = out[k].add(*s);
        }
    }
    out
}

/// A worker's share bundle for a MAC'd vector.
pub struct MacShare<F: Field> {
    /// Share of the value vector.
    pub share: Vec<F>,
    /// Share of alpha * value.
    pub mac: Vec<F>,
}

/// Deal a vector together with its MAC sharing under key `alpha`.
pub fn deal_with_mac<F: Field, R: FieldRng>(
    vec: &[F],
    n: usize,
    alpha: F,
    rng: &mut R,
) -> Vec<MacShare<F>> {
    let mac_vec: Vec<F> = vec.iter().map(|&x| alpha.mul(x)).collect();
    let shares = share_vector(vec, n, rng);
    let mac_shares = share_vector(&mac_vec, n, rng);
    shares
        .into_iter()
        .zip(mac_shares)
        .map(|(share, mac)| MacShare { share, mac })
        .collect()
}

/// Check the MAC relation on reconstructed values: mac[k] == alpha * value[k].
///
/// Constant-time over the *comparison* (accumulates all mismatches) so a
/// verifier does not leak which element failed via early exit.
pub fn verify_mac<F: Field>(values: &[F], mac_values: &[F], alpha: F) -> bool {
    if values.len() != mac_values.len() {
        return false;
    }
    let mut ok = true;
    for (v, m) in values.iter().zip(mac_values) {
        ok &= alpha.mul(*v) == *m;
    }
    ok
}

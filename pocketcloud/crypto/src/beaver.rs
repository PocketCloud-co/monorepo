//! Beaver multiplication triples (SPEC-001 §5).
//!
//! Secret x secret multiplication needs one precomputed triple (a, b, c=ab),
//! dealt as MAC'd sharings. v0 uses a trusted dealer (managed mode); distributed
//! generation is CC-060. The online phase (open d=x-a, e=y-b with MAC checks on
//! the openings, then combine) lives in the coordinator/verifier — this module
//! deals the triples.

use crate::field::Field;
use crate::rng::FieldRng;
use crate::sharing::{deal_with_mac, MacShare};

/// A worker's slice of `count` triples: shares of a, b, and c = a*b.
pub struct TripleShare<F: Field> {
    /// Shares (value+MAC) of the `a` vector.
    pub a: MacShare<F>,
    /// Shares (value+MAC) of the `b` vector.
    pub b: MacShare<F>,
    /// Shares (value+MAC) of the `c = a*b` vector.
    pub c: MacShare<F>,
}

/// Deal `count` triples to `n` workers under MAC key `alpha`.
pub fn deal_triples<F: Field, R: FieldRng>(
    count: usize,
    n: usize,
    alpha: F,
    rng: &mut R,
) -> Vec<TripleShare<F>> {
    let a: Vec<F> = (0..count).map(|_| rng.next_field::<F>()).collect();
    let b: Vec<F> = (0..count).map(|_| rng.next_field::<F>()).collect();
    let c: Vec<F> = a.iter().zip(&b).map(|(&ak, &bk)| ak.mul(bk)).collect();

    let a_dealt = deal_with_mac(&a, n, alpha, rng);
    let b_dealt = deal_with_mac(&b, n, alpha, rng);
    let c_dealt = deal_with_mac(&c, n, alpha, rng);

    a_dealt
        .into_iter()
        .zip(b_dealt)
        .zip(c_dealt)
        .map(|((a, b), c)| TripleShare { a, b, c })
        .collect()
}

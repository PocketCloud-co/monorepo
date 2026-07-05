//! Property-based tests (SPEC-001 QA; Standards §3 "required for all crypto
//! core math"). Uses the seedable test RNG (feature `test-rng`) so runs are
//! deterministic and reproducible without a third-party proptest dependency.

#![cfg(feature = "test-rng")]

use pocketcloud_crypto::beaver::deal_triples;
use pocketcloud_crypto::encoding::{decode, encode};
use pocketcloud_crypto::field::{Field, Mersenne61};
use pocketcloud_crypto::rng::{FieldRng, SeededRng};
use pocketcloud_crypto::sharing::{deal_with_mac, reconstruct_vector, share_value, verify_mac};

fn rng(seed: u64) -> SeededRng {
    SeededRng::new(seed)
}

#[test]
fn field_axioms() {
    let mut r = rng(1);
    for _ in 0..5000 {
        let a: Mersenne61 = r.next_field();
        let b: Mersenne61 = r.next_field();
        let c: Mersenne61 = r.next_field();
        // commutativity
        assert_eq!(a.add(b), b.add(a));
        assert_eq!(a.mul(b), b.mul(a));
        // associativity
        assert_eq!(a.add(b).add(c), a.add(b.add(c)));
        assert_eq!(a.mul(b).mul(c), a.mul(b.mul(c)));
        // distributivity
        assert_eq!(a.mul(b.add(c)), a.mul(b).add(a.mul(c)));
        // additive inverse via sub
        assert_eq!(a.sub(a), Mersenne61::zero());
        // identity
        assert_eq!(a.add(Mersenne61::zero()), a);
        assert_eq!(a.mul(Mersenne61::one()), a);
    }
}

#[test]
fn negative_one_squared_is_one() {
    let neg_one = Mersenne61::zero().sub(Mersenne61::one());
    assert_eq!(neg_one.mul(neg_one), Mersenne61::one());
}

#[test]
fn share_reconstruct_roundtrip_all_n() {
    let mut r = rng(2);
    for n in 2..=16 {
        for _ in 0..200 {
            let secret: Mersenne61 = r.next_field();
            let shares = share_value(secret, n, &mut r);
            assert_eq!(shares.len(), n);
            let recon = shares.iter().fold(Mersenne61::zero(), |a, s| a.add(*s));
            assert_eq!(recon, secret, "n={n}");
        }
    }
}

#[test]
fn shares_are_not_a_function_of_the_secret() {
    // Two independent dealings of the SAME secret differ in the first n-1
    // shares w.o.p. — i.e. shares carry fresh randomness, not the secret.
    let mut r = rng(3);
    let secret = Mersenne61::new(42);
    let s1 = share_value(secret, 3, &mut r);
    let s2 = share_value(secret, 3, &mut r);
    assert_ne!(&s1[..2], &s2[..2]);
}

#[test]
fn encoding_roundtrip_including_negatives() {
    for &x in &[0.0, 1.0, -1.0, 1.5, -2.25, 3.140625, -2048.0625, 0.5, -0.5] {
        let e: Mersenne61 = encode(x);
        assert!((decode(&e, 1) - x).abs() < 1e-4, "x={x}");
    }
}

#[test]
fn product_decodes_at_scale_power_2() {
    let mut r = rng(4);
    for _ in 0..1000 {
        // small reals so the fixed-point product stays exact-ish
        let x = (r.next_field::<Mersenne61>().value() % 200) as f64 / 8.0 - 12.0;
        let y = (r.next_field::<Mersenne61>().value() % 200) as f64 / 8.0 - 12.0;
        let ex: Mersenne61 = encode(x);
        let ey: Mersenne61 = encode(y);
        assert!((decode(&ex.mul(ey), 2) - x * y).abs() < 1e-2, "{x}*{y}");
    }
}

#[test]
fn mac_linearity_survives_linear_maps() {
    // Apply a random public matrix to a MAC'd vector via share-local compute;
    // the reconstructed result must still satisfy the MAC relation.
    let mut r = rng(5);
    for _ in 0..300 {
        let alpha: Mersenne61 = r.next_field();
        let x: Vec<Mersenne61> = (0..3)
            .map(|_| encode((r.next_field::<Mersenne61>().value() % 20) as f64))
            .collect();
        let dealt = deal_with_mac(&x, 4, alpha, &mut r);
        // public matrix W (2x3)
        let w: Vec<Vec<Mersenne61>> = (0..2)
            .map(|_| {
                (0..3)
                    .map(|_| encode((r.next_field::<Mersenne61>().value() % 5) as f64))
                    .collect()
            })
            .collect();
        let apply = |v: &[Mersenne61]| -> Vec<Mersenne61> {
            w.iter()
                .map(|row| {
                    row.iter()
                        .zip(v)
                        .fold(Mersenne61::zero(), |a, (wij, vj)| a.add(wij.mul(*vj)))
                })
                .collect()
        };
        let y = reconstruct_vector(&dealt.iter().map(|d| apply(&d.share)).collect::<Vec<_>>());
        let ymac = reconstruct_vector(&dealt.iter().map(|d| apply(&d.mac)).collect::<Vec<_>>());
        assert!(verify_mac(&y, &ymac, alpha), "MAC relation must survive W");
    }
}

#[test]
fn beaver_triples_satisfy_c_equals_ab() {
    let mut r = rng(6);
    let alpha: Mersenne61 = r.next_field();
    let triples = deal_triples::<Mersenne61, _>(8, 3, alpha, &mut r);
    let a = reconstruct_vector(
        &triples
            .iter()
            .map(|t| t.a.share.clone())
            .collect::<Vec<_>>(),
    );
    let b = reconstruct_vector(
        &triples
            .iter()
            .map(|t| t.b.share.clone())
            .collect::<Vec<_>>(),
    );
    let c = reconstruct_vector(
        &triples
            .iter()
            .map(|t| t.c.share.clone())
            .collect::<Vec<_>>(),
    );
    let cmac = reconstruct_vector(&triples.iter().map(|t| t.c.mac.clone()).collect::<Vec<_>>());
    for k in 0..8 {
        assert_eq!(c[k], a[k].mul(b[k]), "c must equal a*b");
    }
    assert!(verify_mac(&c, &cmac, alpha));
}

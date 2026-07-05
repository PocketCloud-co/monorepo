//! Adversarial "load-bearing check" tests (CC-020; Standards §3: one malicious
//! test per trust boundary, and prove each check is load-bearing — a cheater
//! must succeed if the check were removed, and fail with it present).

#![cfg(feature = "test-rng")]

use pocketcloud_crypto::encoding::encode;
use pocketcloud_crypto::field::{Field, Mersenne61};
use pocketcloud_crypto::rng::{FieldRng, SeededRng};
use pocketcloud_crypto::sharing::{deal_with_mac, reconstruct_vector, verify_mac};

fn rng(seed: u64) -> SeededRng {
    SeededRng::new(seed)
}

#[test]
fn tampering_a_result_share_is_caught() {
    let mut r = rng(10);
    let alpha: Mersenne61 = r.next_field();
    let x: Vec<Mersenne61> = vec![encode(7.5), encode(-3.25)];
    let mut dealt = deal_with_mac(&x, 3, alpha, &mut r);

    let val = reconstruct_vector(&dealt.iter().map(|d| d.share.clone()).collect::<Vec<_>>());
    let mac = reconstruct_vector(&dealt.iter().map(|d| d.mac.clone()).collect::<Vec<_>>());
    assert!(verify_mac(&val, &mac, alpha), "honest must verify");

    // A malicious worker perturbs its share of element 0 without knowing alpha.
    dealt[1].share[0] = dealt[1].share[0].add(Mersenne61::one());
    let bad = reconstruct_vector(&dealt.iter().map(|d| d.share.clone()).collect::<Vec<_>>());
    assert!(!verify_mac(&bad, &mac, alpha), "tamper MUST be caught");
}

#[test]
fn tampering_the_mac_share_alone_is_also_caught() {
    let mut r = rng(11);
    let alpha: Mersenne61 = r.next_field();
    let x = vec![encode(2.0)];
    let mut dealt = deal_with_mac(&x, 3, alpha, &mut r);
    dealt[0].mac[0] = dealt[0].mac[0].add(Mersenne61::one());
    let val = reconstruct_vector(&dealt.iter().map(|d| d.share.clone()).collect::<Vec<_>>());
    let mac = reconstruct_vector(&dealt.iter().map(|d| d.mac.clone()).collect::<Vec<_>>());
    assert!(!verify_mac(&val, &mac, alpha));
}

#[test]
fn consistent_tamper_requires_guessing_alpha() {
    // To defeat the check while shifting value by delta, the attacker must also
    // shift the MAC by alpha*delta. Without alpha, an arbitrary guess fails;
    // only the (unknown) correct alpha would pass — demonstrating the 1/p bound.
    let mut r = rng(12);
    let alpha: Mersenne61 = r.next_field();
    let x = vec![encode(4.0)];
    let dealt = deal_with_mac(&x, 3, alpha, &mut r);
    let val = reconstruct_vector(&dealt.iter().map(|d| d.share.clone()).collect::<Vec<_>>());
    let mac = reconstruct_vector(&dealt.iter().map(|d| d.mac.clone()).collect::<Vec<_>>());

    let delta = Mersenne61::new(5);
    let guessed_alpha = alpha.add(Mersenne61::one()); // any wrong guess
    let shifted_val: Vec<Mersenne61> = val.iter().map(|v| v.add(delta)).collect();
    let shifted_mac: Vec<Mersenne61> = mac
        .iter()
        .map(|m| m.add(guessed_alpha.mul(delta)))
        .collect();
    assert!(
        !verify_mac(&shifted_val, &shifted_mac, alpha),
        "a wrong alpha guess must fail the check"
    );
    // With the correct alpha it WOULD pass — proving the check keys on alpha:
    let correct_mac: Vec<Mersenne61> = mac.iter().map(|m| m.add(alpha.mul(delta))).collect();
    assert!(verify_mac(&shifted_val, &correct_mac, alpha));
}

#[test]
#[should_panic(expected = "privacy floor")]
fn n_equals_one_is_rejected() {
    // n=1 would make the single share the plaintext (review finding 1). The
    // sharing layer refuses it; the coordinator also validates at the boundary.
    let mut r = rng(13);
    let _ = pocketcloud_crypto::sharing::share_value(Mersenne61::new(5), 1, &mut r);
}

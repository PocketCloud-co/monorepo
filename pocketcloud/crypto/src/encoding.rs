//! Fixed-point encoding of reals into the field (SPEC-001 §2).
//!
//! Reals are scaled by 2^16 and rounded; negatives occupy the top half of the
//! field. A product of two encoded values carries scale power 2; the decoder
//! takes the scale power explicitly. Matches the Node PoC exactly.

use crate::field::Field;

/// Fixed-point scale bits (2^16). Matches the PoC.
pub const SCALE_BITS: u32 = 16;
/// Fixed-point scale factor.
pub const SCALE: i128 = 1i128 << SCALE_BITS;

/// Encode a real into the field: `round(x * 2^16) mod p`.
pub fn encode<F: Field>(x: f64) -> F {
    assert!(x.is_finite(), "cannot encode non-finite value");
    let scaled = (x * SCALE as f64).round() as i128;
    F::from_i128(scaled)
}

/// Decode a field element carrying `scale_power` scale factors back to a real.
pub fn decode<F: Field>(v: &F, scale_power: u32) -> f64 {
    let denom = (SCALE as f64).powi(scale_power as i32);
    v.centered() as f64 / denom
}

/// Encode a vector of reals.
pub fn encode_vec<F: Field>(xs: &[f64]) -> Vec<F> {
    xs.iter().map(|&x| encode(x)).collect()
}

/// Decode a vector at the given scale power.
pub fn decode_vec<F: Field>(vs: &[F], scale_power: u32) -> Vec<f64> {
    vs.iter().map(|v| decode(v, scale_power)).collect()
}

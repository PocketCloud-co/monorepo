//! Prime-field arithmetic (SPEC-001 §1).
//!
//! `Field` abstracts the modulus so the 128-bit production field (OQ-CC-01)
//! can be added later with zero changes to sharing/beaver. `Mersenne61`
//! (p = 2^61 - 1) is the v0 parity field matching the Node PoC.

use core::fmt::Debug;

/// A prime-field element type with the operations the protocol needs.
///
/// All secret-dependent arithmetic (`add`/`sub`/`mul`) is branch-free on the
/// value, so it does not leak the operands through timing (Standards §4 /
/// SPEC-001 constant-time note). `reduce` is the only value-dependent step and
/// operates on public-width integers.
pub trait Field: Copy + Clone + PartialEq + Eq + Debug {
    /// The prime modulus, as a big-endian decimal string (for diagnostics).
    fn modulus_decimal() -> &'static str;
    /// Stable identifier for the in-band `fieldId` wire tag (SPEC-001 §6).
    fn field_id() -> u32;

    /// The additive identity.
    fn zero() -> Self;
    /// The multiplicative identity.
    fn one() -> Self;

    /// Reduce an arbitrary integer (given as its canonical `u128` magnitude
    /// with a sign) into the field. Used for encoding.
    fn from_i128(v: i128) -> Self;
    /// Construct from an already-canonical decimal string (wire decode).
    fn from_decimal(s: &str) -> Result<Self, FieldError>;
    /// Canonical decimal representation (wire encode).
    fn to_decimal(&self) -> String;

    /// Field addition.
    fn add(self, other: Self) -> Self;
    /// Field subtraction.
    fn sub(self, other: Self) -> Self;
    /// Field multiplication.
    fn mul(self, other: Self) -> Self;
    /// The centered signed value in (-p/2, p/2], for fixed-point decode.
    fn centered(&self) -> i128;
}

/// Errors from field construction.
#[derive(Debug, PartialEq, Eq)]
pub enum FieldError {
    /// A decimal string was not a valid canonical field element.
    BadDecimal,
    /// A value was not in the canonical range [0, p).
    OutOfRange,
}

/// Stable field id for the Mersenne 2^61-1 v0 field.
pub const FIELD_ID_MERSENNE61: u32 = 61;

/// The v0 prime field, p = 2^61 - 1 (a Mersenne prime). Matches the Node PoC.
///
/// Representation invariant: `0 <= self.0 < P` always.
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub struct Mersenne61(u64);

/// p = 2^61 - 1.
pub const P61: u64 = (1u64 << 61) - 1;

impl Mersenne61 {
    /// Construct from a raw `u64`, reducing into canonical range.
    pub fn new(v: u64) -> Self {
        Mersenne61(reduce_u128(v as u128))
    }

    /// The raw canonical `u64` value.
    pub fn value(&self) -> u64 {
        self.0
    }
}

/// Reduce a full 128-bit product modulo p = 2^61 - 1 using Mersenne folding.
///
/// For p = 2^61 - 1, `x mod p` is computed by repeatedly folding the high bits
/// into the low 61 bits (since 2^61 ≡ 1 mod p), then a final conditional
/// subtract. Branch-free except the final canonicalization on public width.
#[inline]
fn reduce_u128(mut x: u128) -> u64 {
    const MASK: u128 = (1u128 << 61) - 1;
    // Fold twice: a 128-bit value needs at most two folds to land < 2^62.
    x = (x & MASK) + (x >> 61);
    x = (x & MASK) + (x >> 61);
    let mut r = x as u64;
    // r is now < 2^62; at most one subtract of p canonicalizes it.
    // Handle r == P (all-ones low 61 bits) -> 0 as well.
    if r >= P61 {
        r -= P61;
    }
    r
}

impl Field for Mersenne61 {
    fn modulus_decimal() -> &'static str {
        "2305843009213693951"
    }
    fn field_id() -> u32 {
        FIELD_ID_MERSENNE61
    }
    fn zero() -> Self {
        Mersenne61(0)
    }
    fn one() -> Self {
        Mersenne61(1)
    }

    fn from_i128(v: i128) -> Self {
        let p = P61 as i128;
        let m = ((v % p) + p) % p; // canonical non-negative residue
        Mersenne61(m as u64)
    }

    fn from_decimal(s: &str) -> Result<Self, FieldError> {
        let v: u64 = s.parse().map_err(|_| FieldError::BadDecimal)?;
        if v >= P61 {
            return Err(FieldError::OutOfRange);
        }
        Ok(Mersenne61(v))
    }

    fn to_decimal(&self) -> String {
        self.0.to_string()
    }

    #[inline]
    fn add(self, other: Self) -> Self {
        // a + b < 2^62, one conditional subtract canonicalizes.
        let mut r = self.0 + other.0;
        if r >= P61 {
            r -= P61;
        }
        Mersenne61(r)
    }

    #[inline]
    fn sub(self, other: Self) -> Self {
        // wrapping into [0, p): add p before subtract to stay non-negative.
        let r = self.0 + P61 - other.0;
        Mersenne61(if r >= P61 { r - P61 } else { r })
    }

    #[inline]
    fn mul(self, other: Self) -> Self {
        Mersenne61(reduce_u128(self.0 as u128 * other.0 as u128))
    }

    fn centered(&self) -> i128 {
        let half = (P61 >> 1) as i128; // floor(p/2)
        let v = self.0 as i128;
        if v > half {
            v - P61 as i128
        } else {
            v
        }
    }
}

//! Randomness (SPEC-001 §1, Standards §4).
//!
//! Production uses the OS CSPRNG. The `test-rng` feature adds a *seedable*
//! deterministic generator used only for golden-vector generation and property
//! tests — it is compiled OUT of release builds, because a predictable RNG
//! would break secret-sharing's secrecy (KEY-MANAGEMENT: bad randomness =
//! broken secrecy).

use crate::field::Field;

/// A source of uniform field elements.
pub trait FieldRng {
    /// Return a uniform random element of the field via rejection sampling.
    fn next_field<F: Field>(&mut self) -> F;
}

/// OS CSPRNG source (reads `/dev/urandom` on unix; no third-party deps).
pub struct OsRng;

impl OsRng {
    fn next_u64(&mut self) -> u64 {
        #[cfg(unix)]
        {
            use std::io::Read;
            let mut f = std::fs::File::open("/dev/urandom").expect("open /dev/urandom");
            let mut buf = [0u8; 8];
            f.read_exact(&mut buf).expect("read /dev/urandom");
            u64::from_be_bytes(buf)
        }
        #[cfg(not(unix))]
        {
            compile_error!("OsRng needs a platform CSPRNG binding on non-unix targets");
        }
    }
}

impl FieldRng for OsRng {
    fn next_field<F: Field>(&mut self) -> F {
        // Rejection-sample a 61-bit-masked draw for the Mersenne61 field.
        // Generic fields override the width via from_i128 canonicalization;
        // for the v0 field this matches the PoC's mask-and-reject.
        loop {
            let v = self.next_u64() & ((1u64 << 61) - 1);
            // For Mersenne61, P = 2^61 - 1: reject the single value == P.
            if (v as i128) < parse_modulus::<F>() {
                return F::from_i128(v as i128);
            }
        }
    }
}

fn parse_modulus<F: Field>() -> i128 {
    F::modulus_decimal().parse().expect("modulus decimal")
}

/// Deterministic seedable RNG for tests only (feature `test-rng`).
#[cfg(feature = "test-rng")]
pub struct SeededRng(u64);

#[cfg(feature = "test-rng")]
impl SeededRng {
    /// Create a seeded RNG.
    pub fn new(seed: u64) -> Self {
        SeededRng(seed.max(1))
    }
    fn next_u64(&mut self) -> u64 {
        // xorshift64* — deterministic, adequate for test vectors, never shipped.
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }
}

#[cfg(feature = "test-rng")]
impl FieldRng for SeededRng {
    fn next_field<F: Field>(&mut self) -> F {
        let modulus = parse_modulus::<F>();
        loop {
            let v = self.next_u64() & ((1u64 << 61) - 1);
            if (v as i128) < modulus {
                return F::from_i128(v as i128);
            }
        }
    }
}

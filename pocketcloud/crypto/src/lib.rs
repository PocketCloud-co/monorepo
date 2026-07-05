//! Pocket Cloud crypto core (SPEC-001).
//!
//! One audited implementation of the protocol primitives, shared by the
//! coordinator, agent, and SDK bindings (DR-CC-02). No novel cryptography
//! (DR-CC-01): additive secret sharing + SPDZ-style information-theoretic
//! MACs + Beaver triples over a prime field.
//!
//! Design for the one-way-door hedges (audit 2026-07-05):
//!   * `Field` is a trait so the production 128-bit field (OQ-CC-01) drops in
//!     without touching sharing/beaver logic — no flag-day.
//!   * `FIELD_ID` is exported for the in-band `fieldId` wire tag (SPEC-001 §6).
//!
//! v0 parity target: the Node PoC (`pocketcloud/poc`), field p = 2^61 - 1.
//! The golden-vector test (`tests/parity.rs`) asserts byte-identical results.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

pub mod beaver;
pub mod encoding;
pub mod field;
pub mod rng;
pub mod sharing;

pub use field::{Field, Mersenne61, FIELD_ID_MERSENNE61};

/// Protocol version this crate speaks on the wire (SPEC-001 §6 hedge).
pub const PROTO_VERSION: u32 = 1;

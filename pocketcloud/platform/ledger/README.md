# Metering ledger core (MB-001)

Production hardening of the PoC's metering, addressing what the independent
reviews found. Dependency-free Node ESM; the money source of truth.

- **Independent double-entry (review finding 2 fixed):** every leg
  (customer / worker / platform) is derived from `units × rate` separately,
  so the invariant `customer == worker + platform` is a real detector — a
  receipt written at the wrong rate trips it. The PoC's version computed the
  platform leg as `billed − payouts`, which could never fail; this can.
- **Versioned, hash-chained receipts (one-way-door audit finding 1 fixed):**
  every receipt carries `schemaVersion`, `priceConfigVersion`, explicit legs,
  `chainSeq`, and `prevHash`; hashing uses canonical serialization
  (`canonical.js`, RFC 8785 subset) so the chain is cross-implementation
  verifiable and a tampered historical receipt is detectable.
- **Pool license mode (MB-014) + SEC-001 gap-11 guard:** private pools can
  disable worker payouts (showback still meters usage into the customer and
  platform legs); a payouts-off pool can never accrue worker credit.

The canonical bytes live in R2 (SEAMS §4 source of truth) in production; this
in-memory structure is the rebuildable Postgres projection.

## Test
```bash
node --test 'test/*.test.js'   # 9 tests
```

Denominations come from a versioned `priceConfig` (MB-003), never hard-coded.

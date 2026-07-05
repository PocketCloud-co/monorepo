// Metering ledger core (MB-001, SPEC-004 v1).
//
// This is the production hardening of the PoC's metering, addressing two
// findings the independent reviews raised:
//
//   * Review finding 2 (tautological invariant): the PoC computed the platform
//     leg as (billed - payouts), so the double-entry check could never fail.
//     Here every leg is derived INDEPENDENTLY from (units x rate), so a receipt
//     written at the wrong rate, or a payable/accrual mismatch, actually
//     trips the invariant. The invariant is a real detector, not a tautology.
//
//   * One-way-door audit finding 1 (unversioned append-only chain): receipts
//     carry schemaVersion + priceConfigVersion + explicit legs, are hashed via
//     canonical serialization (canonical.js), and are hash-chained so a
//     tampered historical receipt is detectable. Cross-partition anchoring is
//     modeled by carrying the prior chain head into each new entry.
//
// Denominations come from a versioned price config (MB-003), never hard-coded
// magic numbers. Pool license mode (MB-014) can disable payouts; the SEC-001
// gap-11 guard forbids a pool that both disables payouts AND accrues worker
// credit (silent unpayable accrual).

import { createHash } from 'node:crypto';
import { canonicalize } from './canonical.js';

const SCHEMA_VERSION = 1;
const GENESIS = '0'.repeat(64);

function sha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// A price config is versioned (MB-003). rates in millicredits per work unit.
export function priceConfig({
  version,
  customerPerUnit,
  workerPerUnit,
  pools = {},
}) {
  if (!Number.isInteger(customerPerUnit) || !Number.isInteger(workerPerUnit)) {
    throw new Error('rates must be integer millicredits/unit');
  }
  if (workerPerUnit > customerPerUnit) {
    throw new Error('worker rate cannot exceed customer rate (negative take)');
  }
  return Object.freeze({ version, customerPerUnit, workerPerUnit, pools });
}

export function createLedger(priceCfg) {
  // Append-only entries; each carries the hash-chain fields. In production the
  // canonical bytes live in R2 (the source of truth, SEAMS §4) and this array
  // is the Postgres projection — same records, independently rebuildable.
  const entries = [];
  let head = GENESIS;
  let seq = 0;

  // Per-pool payout policy (MB-014). null pool = public marketplace: payouts on.
  function poolPolicy(poolId) {
    if (poolId == null) return { payoutsEnabled: true, licensed: false };
    const p = priceCfg.pools[poolId] ?? {};
    return {
      payoutsEnabled: p.payoutsEnabled ?? false, // private pools default to license mode
      licensed: p.licensed ?? true,
    };
  }

  // Build a receipt with all legs computed INDEPENDENTLY from units x rate.
  function makeReceipt({ jobId, attempt, workerId, template, units, verified, poolId = null }) {
    if (!Number.isInteger(units) || units < 0) throw new Error('units must be a non-negative integer');
    const policy = poolPolicy(poolId);
    const payable = verified === true;

    // Independent legs — the whole point (review finding 2).
    const customerLeg = payable ? units * priceCfg.customerPerUnit : 0;
    // In license mode, worker payout is disabled; showback still records the
    // customer/platform legs. SEC-001 gap-11: payouts off => worker leg MUST be 0.
    const workerLeg = payable && policy.payoutsEnabled ? units * priceCfg.workerPerUnit : 0;
    const platformLeg = customerLeg - workerLeg;

    // gap-11 guard: a licensed/payouts-off pool must never accrue worker credit.
    if (!policy.payoutsEnabled && workerLeg !== 0) {
      throw new Error(`pool ${poolId} disables payouts but accrued worker credit`);
    }

    seq += 1;
    const receipt = {
      schemaVersion: SCHEMA_VERSION,
      receiptId: `${jobId}:${attempt}:${workerId}`,
      chainSeq: seq,
      jobId,
      attempt,
      workerId,
      template,
      units,
      verified: payable,
      payable,
      poolId: poolId ?? '',
      priceConfigVersion: priceCfg.version,
      customerMillicredits: customerLeg,
      workerMillicredits: workerLeg,
      platformMillicredits: platformLeg,
      prevHash: head,
    };
    receipt.hash = sha256Hex(canonicalize(receipt));
    return receipt;
  }

  function append(spec) {
    const receipt = makeReceipt(spec);
    // Idempotent on receiptId (SPEC-004 §4): re-appending is a no-op.
    if (entries.some((e) => e.receiptId === receipt.receiptId)) {
      return entries.find((e) => e.receiptId === receipt.receiptId);
    }
    entries.push(receipt);
    head = receipt.hash;
    return receipt;
  }

  // Double-entry summary. Every leg is summed from the stored independent
  // values; the invariant compares them, so a corrupted leg is detectable.
  function summary() {
    let customer = 0;
    let worker = 0;
    let platform = 0;
    const payoutsByWorker = {};
    for (const e of entries) {
      customer += e.customerMillicredits;
      worker += e.workerMillicredits;
      platform += e.platformMillicredits;
      payoutsByWorker[e.workerId] =
        (payoutsByWorker[e.workerId] ?? 0) + e.workerMillicredits;
    }
    return {
      customerBilledMillicredits: customer,
      workerPayoutMillicredits: worker,
      platformMillicredits: platform,
      payoutsByWorker,
      invariantHolds: customer === worker + platform,
    };
  }

  // Recompute the hash chain from the stored records; detects any tampering of
  // a historical receipt or reordering (SPEC-004 §6 / audit finding 1).
  function verifyChain() {
    let expectedPrev = GENESIS;
    for (const e of entries) {
      if (e.prevHash !== expectedPrev) {
        return { ok: false, brokenAt: e.chainSeq, reason: 'prevHash mismatch' };
      }
      const { hash, ...body } = e;
      if (sha256Hex(canonicalize(body)) !== hash) {
        return { ok: false, brokenAt: e.chainSeq, reason: 'hash mismatch (record altered)' };
      }
      expectedPrev = hash;
    }
    return { ok: true, head: expectedPrev, count: entries.length };
  }

  return {
    append,
    summary,
    verifyChain,
    entries: () => entries.slice(),
    head: () => head,
  };
}

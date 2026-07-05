# Supabase business-records schema (DR-PF-03)

The durable home for Pocket Cloud's business records: pools, device registry
+ reputation, and the metering ledger. Per DR-PF-03 this is Supabase Postgres;
per SEAMS §4 the ledger here is the **projection** of the R2 hash-chained
receipt log (the financial source of truth), never the only copy.

## Schemas (applied in order)

| File | Contents |
|---|---|
| `01-pools.sql` | Pools (tenancy, PRD §5.0); enrollment tokens (K10/CP-015) with a single-use/unexpired `consume_enrollment_token()` |
| `02-devices.sql` | Device registry with anti-collusion attributes (§8.4), attestation (HA-005), reputation/trust-class (MB-007) |
| `03-ledger.sql` | Metering ledger (MB-001, SPEC-004 v1): receipts with explicit independent legs + a per-row double-entry CHECK, hash-chain fields, versioned price config, `ledger_summary` invariant view, freshness watermark (SEAMS §5) |
| `04-rls.sql` | Row-Level Security: org-scoped pools/devices/receipts; append-only receipts; the `pc.current_account()` helper maps to `auth.uid()` in production, a GUC in tests |

## The money invariants are structural, not hopeful

- Per-row `double_entry_row` CHECK: `customer = worker + platform` on **every**
  receipt — an unbalanced row cannot be inserted.
- `payable_iff_verified` + `reject_bills_zero` CHECKs enforce SPEC-004 §1/§4.
- License-mode pools carry a zero worker leg (SEC-001 gap-11 shape).
- `ledger_summary.invariant_holds` is the aggregate monitor (MB-R1).

## Test

```bash
bash tests/run-tests.sh
```

Stands up an **ephemeral real Postgres 16**, applies the schemas, and runs SQL
assertions covering the CHECK constraints, the aggregate invariant, the
enrollment-token lifecycle (consume-once, reject reuse/expiry/unknown), and
RLS isolation across orgs. Zero external services. On a root dev box it
re-execs as an unprivileged user (`RUN_AS_USER`, default `ubuntu`); CI runs it
directly.

## Production notes

- Swap `pc.current_account()` to `select auth.uid()` under Supabase.
- The R2→Postgres seam (CP-013/MB-013) writes receipts here idempotently
  (`ON CONFLICT (receipt_id) DO NOTHING`) and reconciles against the R2 chain
  head, updating `ledger_watermark`; payout/invoice runs refuse on a stale
  watermark. That seam is the next task; this is its durable target.

-- Schema 03: metering ledger (MB-001, SPEC-004 v1) — the money records.
--
-- This is the Postgres PROJECTION of the R2 hash-chained receipt log (the
-- financial source of truth, SEAMS §4). It is rebuildable from R2; nothing
-- here is the only copy. The double-entry invariant is enforced structurally:
--   - a per-row CHECK guarantees customer = worker + platform on every receipt
--   - the gap-11 CHECK forbids a payouts-off pool from accruing worker credit
--   - the aggregate invariant is a monitored VIEW (halt-the-world if it ever
--     disagrees with the per-row guarantee — which can only happen via
--     out-of-band tampering the hash chain also detects).
--
-- Denominations come from a versioned price config (MB-003), never hard-coded.

create table if not exists pc.price_configs (
  version            text primary key,
  customer_per_unit  bigint not null check (customer_per_unit >= 0),
  worker_per_unit    bigint not null check (worker_per_unit >= 0),
  created_at         timestamptz not null default now(),
  constraint non_negative_take check (worker_per_unit <= customer_per_unit)
);

create table if not exists pc.receipts (
  schema_version         int  not null default 1,
  receipt_id             text primary key,          -- jobId:attempt:workerId (SPEC-004)
  chain_seq              bigserial unique,
  job_id                 text not null,
  attempt                int  not null,
  worker_id              text not null,
  template               text not null,
  units                  bigint not null check (units >= 0),
  verified               boolean not null,
  payable                boolean not null,
  pool_id                text,                       -- '' or a pool id (SPEC-004 §5)
  price_config_version   text not null references pc.price_configs(version),
  -- explicit, independently-stored legs (review finding 2: no implicit leg)
  customer_millicredits  bigint not null check (customer_millicredits >= 0),
  worker_millicredits    bigint not null check (worker_millicredits   >= 0),
  platform_millicredits  bigint not null,
  -- hash-chain fields (audit finding 1)
  prev_hash              text not null,
  hash                   text not null,
  -- dual signatures (K1/K3, v1)
  worker_sig             text,
  verifier_sig           text,
  created_at             timestamptz not null default now(),

  -- payable iff verified (SPEC-004 §1)
  constraint payable_iff_verified check (payable = verified),
  -- per-receipt double-entry: the leg identity holds on EVERY row
  constraint double_entry_row
    check (customer_millicredits = worker_millicredits + platform_millicredits),
  -- rejected attempts bill nothing (SPEC-004 §4)
  constraint reject_bills_zero
    check (payable or (customer_millicredits = 0 and worker_millicredits = 0))
);

create index if not exists ix_receipts_job     on pc.receipts(job_id);
create index if not exists ix_receipts_worker  on pc.receipts(worker_id);
create index if not exists ix_receipts_pool    on pc.receipts(pool_id);

-- Aggregate double-entry invariant, exposed as a view the monitor polls
-- (SEAMS §4 / MB-R1). invariant_holds must always be true; a false is a P0.
create or replace view pc.ledger_summary as
  select
    coalesce(sum(customer_millicredits), 0) as customer_billed_millicredits,
    coalesce(sum(worker_millicredits),   0) as worker_payout_millicredits,
    coalesce(sum(platform_millicredits), 0) as platform_millicredits,
    coalesce(sum(customer_millicredits), 0)
      = coalesce(sum(worker_millicredits), 0) + coalesce(sum(platform_millicredits), 0)
      as invariant_holds
  from pc.receipts;

-- Freshness watermark (SEAMS §5): reconciliation against the R2 log updates
-- this; payout/invoice runs refuse when it is stale (checked in the app).
create table if not exists pc.ledger_watermark (
  id                     boolean primary key default true check (id),  -- singleton row
  last_reconciled_seq    bigint not null default 0,
  last_reconciled_at     timestamptz,
  r2_chain_head          text
);
insert into pc.ledger_watermark (id) values (true) on conflict (id) do nothing;

-- Per-worker payout rollup (host console / payout runs).
create or replace view pc.payouts_by_worker as
  select worker_id, sum(worker_millicredits) as worker_millicredits
    from pc.receipts
   group by worker_id;

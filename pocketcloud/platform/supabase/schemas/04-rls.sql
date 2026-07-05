-- Schema 04: Row-Level Security (Standards §4 "always enable RLS").
--
-- Access is scoped by ACCOUNT. In production the current account is the
-- Supabase JWT subject (auth.uid()); for standalone testing we read it from a
-- GUC so the same policies exercise without a Supabase auth context. The
-- helper isolates that one difference:
--   production: create the helper as `select auth.uid()`
--   standalone: `select current_setting('pc.current_account', true)::uuid`
-- The service role (backend workers) bypasses RLS as usual.

create or replace function pc.current_account()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('pc.current_account', true), '')::uuid;
$$;

-- Pools: an org sees and manages only its own pools.
alter table pc.pools enable row level security;
create policy pools_owner on pc.pools
  for all
  using (org_account = pc.current_account())
  with check (org_account = pc.current_account());

-- Enrollment tokens: visible only to the owning pool's org.
alter table pc.enrollment_tokens enable row level security;
create policy enrollment_tokens_org on pc.enrollment_tokens
  for all
  using (exists (
    select 1 from pc.pools p
     where p.id = enrollment_tokens.pool_id
       and p.org_account = pc.current_account()
  ));

-- Devices: an owner sees their own devices; a pool's org sees its pool fleet.
alter table pc.devices enable row level security;
create policy devices_owner on pc.devices
  for all
  using (
    owner_account = pc.current_account()
    or (pool_id is not null and exists (
      select 1 from pc.pools p
       where p.id = devices.pool_id
         and p.org_account = pc.current_account()
    ))
  );

-- Receipts: a worker's owner sees receipts for their devices; a pool's org
-- sees its pool's receipts. Receipts are append-only from the app's side —
-- no UPDATE/DELETE policy is granted to non-service roles, so authenticated
-- users get read-only access via the SELECT policy only.
alter table pc.receipts enable row level security;
create policy receipts_read on pc.receipts
  for select
  using (
    exists (
      select 1 from pc.devices d
       where d.id::text = receipts.worker_id
         and d.owner_account = pc.current_account()
    )
    or (receipts.pool_id <> '' and exists (
      select 1 from pc.pools p
       where p.id = receipts.pool_id
         and p.org_account = pc.current_account()
    ))
  );

-- Price configs and the watermark are platform-global read-only reference
-- data for authenticated users; only the service role writes them. RLS on
-- with a permissive read policy documents that intent.
alter table pc.price_configs enable row level security;
create policy price_configs_read on pc.price_configs for select using (true);

alter table pc.ledger_watermark enable row level security;
create policy ledger_watermark_read on pc.ledger_watermark for select using (true);

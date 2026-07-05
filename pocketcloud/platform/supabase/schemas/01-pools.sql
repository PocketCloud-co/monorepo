-- Pocket Cloud business records (DR-PF-03: Supabase Postgres).
-- Schema 01: pools + enrollment tokens (tenancy — PRD §5.0, F19/F20).
--
-- A pool is the unit of tenancy. poolId NULL = the public marketplace; a
-- concrete id = one org's private pool. Private pools may disable worker
-- payouts (license mode, MB-014); the ledger's gap-11 guard (SEC-001) forbids
-- a payouts-off pool from accruing worker credit.

create schema if not exists pc;

create table if not exists pc.pools (
  id              text primary key,          -- e.g. 'pool-acme'
  org_account     uuid not null,             -- owning organization account
  payouts_enabled boolean not null default false, -- private pools: license mode by default
  licensed        boolean not null default true,
  residency_cells text[] not null default '{}', -- allowed cells (empty = unconstrained)
  created_at      timestamptz not null default now()
);

comment on table pc.pools is 'Private compute pools (DR-08). NULL pool_id elsewhere means the public marketplace.';

-- Enrollment tokens (K10, CP-015): single-use, short-lived, pool-bound.
-- The lifecycle invariants (unexpired + unused at consume time) are enforced
-- by pc.consume_enrollment_token(); the table stores the state it checks.
create table if not exists pc.enrollment_tokens (
  id          uuid primary key default gen_random_uuid(),
  pool_id     text not null references pc.pools(id) on delete cascade,
  token_hash  text not null unique,          -- server stores only the hash (K10)
  expires_at  timestamptz not null,
  used_at     timestamptz,                   -- null until consumed (single-use)
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  constraint enrollment_token_lifetime
    check (expires_at > created_at)
);

create index if not exists ix_enrollment_tokens_pool on pc.enrollment_tokens(pool_id);

-- Consume a token: succeeds once, atomically, only while valid. Returns the
-- pool_id on success; raises on reused/expired/unknown token. `now_ts` is
-- passed in so tests are deterministic (no reliance on wall clock).
create or replace function pc.consume_enrollment_token(p_token_hash text, now_ts timestamptz)
returns text
language plpgsql
as $$
declare
  v_pool_id text;
begin
  update pc.enrollment_tokens
     set used_at = now_ts
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now_ts
  returning pool_id into v_pool_id;

  if v_pool_id is null then
    -- Distinguish the failure reasons for the caller / audit.
    if not exists (select 1 from pc.enrollment_tokens where token_hash = p_token_hash) then
      raise exception 'enrollment token unknown';
    elsif exists (select 1 from pc.enrollment_tokens where token_hash = p_token_hash and used_at is not null) then
      raise exception 'enrollment token already used (single-use)';
    else
      raise exception 'enrollment token expired';
    end if;
  end if;

  return v_pool_id;
end;
$$;

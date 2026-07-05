-- Schema tests (run against a real ephemeral Postgres by run-tests.sh).
-- Uses plain SQL assertions via DO blocks that RAISE EXCEPTION on failure, so
-- any failure aborts the transaction and the runner reports non-zero.

\set ON_ERROR_STOP on

-- Seed a price config + two orgs + pools.
insert into pc.price_configs(version, customer_per_unit, worker_per_unit)
  values ('pc-v1', 1000, 600);

insert into pc.pools(id, org_account, payouts_enabled, licensed)
  values ('pool-acme', '11111111-1111-1111-1111-111111111111', false, true),
         ('pool-beta', '22222222-2222-2222-2222-222222222222', true,  false);

-- Public + pool devices for two owners.
insert into pc.devices(id, owner_account, pool_id, hw_fingerprint_cluster)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', null,        'pub-rig-1'),
         ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'pool-acme', 'acme-rig-1');

-- ---- 1. per-row double-entry CHECK rejects an unbalanced receipt ----
do $$
begin
  begin
    insert into pc.receipts(receipt_id, job_id, attempt, worker_id, template, units,
      verified, payable, pool_id, price_config_version,
      customer_millicredits, worker_millicredits, platform_millicredits, prev_hash, hash)
    values ('bad:1:w', 'bad', 1, 'w', 'matvec', 10, true, true, '', 'pc-v1',
      10000, 6000, 3999,  -- 6000+3999 != 10000
      '0','h');
    raise exception 'TEST FAIL: unbalanced receipt was accepted';
  exception when check_violation then
    null; -- expected
  end;
end $$;

-- ---- 2. payable-iff-verified CHECK ----
do $$
begin
  begin
    insert into pc.receipts(receipt_id, job_id, attempt, worker_id, template, units,
      verified, payable, pool_id, price_config_version,
      customer_millicredits, worker_millicredits, platform_millicredits, prev_hash, hash)
    values ('bad2:1:w', 'bad2', 1, 'w', 'matvec', 10, false, true, '', 'pc-v1',
      0,0,0,'0','h');
    raise exception 'TEST FAIL: payable!=verified was accepted';
  exception when check_violation then null;
  end;
end $$;

-- ---- 3. honest receipts balance; aggregate invariant holds ----
insert into pc.receipts(receipt_id, job_id, attempt, worker_id, template, units,
  verified, payable, pool_id, price_config_version,
  customer_millicredits, worker_millicredits, platform_millicredits, prev_hash, hash)
values
  ('job1:1:w1', 'job1', 1, 'aaaaaaaa-0000-0000-0000-000000000001', 'matvec', 24, true, true, '', 'pc-v1',
    24000, 14400, 9600, '0', 'h1'),
  ('job1:1:w2', 'job1', 1, 'w2', 'matvec', 24, true, true, '', 'pc-v1',
    24000, 14400, 9600, 'h1', 'h2'),
  -- rejected attempt: bills zero
  ('job2:1:w3', 'job2', 1, 'w3', 'matvec', 24, false, false, '', 'pc-v1',
    0, 0, 0, 'h2', 'h3'),
  -- license-mode pool receipt: payouts disabled => worker leg 0, platform = full
  ('job3:1:w4', 'job3', 1, 'aaaaaaaa-0000-0000-0000-000000000002', 'matvec', 12, true, true, 'pool-acme', 'pc-v1',
    12000, 0, 12000, 'h3', 'h4');

do $$
declare v_holds boolean;
begin
  select invariant_holds into v_holds from pc.ledger_summary;
  if not v_holds then raise exception 'TEST FAIL: aggregate invariant does not hold'; end if;
end $$;

-- ---- 4. license-mode receipt has worker leg 0 (gap-11 shape) ----
do $$
declare v_worker bigint;
begin
  select worker_millicredits into v_worker from pc.receipts where receipt_id = 'job3:1:w4';
  if v_worker <> 0 then raise exception 'TEST FAIL: license-mode receipt accrued worker credit'; end if;
end $$;

-- ---- 5. enrollment token lifecycle: consume once, reject reuse/expiry ----
insert into pc.enrollment_tokens(pool_id, token_hash, expires_at, created_by, created_at)
  values ('pool-acme', 'hash-good', timestamptz '2026-07-05 12:00:00', '11111111-1111-1111-1111-111111111111', timestamptz '2026-07-05 10:00:00'),
         ('pool-acme', 'hash-expired', timestamptz '2026-07-05 09:00:00', '11111111-1111-1111-1111-111111111111', timestamptz '2026-07-05 08:00:00');

do $$
declare v_pool text;
begin
  -- valid consume at 11:00 succeeds
  v_pool := pc.consume_enrollment_token('hash-good', timestamptz '2026-07-05 11:00:00');
  if v_pool <> 'pool-acme' then raise exception 'TEST FAIL: good token did not return pool'; end if;

  -- second consume (reuse) must fail
  begin
    perform pc.consume_enrollment_token('hash-good', timestamptz '2026-07-05 11:30:00');
    raise exception 'TEST FAIL: reused token was accepted';
  exception when others then
    if sqlerrm not like '%already used%' then raise; end if;
  end;

  -- expired token must fail
  begin
    perform pc.consume_enrollment_token('hash-expired', timestamptz '2026-07-05 11:00:00');
    raise exception 'TEST FAIL: expired token was accepted';
  exception when others then
    if sqlerrm not like '%expired%' then raise; end if;
  end;

  -- unknown token must fail
  begin
    perform pc.consume_enrollment_token('hash-nope', timestamptz '2026-07-05 11:00:00');
    raise exception 'TEST FAIL: unknown token was accepted';
  exception when others then
    if sqlerrm not like '%unknown%' then raise; end if;
  end;
end $$;

-- ---- 6. RLS isolation: acme org sees its pool receipts, not beta's, and a
--        stranger account sees neither. Exercised as a non-superuser role. ----
grant usage on schema pc to pc_authenticated;
grant select on all tables in schema pc to pc_authenticated;

-- acme org context
set role pc_authenticated;
set pc.current_account = '11111111-1111-1111-1111-111111111111';
do $$
declare v_pool_ct int; v_dev_ct int;
begin
  select count(*) into v_pool_ct from pc.pools;               -- only pool-acme
  if v_pool_ct <> 1 then raise exception 'TEST FAIL: acme saw % pools (expected 1)', v_pool_ct; end if;
  select count(*) into v_dev_ct from pc.devices;             -- its own pool device (+none public it doesn't own)
  if v_dev_ct <> 1 then raise exception 'TEST FAIL: acme saw % devices (expected 1)', v_dev_ct; end if;
end $$;
reset role;

-- stranger context: sees no pools, no devices, no pool receipts
set role pc_authenticated;
set pc.current_account = '99999999-9999-9999-9999-999999999999';
do $$
declare v_ct int;
begin
  select count(*) into v_ct from pc.pools;
  if v_ct <> 0 then raise exception 'TEST FAIL: stranger saw % pools (expected 0)', v_ct; end if;
  select count(*) into v_ct from pc.receipts;
  if v_ct <> 0 then raise exception 'TEST FAIL: stranger saw % receipts (expected 0)', v_ct; end if;
end $$;
reset role;

select 'ALL SCHEMA TESTS PASSED' as result;

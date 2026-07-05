-- Schema 02: device registry + reputation (FT-02 CP-002, FT-05 MB-007).
--
-- Devices carry the anti-collusion attributes the placement solver keys on
-- (owner, payout, /24, ASN+city, hardware-fingerprint cluster — PRD §8.4) and
-- a pool binding (NULL = public marketplace). Reputation is history-derived
-- (uptime, verified-result rate, speed class) and feeds placement.

create table if not exists pc.devices (
  id                    uuid primary key default gen_random_uuid(),
  owner_account         uuid not null,
  payout_account        uuid,                 -- null until enrolled for payouts
  pool_id               text references pc.pools(id) on delete set null, -- null = public
  -- anti-collusion attributes (fail closed if any are null at placement time)
  ip24                  text,
  asn_city              text,
  hw_fingerprint_cluster text,
  -- attestation (HA-005) — the fingerprint signal the floor trusts must be attested
  attestation_verified  boolean not null default false,
  attested_at           timestamptz,
  -- reputation (MB-007), history-derived
  trust_class           text not null default 'probation'
                          check (trust_class in ('probation','standard','assured')),
  uptime_ratio          numeric(5,4) not null default 0 check (uptime_ratio between 0 and 1),
  verified_result_rate  numeric(5,4) not null default 1 check (verified_result_rate between 0 and 1),
  speed_class           int not null default 1 check (speed_class >= 0),
  quarantined           boolean not null default false,
  quarantine_reason     text,
  enrolled_at           timestamptz not null default now(),
  last_seen_at          timestamptz
);

create index if not exists ix_devices_owner   on pc.devices(owner_account);
create index if not exists ix_devices_payout  on pc.devices(payout_account);
create index if not exists ix_devices_pool     on pc.devices(pool_id);
create index if not exists ix_devices_cluster  on pc.devices(hw_fingerprint_cluster);
-- Sybil/cluster diversity queries hit these hard in placement.

comment on column pc.devices.pool_id is 'NULL = public marketplace supply; a value binds the device to one private pool (hard scoping, CP-014).';
comment on column pc.devices.trust_class is 'New devices start in probation — never sole holders of a share index (F15). Tier-W web agents stay probation (SEC-012).';

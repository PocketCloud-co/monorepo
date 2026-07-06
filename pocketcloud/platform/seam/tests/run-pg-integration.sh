#!/usr/bin/env bash
# Stand up an ephemeral local Postgres, apply the ledger schemas, then run the
# seam's producer->consumer path against the REAL pc.receipts schema
# (test/pg-integration.mjs). Proves idempotent upsert, S6 reconciliation, and
# rebuild-from-R2 hold against actual SQL + the double-entry CHECKs (MB-013).
# Zero external services. Exit non-zero on any failure.
#
# Postgres refuses to run as root, so when invoked as root we re-exec the whole
# body as an unprivileged user (RUN_AS_USER, default 'ubuntu'). In CI (non-root)
# it runs directly.
set -euo pipefail

RUN_AS_USER="${RUN_AS_USER:-ubuntu}"
if [ "$(id -u)" = "0" ]; then
  WORK="$(mktemp -d)"
  # Copy the whole pocketcloud tree so relative imports (ledger/canonical.js)
  # resolve exactly as in the repo.
  cp -r "$(cd "$(dirname "$0")/../../.." && pwd)" "$WORK/pocketcloud"
  chown -R "$RUN_AS_USER" "$WORK"
  exec runuser -u "$RUN_AS_USER" -- bash "$WORK/pocketcloud/platform/seam/tests/run-pg-integration.sh"
fi

# Postgres server binaries (initdb/pg_ctl) live in the versioned libdir on
# Debian/Ubuntu, not on PATH. psql is on PATH already.
if ! command -v initdb >/dev/null 2>&1; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "${PGBIN:-}" ]; then export PATH="$PGBIN:$PATH"; fi
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
SEAM="$(cd "$HERE/.." && pwd)"
SUPABASE="$(cd "$SEAM/../supabase" && pwd)"
BASE="$(mktemp -d)"
PGDATA="$BASE/pgdata"
SOCK="$BASE/sock"
PORT=54391
mkdir -p "$SOCK"
export PGDATA

cleanup() {
  pg_ctl -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$BASE" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> initdb"
initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null

echo "==> start postgres on :$PORT"
pg_ctl -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -w start >/dev/null

PSQL="psql -v ON_ERROR_STOP=1 -h $SOCK -p $PORT -U postgres -d postgres -q"

echo "==> create test role"
$PSQL -c "create role pc_authenticated nologin;" >/dev/null

echo "==> apply schemas"
for f in "$SUPABASE"/schemas/*.sql; do
  echo "    - $(basename "$f")"
  $PSQL -f "$f" >/dev/null
done

echo "==> run seam-vs-Postgres integration test"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER="postgres" PGDATABASE="postgres"
node "$SEAM/test/pg-integration.mjs"

echo "==> OK"

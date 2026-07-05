#!/usr/bin/env bash
# Stand up an ephemeral local Postgres, apply the schemas in order, create the
# non-superuser test role, run the SQL assertions, and tear everything down.
# Zero external services — proves the schema against a real Postgres (MB-001 /
# CP-002 durable home, DR-PF-03). Exit non-zero on any failure.
#
# Postgres refuses to run as root, so when invoked as root we re-exec the whole
# body as an unprivileged user (RUN_AS_USER, default 'ubuntu'). In CI (non-root)
# it runs directly.
set -euo pipefail

RUN_AS_USER="${RUN_AS_USER:-ubuntu}"
if [ "$(id -u)" = "0" ]; then
  WORK="$(mktemp -d)"
  cp -r "$(cd "$(dirname "$0")/.." && pwd)" "$WORK/supabase"
  chown -R "$RUN_AS_USER" "$WORK"
  exec runuser -u "$RUN_AS_USER" -- bash "$WORK/supabase/tests/run-tests.sh"
fi

# Postgres server binaries (initdb/pg_ctl) live in the versioned libdir on
# Debian/Ubuntu, not on PATH. psql/createdb are on PATH already.
if ! command -v initdb >/dev/null 2>&1; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "${PGBIN:-}" ]; then export PATH="$PGBIN:$PATH"; fi
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BASE="$(mktemp -d)"
PGDATA="$BASE/pgdata"
SOCK="$BASE/sock"
PORT=54390
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
for f in "$ROOT"/schemas/*.sql; do
  echo "    - $(basename "$f")"
  $PSQL -f "$f" >/dev/null
done

echo "==> run schema tests"
$PSQL -f "$HERE/schema.test.sql"

echo "==> OK"

#!/usr/bin/env bash
# Local DB checks: applies a Supabase stub + the 3 migrations + seed to a throwaway
# Postgres and runs RLS/RPC behaviour checks. Usage: PGHOST=... PGPORT=... tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
psql -q -U "${PGUSER:-postgres}" -c "drop database if exists hattori_test" -c "create database hattori_test"
for f in tests/db/00_supabase_stub.sql supabase/migrations/*.sql supabase/seed.sql; do
  psql -q -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}" -d hattori_test -f "$f"
done
psql -U "${PGUSER:-postgres}" -d hattori_test -f tests/db/99_checks.sql

#!/usr/bin/env bash
# Brings up local Postgres for dev. Prefers Docker Compose if available,
# falls back to a Homebrew-managed postgresql@16 install (this machine
# has no Docker, so the forge/forge_platform role+db were created directly
# via psql — see README.md "Local dev without Docker").
set -euo pipefail

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Starting Postgres via Docker Compose..."
  docker compose up -d
  exit 0
fi

echo "Docker not found — using Homebrew postgresql@16 instead."
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found either. Install Postgres 16 manually and set DATABASE_URL in .env." >&2
  exit 1
fi

brew services start postgresql@16 >/dev/null 2>&1 || true
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

for i in $(seq 1 10); do
  if pg_isready >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

psql -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname = 'forge'" | grep -q 1 || \
  psql -d postgres -c "CREATE ROLE forge WITH LOGIN PASSWORD 'forge_dev' CREATEDB;"

psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'forge_platform'" | grep -q 1 || \
  psql -d postgres -c "CREATE DATABASE forge_platform OWNER forge;"

echo "Postgres ready at postgresql://forge:forge_dev@localhost:5432/forge_platform"

#!/usr/bin/env bash
set -euo pipefail

# Quick E2E dry-run against local server (stubs if no provider creds)
# Prereqs: DB running and migrated; server dev up; workers up; RabbitMQ running

BASE_URL="${SEO_AGENT_BASE_URL:-http://localhost:5173}"
ORG_ID="${ORG_ID:-org-dev}"
NAME="${PROJ_NAME:-Acme Inc}"
SITE="${SITE_URL:-https://example.com}"
LOCALE="${LOCALE:-en-US}"

echo "[e2e] create website"
PROJ_ID=$(curl -sS -X POST -H 'content-type: application/json' \
  -d "{\"url\":\"$SITE\",\"defaultLocale\":\"$LOCALE\"}" \
  "$BASE_URL/api/websites" | jq -r '.website.id')
echo "website: $PROJ_ID"

echo "[e2e] generate keywords"
curl -sS -X POST -H 'content-type: application/json' -d "{\"websiteId\":\"$PROJ_ID\",\"locale\":\"$LOCALE\"}" \
  "$BASE_URL/api/keywords/generate" >/dev/null

echo "[e2e] create plan (30)"
curl -sS -X POST -H 'content-type: application/json' -d "{\"websiteId\":\"$PROJ_ID\",\"days\":30}" \
  "$BASE_URL/api/plan/create" >/dev/null || true

echo "[e2e] run daily schedule (drafts + queued generate)"
curl -sS -X POST -H 'content-type: application/json' -d "{\"websiteId\":\"$PROJ_ID\"}" \
  "$BASE_URL/api/schedules/run" | jq '.'

echo "[e2e] list keywords"
curl -sS "$BASE_URL/api/websites/$PROJ_ID/keywords?limit=5" | jq '.'

echo "[e2e] snapshot"
curl -sS "$BASE_URL/api/websites/$PROJ_ID/snapshot" | jq '.'

echo "[e2e] done"

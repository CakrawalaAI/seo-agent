#!/usr/bin/env bash
set -euo pipefail

# Quick E2E dry-run against local server (stubs if no provider creds)
# Prereqs: DB running and migrated; server dev up; workers up; RabbitMQ running

BASE_URL="${SEO_AGENT_BASE_URL:-http://localhost:5173}"
ORG_ID="${ORG_ID:-org-dev}"
NAME="${PROJ_NAME:-Acme Inc}"
SITE="${SITE_URL:-https://example.com}"
LOCALE="${LOCALE:-en-US}"

echo "[e2e] create project"
PROJ_ID=$(curl -sS -X POST -H 'content-type: application/json' \
  -d "{\"orgId\":\"$ORG_ID\",\"name\":\"$NAME\",\"siteUrl\":\"$SITE\",\"defaultLocale\":\"$LOCALE\"}" \
  "$BASE_URL/api/projects" | jq -r '.project.id')
echo "project: $PROJ_ID"

echo "[e2e] generate keywords (discovery)"
curl -sS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\",\"locale\":\"$LOCALE\"}" \
  "$BASE_URL/api/keywords/generate" >/dev/null

echo "[e2e] score prioritize"
curl -sS -X POST "$BASE_URL/api/projects/$PROJ_ID/score" >/dev/null

echo "[e2e] create plan (30)"
curl -sS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\",\"days\":30}" \
  "$BASE_URL/api/plan/create" >/dev/null || true

echo "[e2e] run daily schedule (drafts + queued generate)"
curl -sS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\"}" \
  "$BASE_URL/api/schedules/run" | jq '.'

echo "[e2e] list bundle files"
curl -sS "$BASE_URL/api/projects/$PROJ_ID/bundle" | jq '.files | .[0:20]'

echo "[e2e] done"


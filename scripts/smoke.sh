#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:5173}

echo "[smoke] GET /api/health"
curl -fsS "${BASE_URL}/api/health" | jq . >/dev/null || { echo "health failed"; exit 1; }

echo "[smoke] POST /api/auth/sign-in/social"
curl -fsS -X POST -H 'content-type: application/json' -d '{"provider":"google","callbackURL":"/dashboard"}' "${BASE_URL}/api/auth/sign-in/social" | jq . >/dev/null

echo "[smoke] end-to-end API flow (project→crawl→keywords→plan→schedule)"
PROJ_JSON=$(curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"orgId":"org-dev","name":"Smoke","siteUrl":"https://example.com","defaultLocale":"en-US"}' \
  "${BASE_URL}/api/projects")
PROJ_ID=$(echo "$PROJ_JSON" | jq -r '.project.id')
test -n "$PROJ_ID" || { echo "project create failed"; exit 1; }

curl -fsS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\"}" "${BASE_URL}/api/crawl/run" | jq . >/dev/null
curl -fsS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\",\"locale\":\"en-US\"}" "${BASE_URL}/api/keywords/generate" | jq . >/dev/null
curl -fsS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\",\"days\":30}" "${BASE_URL}/api/plan/create" | jq . >/dev/null
curl -fsS -X POST -H 'content-type: application/json' -d "{\"projectId\":\"$PROJ_ID\"}" "${BASE_URL}/api/schedules/run" | jq . >/dev/null

echo "[smoke] OK"

#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:5173}

echo "[smoke] GET /api/health"
curl -fsS "${BASE_URL}/api/health" | jq . >/dev/null || { echo "health failed"; exit 1; }

echo "[smoke] POST /api/auth/sign-in/social"
curl -fsS -X POST -H 'content-type: application/json' -d '{"provider":"google","callbackURL":"/dashboard"}' "${BASE_URL}/api/auth/sign-in/social" | jq . >/dev/null

echo "[smoke] OK"


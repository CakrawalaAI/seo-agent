SEO Agent — Generate Articles

Roles
- Planner (on demand): creates/refreshes the 30‑day runway of plan rows in `articles` (status=`queued`).
- Scheduler (daily): maintains a 3‑day buffer of full drafts and publishes due items. It does not create plan items.

Planner
- Input: `keywords` where `include=true`.
- Strategy: round‑robin by cluster with scoring (volume, difficulty, starred bias).
- Writes: one row per day (`scheduled_date`) into `articles` (no separate plan entity).
- API: `POST /api/plan-items { websiteId, days=30 }` enqueues/executes planning.

Scheduler (daily)
- Cadence: every 24h (config `SEOA_SCHEDULER_INTERVAL_MS`).
- Generate: For `scheduled_date` in [today..today+2] with `status=queued`, queue `generate`.
- Promote: After generate → set `status=scheduled` (keep `scheduled_date`).
- Publish: If `status=scheduled` and `scheduled_date<=today` and a connected `integrations` target exists → queue `publish`.
- First‑run: if no prior scheduled/published items and today has a queued item → generate then publish immediately.

Enrichment
- Generation embeds citations inline (References section), first YouTube video, and 1–2 Unsplash images by default. Review is post‑publish.
- Per‑website policy via `websites.settings_json`:
  - `allowYoutube` (default true)
  - `maxImages` (default 2, max 4)
- SERP snapshot caching:
  - In-DB per article: `keyword_serp` (single row per article)
  - Filesystem cache: `.data/serp-cache` (TTL per config)

Environment
- `UNSPLASH_ACCESS_KEY` required for image search.

Entitlements
- Per‑date gate: skip generate/publish if the subscription is inactive for that `scheduled_date`.

Deletions
- Removing a planned/scheduled row leaves that day empty; no automatic backfill.

SEO Agent — Workflow (End-to-End)

1) Onboard Website
- User inputs site URL → `websites` row created; `activeWebsiteId` cookie set.

2) Crawl
- Worker crawl: populate `crawl_pages`; reduce to `websites.summary`.
- Emits realtime crawl progress via websocket hub so dashboard bar updates.

3) Generate Keywords
- LLM → seeds(10) from `websites.summary`.
- DataForSEO `keyword_ideas/live` (limit 30, include_serp_info=false).
- Upsert rows into `keywords` with metrics columns.
- Broadcast keyword totals to dashboard once persisted.

4) Plan
- Build 30-day runway of `articles(status=queued)` from `keywords(include=true)`.
- Publish article progress (generated/scheduled counts) for dashboard timeline.

5) Generate
- Maintain 3-day buffer of `articles(status=scheduled)`.

6) Publish
- On/after scheduled date, publish scheduled article to connected integration.

Jobs
- `crawl` → `generateKeywords` → (optionally) `plan` → `generate` → `publish`.

Stateless
- All artifacts in Postgres; no filesystem bundles.

Realtime Dashboard
- API process hosts websocket hub unless `SEOA_REALTIME_DISABLE_SERVER=1`.
- Workers on separate hosts set `SEOA_REALTIME_ENDPOINT=https://api-host` to relay updates.
- Client connects via `/api/websites/:id/events`; `/progress` endpoint accepts relay POSTs.

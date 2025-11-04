SEO Agent — Workflow (End-to-End)

1) Onboard Website
- User inputs site URL → `websites` row created; `activeWebsiteId` cookie set.

2) Crawl
- Worker crawl: populate `crawl_pages`; reduce to `websites.summary`.

3) Generate Keywords
- LLM → seeds(10) from `websites.summary`.
- DataForSEO `keyword_ideas/live` (limit 30, include_serp_info=false).
- Upsert rows into `keywords` with metrics columns.

4) Plan
- Build 30-day runway of `articles(status=queued)` from `keywords(include=true)`.

5) Generate
- Maintain 3-day buffer of `articles(status=scheduled)`.

6) Publish
- On/after scheduled date, publish scheduled article to connected integration.

Jobs
- `crawl` → `generateKeywords` → (optionally) `plan` → `generate` → `publish`.

Stateless
- All artifacts in Postgres; no filesystem bundles.

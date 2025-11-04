SEO Agent — Generate Keywords (Per‑Website Only)

- Input: `websites.summary` → LLM seeds (10 terms).
- Provider call: DataForSEO Labs `keyword_ideas` endpoint (`src/common/providers/impl/dataforseo/keyword-ideas.ts`).
  - Only this endpoint is used; no “related”/“keywords_for_site” fallbacks.
  - Request payload: `{ keywords, location_code, language_code, limit }`.
- Output: rows in `keywords` with metrics in columns (no global cache).

Storage (keywords)
- Keys: `(website_id, phrase_norm, language_code, location_code)` unique.
- Columns: `phrase`, `phrase_norm`, `language_code`, `language_name`, `location_code`, `location_name`, `provider`,
  `include` (boolean), `starred` (0/1),
  `search_volume`, `cpc`, `competition`, `difficulty`, `vol_12m_json`, `impressions_json`, `raw_json`, `metrics_as_of`, timestamps.

Behavior
- Job name: `generateKeywords` (legacy name retired).
- No global caches. No TTL auto-refresh. Re-run is user-triggered only.
- SERP data not fetched here; retrieved later on article generation.
- `websites.status` → `keyword_generated` when rows exist.
- Planner consumes rows where `include=true`.

Mocking
- `src/common/providers/impl/mock/keyword-generator.ts` returns 100 deterministic, DataForSEO-shaped keyword records.
- Mock uses the same `KeywordIdeaItem` interface as the real client so the worker logic stays identical in dev/test.

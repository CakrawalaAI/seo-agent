SEO Agent — Generate Keywords (Per‑Website Only)

- Input: `websites.summary` → LLM seeds (10 terms).
- API: DataForSEO Labs expansion (ideas/related/site) with seeds (cost-optimized), include_serp_info=false.
- Output: rows in `website_keywords` with metrics in columns (no global cache).

Storage (website_keywords)
- Keys: `(website_id, phrase_norm, language_code, location_code)` unique.
- Columns: `phrase`, `phrase_norm`, `language_code`, `language_name`, `location_code`, `location_name`, `provider`,
  `include` (boolean), `starred` (0/1),
  `search_volume`, `cpc`, `competition`, `difficulty`, `vol_12m_json`, `impressions_json`, `raw_json`, `metrics_as_of`, timestamps.

Behavior
- No global caches. No TTL auto-refresh. Re-run is user-triggered only.
- SERP data not fetched here; retrieved later on article generation.
- `websites.status` → `keyword_generated` when rows exist.
- Planner consumes rows where `include=true`.

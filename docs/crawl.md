SEO Agent — Crawl

- Input: website URL (`websites.url`).
- Output:
  - Per-page records in `crawl_pages` with `content_text`, `headings_json`, `page_summary_json`.
  - Site summary in `websites.summary` (LLM map-reduce over top-N pages).
- Storage: Postgres only. No files/bundles. Deterministic IDs. Horizontal-safe.

Flow
- Parse sitemap (fallback to basic homepage crawl). Robots.txt is ignored by default (can be enabled later).
- Render pages (fetch or Playwright when needed).
- Map: summarize each page → `crawl_pages.page_summary_json`.
 - Reduce: aggregate N highest-signal pages → `websites.summary` (executive memo style: 2–4 short paragraphs + Key Facts lines).
- Record run in `crawl_jobs` with timing + providers.

Notes
- Only `content_text` is stored (no raw HTML).
- `websites.status`: moves to `crawled` on success.

# Keyword Generation Flow

Goal: generate high‑quality keyword candidates with metrics from a project’s crawl‑derived business context.

Inputs
- Project: `id`, `siteUrl`, `defaultLocale`
- Crawl pages: recent pages with `{ url, title, headingsJson, contentText }`
- Optional: LLM, DataForSEO, SERP provider credentials

System Defaults
- Crawl render: Playwright (fallback to fetch)
- Representatives: up to 100 URLs selected from sitemap
- Discovery limits: `llmSeedsMax=10`, `seedLimit=20`, `keywordLimit=100`
- Location: `2840` (United States), language from project locale
- Scheduler: daily, single leader via Postgres advisory lock

Flag
- `MOCK_KEYWORD_GENERATOR=1` → replace DataForSEO calls with deterministic top 50 keywords + metrics (development/offline mode)

End‑to‑End Steps
1) Crawl (worker job: `crawl`)
   - Parse sitemap → clean URLs
   - LLM ranks representative URLs (timeout fallback to first N)
   - Render each representative: Playwright → HTML → extract `{ title, headings, links, textDump }`
   - Persist crawl pages in DB
   - Summarize site context
     - Primary: `llm.summarizeWebsiteDump(siteUrl, bigDump)` with token budgeting
     - Fallback: JSON summarizer over first 50 pages
   - Project updated: `businessSummary`, `workflowState='pending_summary_approval'`

2) Discovery (worker job: `discovery`)
   - Preconditions: summary approved (or forced by API)
   - Inputs:
     - Pages: latest crawl pages (sampled: url, title, text)
     - Summary: business summary + topic clusters
   - Seeds (merged):
     - LLM generated seeds from topic clusters (max 10)
     - Headings‑derived phrases from crawl (`phrasesFromHeadings`, cap 50)
   - Provider expansion (two modes):
     - Real (default): DataForSEO
       - `keywords_for_keywords` on seed batch (plus suggestions for first seed)
     - Mock (`MOCK_KEYWORD_GENERATOR=1`): deterministic top 50 items
         - Shape per item:
           - `{ keyword: string, keyword_info: { search_volume: number, cpc: number, competition: number, last_updated_time: ISOString } }`
   - Candidate merge + dedupe:
     - Keep max search_volume per phrase
     - Filter against summary using domain heuristics
     - Sort by `search_volume` desc
     - Take top `keywordLimit` (default 100)
   - Difficulty metrics:
     - Real: `bulk_keyword_difficulty` (DataForSEO)
     - Mock: synthetic difficulty per index (low/medium/high cycle)
   - Persist:
     - `keywords` table (phrases)
     - `keyword_metrics` (searchVolume, difficulty, cpc, competition, asOf)
     - Canon map: `ensureCanon(phrase, language)` and link in DB
     - Discovery run record: providers used, counts, started/completed timestamps
   - Project updated: `workflowState='pending_keywords_approval'`

3) Downstream (score/plan/generate)
   - `score` prioritizes via rankability, competition, SERP mix
   - `plan` creates schedule window
   - `generate` drafts content (optional immediate publish if policy permits)

Provider Behavior
- Real mode requires `DATAFORSEO_AUTH`; failures log and safely continue where possible.
- LLM calls require `OPENAI_API_KEY`; stub summary used when stubs allowed.

Mock Keyword Example (3 of 50)
```json
[
  { "keyword": "mock keyword 1", "keyword_info": { "search_volume": 1000, "cpc": 1.5, "competition": 0.5, "last_updated_time": "2025-11-03T00:00:00.000Z" } },
  { "keyword": "mock keyword 2", "keyword_info": { "search_volume": 1100, "cpc": 1.5, "competition": 0.5, "last_updated_time": "2025-11-02T00:00:00.000Z" } },
  { "keyword": "mock keyword 3", "keyword_info": { "search_volume": 1200, "cpc": 1.5, "competition": 0.5, "last_updated_time": "2025-11-01T00:00:00.000Z" } }
]
```

Operational Notes
- Single worker consumes all job types from `seo.jobs` exchange
- Prefetch=1, retries=2 with exponential backoff
- IPv4‑first networking enforced for stability


Flow: Simple Sitemap → Top-100 → Crawl → Dump → Summary

- Input: site URL
- Fetch sitemap raw (index + child maps)
- Parse URLs; exclude non‑HTML; same host; dedupe
- LLM ranks the sitemap string; returns JSON `{"urls":[...]} (≤100)`
- Crawl only those URLs via Playwright (no link expansion)
- Dump: merge all page texts into one big string (no per‑page cap)
- LLM summarizes dump → single text field (business context)
- Persist to `projects.businessSummary`

Defaults
- `N = 100` fixed (if fewer eligible URLs, use all)
- Model: gpt-5-2025-08-07 by default (override with `SEOA_LLM_MODEL`)
- Budget: 80% of GPT‑5 (2025‑08‑07) 400k context → 320,000 input tokens
- Dump trimming: only at final step to fit the 320k token budget (no per‑page trimming)
- Playwright concurrency: 8, timeout/page: 12s

API/Artifacts
- Representatives written to bundle: `crawl/representatives.json` → `{ at, urls: [...] }`
- Dump written to bundle: `crawl/dump.top100.txt`
- Summary written to bundle: `summary/site_summary.json` → `{ businessSummary: "..." }`
- DB update: `projects.businessSummary = businessSummary`

Onboarding UI (live feedback)
- Step 1: “Process sitemap” → shows once `representatives.json` is produced
- Step 2: “Crawling your website” → progress uses `representatives.length` as target and pages completed from crawl feed
- Crawl feed: shows actual URLs as they complete (and while in‑progress)

Error Handling (simple)
- If LLM top‑100 selection fails → take first 100 cleaned sitemap URLs
- If Playwright fails for a URL → skip it; continue others; still summarize whatever was crawled
- If summary LLM fails → store first 2k chars of dump as placeholder in `projects.businessSummary`

Token Budgeting
- Estimate tokens ≈ `chars / 4`
- Before summary call, truncate dump to ≤ 320,000 tokens (≈ 1.28M chars)

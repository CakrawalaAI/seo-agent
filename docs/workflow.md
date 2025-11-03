# Background Workflows (Bundle Revamp)

This document tracks the two primary loops and their artifacts after the migration to bundle storage (November 2025).

## 0. Purpose
Keep the worker DAGs explicit and document which side effects land in Postgres versus `.data/bundle`.

## 1. Loops

### Init Loop (crawl → discovery → score → plan)
```
`/onboarding/ensure?site=<url>` → ensure project (org-scoped) + enqueue crawl
ProjectCreated / plan regenerate
  └─ publish(crawl.{project})
       └─ crawler worker
            • discover sitemap (Playwright fallback to fetch)
            • write crawl/pages.jsonl, crawl/link-graph.json
            • enqueue discovery
       └─ general worker (discovery)
            • summarize site (OpenAI)
            • expand keywords (DataForSEO + headings)
            • ensure canon + metrics (Postgres)
            • write keywords/seeds.jsonl, candidates.jsonl, enriched.jsonl
            • enqueue score
       └─ general worker (score)
            • prioritize clusters (keywordsRepo)
            • write keywords/prioritized.jsonl
            • enqueue plan rebuild when requested
```
- Plan rebuild (`POST /api/plan/create`) writes scheduled rows into `articles` with `status='draft'`.
- Snapshot endpoints read from bundle + DB.

### Daily Loop (generate → enrich → publish)
```
Cron (API / CLI) → publish(generate.{project})
  └─ general worker (generate)
        • planRepo.list upcoming drafts (articles)
        • ensure SERP snapshot via file cache (DataForSEO)
        • generate bodyHtml (OpenAI)
        • write articles/drafts/{id}.html
        • append jobs.jsonl
        • enqueue enrich
  └─ general worker (enrich)
        • gather internal links from bundle
        • fetch citations (Exa) & fact check (LLM)
        • write articles/drafts/{id}.json enrichment
        • enqueue publish when integration policy matches
```

## 2. Bundle Artifacts & Naming
- `crawl/pages.jsonl` — `CrawlPage` records (see `src/entities/crawl/domain/page.ts`).
- `crawl/link-graph.json` — { nodes, edges } for UI.
- `keywords/*.jsonl` — seeds, candidates, enriched, prioritized.
- `articles/drafts/{articleId}.html|json` — generated content and enrichment payloads.
- `logs/jobs.jsonl` — queue lifecycle entries.
- `logs/lineage.json` — optional DAG lineage for debugging.

## 3. Queues & Providers
- Exchange: `seo.jobs`
- Queues: `seo_jobs.crawler`, `seo_jobs.general`
- Providers resolved via `src/common/providers/registry.ts`. Stubs permitted when `config.providers.allowStubs === true`.

## 4. Local Dev Tips
- Run `bunx tsx scripts/db-reset.ts` followed by `bun test` to ensure schema/bundle parity.
- Use `scripts/inspect-project.ts` to print bundle-derived summaries.
- Delete `.data/` between runs for a clean slate.

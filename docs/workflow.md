# Workflow: Background Jobs & Loops (aligned with docs/spec.md)

## 0) Purpose
- Define two background loops: init (crawl→discovery→plan) and periodic (daily lazy generation→enrich→publish).
- Reuse existing queue/exchange, worker, and entities; add a DAG “recipe” without destructive changes.

## 1) Two Loops (high‑level)

Init loop (on project create or manual generate keywords/plan):
```
ProjectCreated / PlanRequested
  └─▶ crawl            # Playwright-first
        └─▶ discovery  # summarize + seeds + ensureMetrics (global, monthly) + scoring
               └─▶ plan # create 30 title+outline items
```

Periodic loop (daily or buffered cadence):
```
DailySchedule (cron or seo schedule run)
  └─▶ generate  # body for today’s PlanItems (lazy)
        ├─▶ enrich   # youtube, citations, internal links (opt-in; uses SERP/competitor slices)
        └─▶ publish  # policy: immediate | buffered | manual
```

Notes
- “Init loop” also runs when the user explicitly requests crawl/plan from CLI or Web.
- “Periodic loop” can run daily or every N days; buffer default: 3 days (see docs/spec.md §5.2).

## 2) DAG nodes (concise contracts)
- crawl (N1): input { projectId }; Playwright crawl (robots+sitemap), store CrawlPage rows + blobs.
- discovery (N2–N5): summarize site; seed keywords; provider expansion (DataForSEO) → candidates; ensureMetrics for current month (global); upsert ProjectKeyword rows linked to canon.
- score (N8): compute OpportunityScore; cluster by root phrase to avoid cannibalization; pick primary + secondary terms per topic.
  - writes: summary/site_summary.json, keywords/seeds.jsonl, keywords/prioritized.jsonl
  - writes: keywords/candidates.raw.jsonl
- serp (N6) [optional]: ensureSerp for top‑M; global cache TTL 7–14 days; optional monthly anchors.
- competitors (N7) [optional]: fetch competitor pages for top‑M; store dumps (project‑scoped).
  - writes: competitors/pages.jsonl (text dumps)
- plan (N9): create 30 PlanItems (title+outline), distributed over upcoming days.
  - writes: planning/plan_v1.json
- generate (N10): for today’s PlanItems, LLM bodyHtml; create/update Article(draft).
  - writes: articles/drafts/<id>.html
- enrich (N11) [optional]: citations, YouTube, internal links; update Article.mediaJson/seoScore.
  - writes: articles/drafts/<id>.json (citations, youtube, internal links, fact-check)
- publish (N12): publish via integration (Webhook/Webflow); update Article.url/status.
- feedback (N13) [optional]: GSC ingest; emit follow‑up tasks.

All nodes idempotent by (projectId, nodeName, inputsHash). Failures retried with backoff and DLQ.

## 3) Queue & orchestration (reuse existing infra)
- Exchange: `seo.jobs` (topic). Default queue today: `seo_jobs` (durable). See docs/spec.md §12 and src/common/infra/queue.ts.
- Recommended split:
  - Queue `seo_jobs.crawler` binds `crawl.*` (Playwright image)
  - Queue `seo_jobs.general` binds `discovery.* plan.* generate.* publish.* metrics.* serp.*`
- Routing keys: `${type}.${projectOrCanon}`; message: `{ id, type, payload, retries }`.
- Workers: dedicated crawler worker; general worker for the rest. Dispatch by `type`. Non‑destructive: can run as a single queue until split is adopted.
- New global job types: `metrics` (monthly keyword snapshots), `serp` (SERP snapshots).

Providers (interfaces)
- Keyword metrics: `KeywordMetricsProvider.ensureMonthly(canon, locationCode, YYYY-MM)` → DataForSEO Labs
- SERP: `SerpProvider.ensure({ canon, locationCode, device, topK })` → DataForSEO SERP Regular
- LLM: `LlmProvider` → OpenAI
- Research: `ResearchProvider` → Exa
- Crawler: `WebCrawler` → Playwright

Binding via `src/common/providers/registry.ts` to allow swapping implementations by env.

Manager (thin)
- Lives in API app (or small service). Listens to job completion events in DB (or emits after handler returns) and enqueues next node(s) per recipe.
- For v0, transitions are coded in API routes and worker processors (no extra runtime required).

Optional DAG recipe (YAML)
```
nodes:
  crawl:       { onSuccess: [discovery] }
  discovery:   { onSuccess: [plan] }
  plan:        { onSuccess: [] }
  generate:    { onSuccess: [enrich?] }
  enrich:      { onSuccess: [publish?] }
```
- Compiled by Manager to `publishJob({ type, payload })`. Flags decide optional nodes.

## 4) Triggers
- Project created or site registered → enqueue: crawl → discovery → plan. (docs/spec.md §5.1)
- CLI/Web “generate keywords/plan” → same chain (idempotent).
- Daily scheduler → `/api/schedules/run` per active project; enqueues `generate` (and optional `publish`) for today’s PlanItems (docs/spec.md §5.2, §12).
- Monthly scheduler (1st UTC) → enqueue `metrics` for all in‑use canonIds (global batch).

## 5) Portable artifacts (SEO Strategy Bundle v1)
```
/bundle/<projectId>/<timestamp>/
  crawl/        pages.jsonl, html/, markdown/, jsonld/
  summary/      site_summary.json
  keywords/     seeds.jsonl, candidates.*.jsonl, prioritized.jsonl
  serp/         <kwHash>.json              # SERP snapshots (global slice)
  competitors/  pages.jsonl
  planning/     plan_v1.json
  articles/     drafts/<id>.html, drafts/<id>.json, published/<id>.json
  metrics/      costs.json, gsc/<date>.json
  logs/         jobs.jsonl, lineage.json
```
- v0 can write a minimal subset (summary, keywords, plan, article drafts); expand over time.
- DB stores pointers; Web + CLI read from the same bundle paths.

## 6) Configuration (env)
- `RABBITMQ_URL`, `SEOA_EXCHANGE_NAME`, `SEOA_QUEUE_NAME`, `SEOA_DLX_NAME`.
- `RABBITMQ_PREFETCH`, `SEOA_PROJECT_CONCURRENCY`, `SEOA_JOB_MAX_RETRIES`, `SEOA_JOB_RETRY_DELAY_MS`, `SEOA_JOB_TTL_MS`.
- Crawl caps: `SEOA_CRAWL_BUDGET_PAGES`, `SEOA_CRAWL_MAX_DEPTH`, renderer `SEOA_CRAWL_RENDER=playwright|fetch`.
- SERP/competitors: `SEOA_TOP_M=50`, `SEOA_SERP_K=10`, SERP TTL 7–14 days; metrics refresh by calendar month.
- Publish policy: project setting `autoPublishPolicy = immediate|buffered|manual` (buffer default: 3 days).

## 7) Minimal acceptance (v0)
- Init loop: crawl→discovery→plan produces prioritized keywords and 30 PlanItems.
- Periodic loop: daily generate (draft) and publish per policy.
- Idempotent jobs; retries with DLQ; costs/timings logged.
- Web and CLI parity via the same API endpoints.

## 8) Global keyword model (canon + slices)
- Canon: `phrase_norm + language_code` (global identity)
- MetricsSnapshot (global slice): keyed by `(canonId, provider, location_code, as_of_month)`; refresh monthly
- SerpSnapshot (global slice): keyed by `(canonId, engine, location_code, device, top_k)`; TTL 7–14d; optional monthly anchor
- ProjectKeyword: per‑project link to `canonId` plus project fields (status, starred, opportunity)

API (manual overrides)
- `POST /api/keyword/refresh` → body { canonId|phrase+language, location_code, force?, what: 'metrics'|'serp'|'both' }
- `POST /api/serp/refresh` → body { canonId, location_code, device, topK, force? }

Feature placement (server functions)
- `src/features/keyword/server/ensureCanon.ts`
- `src/features/keyword/server/ensureMetrics.ts` (monthly)
- `src/features/serp/server/ensureSerp.ts`
- Workers call these; API routes optionally expose them for manual triggers.
 - Providers: `src/common/providers/interfaces/*`, `src/common/providers/impl/*`, `src/common/providers/registry.ts`

## 9) Integration with existing architecture (non‑destructive)
- Keep import boundaries (common→entities→features→blocks→pages→routes) per docs/spec.md §1.2.
- Reuse `seo.jobs` exchange and single durable queue; dispatch by `type` (no migration required).
- Map DAG to existing processors:
  - crawl → processors/crawler.ts
  - discovery (N2–N5,N8) → processors/discovery.ts
  - plan → processors/plan.ts
  - generate → processors/generate.ts
  - publish → processors/publish.ts
  - Optional: add processors for `serp`, `competitors`, `enrich`, `feedback` behind flags.
- Scheduling stays in `/api/schedules/run`; Manager logic remains minimal (enqueue next on success).
- Bundle writing can be added incrementally in processors without changing DB schemas.

This document complements docs/spec.md (§5 Core flows, §12 Worker & cron) by clarifying how the background loops and DAG fit into the current code paths without structural changes.

## 10) Boundaries & Rationale (decisions)
- SERP/Competitors placement
  - Default: run once in init after scoring (top‑M) to inform plan; cached with TTL.
  - Periodic: refresh lazily in `generate` if TTL expired; monthly anchor optional.
  - Why: cost containment + fresh enough grounding for generation.
- Worker split (crawler vs general)
  - Files: `src/worker/crawler.entry.ts`, `src/worker/general.entry.ts`, `src/common/infra/queue.ts`.
  - Why: Playwright needs Chromium deps, spikes RAM/CPU, anti‑bot tactics; isolate failures and scale independently; keep non‑crawl worker lean (bun‑only).
- Canon scope
  - Identity: `phrase_norm + language_code` (not location); file: `src/features/keyword/server/ensureCanon.ts`.
  - Metrics/SERP slices carry `location_code` (+ `device`, `topK`) and `as_of_month` (metrics) or `fetchedAt` (SERP). DB: `keyword_metrics_snapshot`, `serp_snapshot`.
  - Why: same phrase shared across projects; location affects snapshots, not identity; JP often unique by language but we still key snapshots by location for parity and future geo splits.
- Snapshot policy
  - Metrics: refresh per calendar month; keep history (one row/month). SERP: keep latest; optionally store monthly `anchorMonth`; TTL 7–14d for reuse.
  - Storage: keep cheap text dumps (`textDump`) for SERP/competitors/crawl; blobs optional; LLM‑only consumption.
- Cache hit/miss path
  - Metrics: `ensureMetrics()` → DB hit else DataForSEO → upsert; file: `src/features/keyword/server/ensureMetrics.ts`.
  - SERP: `ensureSerp()` → DB hit (TTL) else DataForSEO → upsert; file: `src/features/serp/server/ensureSerp.ts`.
  - Expand: `dataforseo keywords_for_keywords` first; de‑dupe with headings/LLM seeds.

## 11) ASCII: Sequences
Init
```
ProjectCreated → publish(crawl)
Worker(crawler) → crawl dump → DB+bundle
Worker(general) → discovery (LLM+expand+metrics) → score → plan
```

Periodic
```
Cron → /api/schedules/run → publish(generate)
Worker(general) → ensure SERP/competitors (TTL) → LLM body → enrich → publish(policy)
```

Notes
- Immediate policy: after generation, worker enqueues publish (if integration connected).
- Buffered policy: schedule-run publishes matured drafts only when buffer window satisfied and body present (>500 chars).

## 12) ASCII: ERD (keywords/SERP)
```
keyword_canon(id, phrase_norm, language_code)
  ├─< keyword_metrics_snapshot(canon_id, provider, location_code, as_of_month)
  └─< serp_snapshot(canon_id, engine, location_code, device, top_k, fetched_at, anchor_month?)

project_keywords(project_id, canon_id?, phrase, status, opportunity)
plan_items(project_id, keyword_id, date, title, outline)
articles(id, project_id, status, body_html, url)
```

## 13) Folder Map (tiny links)
- Queue/Manager: `src/common/infra/queue.ts`, `src/common/workflow/manager.ts`, `src/common/workflow/recipe.yaml`
- Providers: `src/common/providers/interfaces/*`, `src/common/providers/impl/dataforseo/*`, `src/common/providers/impl/openai/*`, `src/common/providers/impl/exa/*`
- Features(server): `src/features/keyword/server/ensureCanon.ts`, `src/features/keyword/server/ensureMetrics.ts`, `src/features/serp/server/ensureSerp.ts`
- Processors: `src/worker/processors/*`
- API routes: `src/app/routes/api/**`

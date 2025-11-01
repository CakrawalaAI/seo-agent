# Workflow: Background Jobs & Loops (aligned with docs/spec.md)

## 0) Purpose
- Define two background loops: init (crawl→discovery→plan) and periodic (daily lazy generation→enrich→publish).
- Reuse existing queue/exchange, worker, and entities; add a DAG “recipe” without destructive changes.

## 1) Two Loops (high‑level)

Init loop (on project create or manual generate keywords/plan):
```
ProjectCreated / PlanRequested
  └─▶ crawl            # sitemap→LLM select 5–10 reps → crawl only reps (ephemeral)
        └─▶ discovery  # summarize from in-memory page text → seeds (LLM+headings) → expand (DFS)
               └─▶ plan # create 30 Articles (status='draft'); titles+outlines only
```

Periodic loop (daily auto-generation):
```
DailySchedule (cron or seo schedule run)
  └─▶ generate  # body for Articles with planned_date in next 3 days (lazy)
        └─▶ publish  # auto-publish (no review gate); users can edit pre/post
```

Notes
- “Init loop” also runs when the user explicitly requests crawl/plan from CLI or Web.
- “Periodic loop” can run daily or every N days; buffer default: 3 days (see docs/spec.md §5.2).

## 2) DAG nodes (concise contracts)
- crawl (N1): input { projectId }; Playwright crawl (robots+sitemap), **ephemeral** processing (in-memory page text, no DB persistence).
- discovery (N2–N5): summarize site (LLM) → Keywords For Site (baseline) → LLM seeds (20–30) → Related Keywords + Keyword Ideas (expansion) → dedupe by canon → Bulk Keyword Difficulty (batch) → Keyword Overview (top 200) → ensureMetrics(month) → upsert project keywords + global metric_cache.
- score (N8): compute OpportunityScore; cluster by root phrase to avoid cannibalization; pick primary + secondary terms per topic.
  - writes: summary/site_summary.json, keywords/seeds.jsonl, keywords/prioritized.jsonl (debug only)
- serp (N6) [optional]: **ephemeral** SERP fetch on-demand during generation; not persisted in v0.
- competitors (N7) [optional]: **ephemeral** fetch competitor pages for context; not persisted in v0.
- plan (N9): create 30 Articles (status='draft') with title+outline, distributed over upcoming days.
  - DB: INSERT articles (project_id, keyword_id, planned_date, title, outline_json, status='draft')
- generate (N10): for Articles with planned_date in next 3 days, LLM bodyHtml.
  - DB: UPDATE articles SET body_html=$body, status='generating' → 'ready'
- enrich (N11) [optional]: citations, YouTube, internal links; update Article.mediaJson/seoScore.
- publish (N12): auto-publish via integration (Webhook/Webflow); update Article.url/status='published'.
- feedback (N13) [optional]: GSC ingest; emit follow‑up tasks.

Note: "writes" above refer to optional debug bundle files (only when `config.debug.writeBundle=true`). In production, workers process ephemerally. Only articles, keywords, and metric_cache persist in DB. No jobs, crawl_pages, or serp_snapshot tables.

All nodes idempotent by (projectId, nodeName, inputsHash). Failures retried with backoff and DLQ.

## 3) Queue & orchestration (reuse existing infra)
- Exchange: `seo.jobs` (topic). Default queue today: `seo_jobs` (durable). See docs/spec.md §12 and src/common/infra/queue.ts.
- Recommended split:
  - Queue `seo_jobs.crawler` binds `crawl.*` (Playwright image)
  - Queue `seo_jobs.general` binds `discovery.* plan.* generate.* publish.* metrics.* serp.*`
- Routing keys: `${type}.${projectOrCanon}`; message: `{ id, type, payload, retries }`.
- Workers: dedicated crawler worker; general worker for the rest. Dispatch by `type`. Non‑destructive: can run as a single queue until split is adopted.
- Global job types: `metrics` (monthly keyword metric refresh), `serp` (ephemeral SERP fetch for generation context).

Providers (interfaces)
- Keyword discovery: `KeywordDiscoveryProvider` → DataForSEO Labs (switch via `SEOA_PROVIDER_KEYWORD_DISCOVERY`)
  - keywordsForSite(domain, locationCode) → existing rankings
  - relatedKeywords(seeds[], locationCode, depth) → expansion
  - keywordIdeas(seeds[], locationCode) → category-based suggestions
- Keyword metrics: `KeywordMetricsProvider` → DataForSEO Labs
  - bulkKeywordDifficulty(phrases[], locationCode) → batch scoring
  - keywordOverview(phrases[], locationCode, includeClickstream?) → rich metrics
  - ensureMonthly(canon, locationCode, YYYY-MM) → monthly snapshot cache
- SERP: `SerpProvider.ensure({ canon, locationCode, device, topK })` → DataForSEO SERP Regular
- LLM: `LlmProvider` → OpenAI
- Research: `ResearchProvider` → Exa
- Crawler: `WebCrawler` → Playwright

Binding via `src/common/providers/registry.ts` to allow swapping implementations by env.

Manager (thin)
- Lives in worker processors. After task completion, enqueues next node(s) per recipe (crawl → discovery → plan; generate → publish).
- For v0, transitions are coded directly in worker processors (no extra runtime required). project.status tracks lifecycle (draft → crawling → crawled → keywords_ready → active).

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
- `src/features/keyword/server/ensureCanon.ts` (canonical identity)
- `src/features/keyword/server/discoverKeywords.ts` (multi-source discovery)
- `src/features/keyword/server/ensureMetrics.ts` (monthly snapshots)
- `src/features/keyword/server/computeOpportunity.ts` (scoring)
- `src/features/serp/server/ensureSerp.ts` (SERP snapshots)
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
  - Discovery flow: Keywords For Site (baseline) → LLM seeds → Related Keywords + Keyword Ideas (expansion) → dedupe by canon → Bulk Keyword Difficulty → Keyword Overview (top N).

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
- Credits: no DB usage gating; org_usage removed. Entitlements remain on orgs for display only.

Dev utilities
- Reset DB from scratch: `bun run db:reset` (drops schemas, re-runs migrations).
- Seed credits for dev org/user: `bunx tsx scripts/seed-credits.ts --email you@example.com --credits 100`.
- Debug bundles (optional): set `config.debug.writeBundle=true` to write lineage/cost files into `.data/bundle/`. Default is off (stateless workers, no files).

Production setup (checklist)
- Required env vars:
  - `APP_URL` (public base URL, e.g. https://app.example.com)
  - `SESSION_SECRET` (long random string for HMAC cookie signing)
  - `DATABASE_URL` (Postgres)
  - `RABBITMQ_URL` (AMQP)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth)
  - `OPENAI_API_KEY`
  - `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
  - `EXA_API_KEY`
  - `RESEND_API_KEY` and set `config.email.transport='resend'`
  - Polar (billing): `POLAR_ACCESS_TOKEN`, `POLAR_PRICE_POSTS_30`, `POLAR_SERVER` (api|sandbox)
- Admin endpoints:
  - Set `ADMIN_EMAILS` (comma-separated) to restrict `/api/admin/*` and global schedules (`/api/schedules/*` except project-scoped) to specific operators.
- App config:
  - In `src/common/config.ts`, set `providers.allowStubs=false`.
  - Adjust `serp.ttlDays`, `serp.topKDefault`, `crawl.maxRepresentatives`, `crawl.expandDepth` as needed.
- Health check:
  - `GET /api/health` returns readiness flags, `ok` boolean, and `reasons[]` if failing. In production, requires DB and RabbitMQ. When stubs are disabled, provider keys must be present. When email transport is `resend`, `RESEND_API_KEY` must be set.

Smoke test (local)
- Start infra: `docker compose up -d`
- Reset DB: `bun run db:reset`
- Run API/UI: `bun dev`
- Run workers: `bun run crawler` and `bun run worker`
- Verify health: `curl http://localhost:3000/api/health` → `ok: true`
- (Optional) Disable auth for local smoke: `E2E_NO_AUTH=1 bun dev`
- Create project (UI) with a valid URL; verify:
  - Job flow: crawl → discovery → score → plan (Jobs tab shows queued/running/completed)
  - Keywords tab: populated phrases with opportunities
  - Plan tab: 30-day calendar populated
- Trigger schedule: use UI “Run schedule now”; verify drafts generated and (if integration connected) publish jobs queued.
- CLI smokes:
  - Health only: `bun run smoke`
  - Create project and poll snapshot (E2E_NO_AUTH=1): `bun run smoke:project`

Smoke env vars
- `APP_URL` (base URL, default http://localhost:3000)
- `SMOKE_SITE_URL` (site to crawl, default https://example.com)
- `SMOKE_ORG_ID` (org id for project creation, default org-dev)
- `SMOKE_PROJECT_NAME` (optional project name)
- `SMOKE_TIMEOUT_MS` (poll timeout, default 180000)

## 12) ASCII: ERD (simplified schema)
```
keyword_canon(id, phrase_norm, language_code)
  └─< metric_cache(id, canon_id [UNIQUE], provider, metrics_json, fetched_at)  // 1:1 global cache

keywords(id, project_id, canon_id, status, starred)  // junction + rotation control

articles(id, project_id, keyword_id, planned_date, title, outline_json, body_html, status, publish_date, url)
  // status: draft → generating → ready → published

article_attachments(id, article_id, type, url, caption, order)

Removed (ephemeral or merged):
  ✗ serp_snapshot (ephemeral - fetched on-demand, not persisted)
  ✗ plan_items (merged into articles table)
  ✗ jobs (RabbitMQ queue state only)
  ✗ crawl_pages (ephemeral - in-memory processing)
```

## 13) Folder Map (tiny links)
- Queue/Manager: `src/common/infra/queue.ts`, `src/common/workflow/manager.ts`, `src/common/workflow/recipe.yaml`
- Providers: `src/common/providers/interfaces/*`, `src/common/providers/impl/dataforseo/*`, `src/common/providers/impl/openai/*`, `src/common/providers/impl/exa/*`
- Features(server): `src/features/keyword/server/ensureCanon.ts`, `src/features/keyword/server/ensureMetrics.ts`, `src/features/serp/server/ensureSerp.ts`
- Processors: `src/worker/processors/*`
- API routes: `src/app/routes/api/**`

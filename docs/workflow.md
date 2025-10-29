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
- discovery (N2–N5,N8): summarize site; seed keywords; ensureMetrics for current month (global); compute opportunity; upsert ProjectKeyword rows linked to canon.
- serp (N6) [optional]: ensureSerp for top‑M; global cache TTL 7–14 days; optional monthly anchors.
- competitors (N7) [optional]: fetch competitor pages for top‑M; store dumps (project‑scoped).
- plan (N9): create 30 PlanItems (title+outline), distributed over upcoming days.
- generate (N10): for today’s PlanItems, LLM bodyHtml; create/update Article(draft).
- enrich (N11) [optional]: citations, YouTube, internal links; update Article.mediaJson/seoScore.
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

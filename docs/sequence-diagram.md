# SEO Agent – Sequence Overview (Bundle Architecture)

This document aligns the user journeys with the bundle-backed workflow introduced in November 2025. All long-running state is recorded in RabbitMQ and `.data/bundle`, while the database stores durable references only.

## Actors
- **User (web/CLI)**
- **HTTP API** (`@tanstack/react-router` file routes)
- **RabbitMQ** (`seo.jobs` exchange with `seo_jobs.crawler` & `seo_jobs.general` queues)
- **Workers** (`crawler`, `general` processors)
- **External Providers** (Playwright, DataForSEO, OpenAI, Exa, CMS)
- **Bundle Store** (`.data/bundle/{projectId}`)
- **Postgres** (core tables described in ERD)

## Flow A – Project Onboarding → Keyword Plan
```
User              API            Postgres          RabbitMQ          Worker (crawler)         Bundle Store
 |  POST /api/projects  ->  INSERT projects/org if missing  ------------------------------>  (enqueue crawl job)
 |  202 Accepted <------------------------------------------ publish(crawl.{project})
 |  Poll snapshot (GET /api/projects/:id/snapshot) --------> SELECT projects + read bundle summary
 |                                                                                         startRun(project)
 |                                                                                         write crawl/pages.jsonl
 |                                                                                         write crawl/link-graph.json
 |                                                                                         publish(discovery.{project})
 |                                                                Worker (general)
 |                                                                - read crawl bundle
 |                                                                - summarize via LLM
 |                                                                - discover keywords (DataForSEO)
 |                                                                - ensure canon/metrics (Postgres)
 |                                                                - write keywords/*.jsonl
 |                                                                - publish(score.{project})
```

`/api/projects/:id/snapshot` now aggregates:
- queue depth from `logs/jobs.jsonl`
- plan items from `articles` (`status='draft'` for scheduled entries)
- crawl pages via bundle
- latest discovery summary (`summary/site_summary.json`)

## Flow B – Daily Generation & Publishing
```
Cron/User -> POST /api/schedules/run ---------------------------> enqueue(generate.{project})
Worker (general)
  - planRepo.list(project) (articles table)
  - promote draft -> outline -> body via OpenAI
  - ensure SERP context (file cache, DataForSEO)
  - write articles/drafts/{id}.html/json
  - record jobs.jsonl event(s)
  - publish(enrich.{project})
Worker (general – enrich)
  - read crawl bundle for internal links
  - run Exa for citations
  - write articles/drafts/{id}.json enrichment
  - optionally publish via project_integrations
```

All job transitions append to `.data/bundle/{project}/logs/jobs.jsonl`, which powers `/api/projects/:id/jobs`.

## Flow C – Snapshot APIs
- **`GET /api/crawl/pages`**: reads `pages.jsonl` and filters client-side; DB authentication skipped in test mode (`E2E_NO_AUTH`).
- **`GET /api/projects/:id/link-graph`**: serves `crawl/link-graph.json` nodes/edges.
- **`GET /api/projects/:id/snapshot`**: combines:
  - Plan items from `articles` (status `'draft'`)
  - Integrations from `project_integrations`
  - Keywords via `keywordsRepo.list`
  - Crawl pages, representatives, discovery summary from bundle
  - Queue depth from `logs/jobs.jsonl`

## Error Handling & Observability
- Workers append lineage (`logs/lineage.json`) per node run.
- Job log JSONL includes status transitions (`queued`, `running`, `completed`, `failed`).
- Providers expose stubs unless `config.providers.allowStubs === false`; third-party failures log to bundle and job log.

## Removal of Legacy Queues
The previous database-backed `jobs`, `crawl_pages`, `link_graph`, and `serp_snapshot` tables have been deprecated. Any components that still query them should be migrated to the bundle helpers in `@entities/crawl/repository` or `@common/infra/jobs`.

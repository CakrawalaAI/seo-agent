0. Product
-----------
**Name:** SEO Agent
**Goal:** From a website URL, crawl representative pages, generate a 30‑day content plan, lazily author full articles, and auto-publish through configured CMS integrations.

### Architecture Snapshot (Nov 2025)
- **Runtime:** TanStack Start (React Router) + Bun workers.
- **Persistence:** PostgreSQL (9 core tables) + bundle filesystem (`.data/bundle/{projectId}`) for crawl/queue artifacts.
- **Queues:** RabbitMQ (`seo.jobs` topic exchange).
- **Providers:** Playwright (crawl), DataForSEO (keywords/metrics/SERP), OpenAI (LLM), Exa (research), CMS drivers (webhook, Webflow).

### Directory Roles
- `src/common` – infra utilities (HTTP, session, queue, bundle store, provider registry).
- `src/entities/*` – domain models + repository facades (DB + bundle access).
- `src/features/*` – UI + server logic per feature.
- `src/blocks` – composed UI.
- `src/pages/*` & `src/app/routes/*` – loader/controller + TanStack route definitions.
- `src/worker` – worker entrypoints & processors.
- `tests` – Vitest & Playwright definitions.

1. System Architecture
-----------------------
### Data
- See `docs/erd.md` for full table list.
- Bundle store is authoritative for crawl traces, job history, keyword derivations, and generated article assets.

### Auth
- Google OAuth via server-side code exchange.
- Stateless session cookie (`seoa_session`, signed). `E2E_NO_AUTH=1` bypasses guards in tests.

### Workflow
1. **Project create** → enqueue `crawl.{projectId}`.
2. **Crawler worker** writes bundle outputs and queues discovery.
3. **Discovery worker** enriches keywords, metrics, and writes bundle artifacts; updates Postgres `keywords` & `metric_cache`.
4. **Score/Plan** produce prioritized topic list and plan drafts in `articles`.
5. **Schedule** runs daily, enqueuing `generate` for drafts within buffer window.
6. **Generate/Enrich** produce body HTML, enrichment JSON, and optionally publish via integrations.
7. **Snapshot APIs** read from DB + bundle to serve UI dashboards.

2. API Surface (selected)
--------------------------
- `POST /api/projects` → `{ project }`, enqueues crawl when queue enabled.
- `GET /api/projects/:id/snapshot` → aggregator of bundle + DB.
- `GET /api/crawl/pages?projectId` → bundle-backed crawl listing with query filter.
- `GET /api/projects/:id/link-graph` → nodes/edges from bundle.
- `POST /api/keywords/generate` → queue discovery.
- `POST /api/plan/create` → rebuild plan (articles rows).
- `POST /api/articles/generate` → queue article generation for a plan item.
- `POST /api/orgs { action: 'switch'|'invite' }` → switch org or emit stub invite email.
- `GET /api/blobs/:id` → blob store (auth required unless `SEOA_BLOBS_PUBLIC=1`).

3. Workers & Providers
-----------------------
- Providers resolved through `src/common/providers/registry.ts` with stub fallback controlled by `config.providers.allowStubs`.
- Metrics & SERP caching uses file cache (`.data/serp-cache`) and Postgres `metric_cache`.
- Queue logging handled by `src/common/infra/jobs.ts` (JSONL appends).

4. Third-Party Integrations
----------------------------
- **Webhook** (default) – signed POST with article payload.
- **Webflow** – API call with article content (status tracked in `project_integrations`).
- Additional connectors (WordPress, Framer) use same interface but are currently stubs until credentials provided.

5. Testing & Validation
------------------------
- `bun test` – runs unit/integration suite (ensures APIs import, bundle helpers, worker processors, CLI commands).
- `bun run typecheck` – TypeScript type safety.
- `bun run lint` – Biome linting.
- `bunx vite build --mode=production` – ensures client build compiles.
- `bun run smoke` – hits `/api/health`.
- New Vitest suites under `tests/system` verify docs & provider stubs (see repo for details).

6. Deployment Notes
--------------------
- Ensure PostgreSQL and RabbitMQ accessible via `DATABASE_URL` and `RABBITMQ_URL`.
- The bundle directory `.data/bundle` must reside on shared storage if workers run on multiple instances.
- Configure provider API keys for production (OpenAI, DataForSEO, Exa, Resend).
- Set `SEOA_QUEUE_NAME` per worker type (`seo_jobs.crawler`, `seo_jobs.general`).
- Set `SESSION_SECRET`, `ADMIN_EMAILS`, and CMS credentials as needed.

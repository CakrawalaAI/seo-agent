0. Product name & goal

Name: SEO Agent
Goal (MVP v0): From a website URL, SEO Agent crawls the site, understands the business, generates a 30‑day plan (titles+outlines), then creates one full article per day (lazy generation) and auto‑publishes via Webhook (v0) or Webflow (v0.1). Web FE mirrors the CLI.

Dev guardrails:
- All implementation work stays inside this repository folder.
- Project layout anchored at `src/{pages,app/routes,features,blocks,entities,common,cli,worker}`.
- Blocks compose multiple features across pages; features are the primary UI units for a single concern.
- API routes live under `src/app/routes/api/**`. Pages map 1:1 with routes under `src/pages/**`. File routes remain thin and import page loader + page component.

1. System architecture (high level)

Single‑app structure using TanStack Start + TanStack Router (server routes + web UI) within this repository. Core directories:
- `src/common` (infra/utilities: http, logger, env, queue, db clients)
- `src/entities/<entity>` (db schema, domain models, repositories/services)
- `src/features/<feature>` (client UI, server actions, shared view logic)
- `src/blocks` (cross‑feature composites reused across pages)
- `src/pages/<route-id>` (page loader + page component)
- `src/app/routes` (thin file routes importing from pages)
- `src/cli`, `src/worker`

TanStack Start + TanStack Router (server routes for all APIs).

DB: PostgreSQL via Drizzle.

Auth: better‑auth (Google).

Payments: Polar plugin (org‑scoped entitlements).

Jobs: RabbitMQ-backed queue (durable, per-project routing); daily cron calls /api/schedules/run; worker app consumes queued jobs with concurrency.

Crawl: Playwright as the default fetcher (JS‑rendered), robots.txt + sitemap aware.

Providers: everything swappable (LLM, discovery metrics, CMS publishing).

CLI (seo) + Web FE share the same REST API.

1.1 Execution model & data loading

- Route‑level loaders live in `src/pages/**/loader.ts` (or `controller.ts`). They SSR critical data, compose multiple entity calls in parallel, and prime TanStack Query (e.g., `ensureQueryData`).
- Feature components are declarative UI. They consume loader data via `Route.useLoaderData()` or the primed query cache (`useSuspenseQuery`).
- Component‑scoped fetching is only for client‑only/local needs; all privileged/SSR‑critical work happens in loaders/server functions.
- Server‑only concerns (DB, secrets, LLM, provider calls) run in loaders/services; UI never accesses secrets directly.
- Loaders return stable, typed DTOs (e.g., `ProjectSnapshot`, `MeSession`) for predictable rendering and testing.

1.2 Import boundaries & rules

Allowed direction: `common → entities → features → blocks → pages → routes`.
- `common` is infra‑agnostic and imported by all lower layers.
- `entities` import only from `common`.
- `features` import from `entities` and `common`.
- `blocks` import from `features`, `entities`, `common`.
- `pages` compose `blocks` + `features` and own the loader.
- `routes` are glue only and import from `pages`.

1.3 Feature‑sliced architecture overview

- `src/app` – router entry points, file‑based routes (thin), global styles.
- `src/pages/<route>` – page modules mapping 1:1 to routes; export `loader()` and `Page`.
- `src/blocks` – cross‑feature composites (dashboards/shells/multi‑feature widgets).
- `src/features/<name>` – feature UI and logic.
  - `client/` – primary UI components for the feature.
  - `server/` – mutations/actions that call entity services.
  - `shared/` – state machines, hooks, view helpers.
- `src/entities/<name>` – domain source of truth.
  - `domain/` – TypeScript domain models.
  - `db/` – Drizzle schemas.
  - `service.ts` – HTTP/server service wrappers used by loaders/CLI/worker.
- `src/common` – cross‑cutting infra (HTTP, logger, env, queue, db client), pure utilities.

1.4 Tooling & UI

- Styling/UI: tailwindcss + shadcn/ui components.
- Router/UI framework: TanStack Start + TanStack Router.
- Lint/format: Biome (replaces ESLint/Prettier in policy; code may migrate over time).
- Package/runtime: bun.

1.5 Terminology — "Composition‑Only Routes"

- We avoid the vague word “thin”. Use “composition‑only routes” (aka adapter‑only route files).
- Definition: file routes that only register a page’s `loader` and `Page` component; no business logic, no data fetching beyond delegating to the page loader, no side effects.
- Page loaders (in `src/pages/**/loader.ts`) own SSR data composition and provider access.

Entity coverage (current mapping)

| Entity       | Domain file                              | Service file                              | Used by                      |
|--------------|-------------------------------------------|-------------------------------------------|-------------------------------|
| Project      | `src/entities/project/domain/project.ts` | `src/entities/project/service.ts`         | Projects page, project tabs   |
| Article      | `src/entities/article/domain/article.ts` | `src/entities/article/service.ts`         | Article editor, publish       |
| Plan Item    | `src/entities/plan/domain/plan-item.ts`  | `src/entities/project/service.ts`         | Calendar + scheduling         |
| Keyword      | `src/entities/keyword/domain/keyword.ts` | `src/entities/keyword/service.ts`         | Keywords feature + tests      |
| Crawl Page   | `src/entities/crawl/domain/page.ts`      | `src/entities/project/service.ts`         | Crawl tab                     |
| Integration  | `src/entities/integration/domain/integration.ts` | `src/entities/project/service.ts` | Integrations tab              |
| Job          | `src/entities/job/domain/job.ts`         | `src/entities/job/service.ts`             | Jobs tab, worker              |
| Org Session  | `src/entities/org/domain/org.ts`         | `src/entities/org/service.ts`             | Dashboard/projects list       |

Testing notes

- Prefer unit tests around loaders (shape, SSR correctness, error cases) and entity services.
- UI components: test with Vitest + Testing Library (jsdom).
- Common network utilities: focused unit specs; API routes: contract tests per endpoint.

2. Data model (Drizzle‑ready, conceptual)

User

id, email, name, imageUrl, createdAt

Org

id, name, plan, entitlementsJson, createdAt

OrgMember

orgId, userId, role (owner|admin|member)

Project (1 project = 1 website)

id, orgId, name, siteUrl, defaultLocale, brandingJson, createdAt

Integration

id, projectId, type (webhook|webflow|wordpress|framer|shopify|wix)

configJson (secrets encrypted), status (connected|error|paused)

CrawlPage

id, projectId, url, httpStatus, contentHash, extractedAt

metaJson (title, meta description), headingsJson (h1..h3), linksJson (internal links)

contentBlobUrl (pointer to object storage for full text/html)

DiscoveryRun

id, projectId, providersUsed[] (["crawl","llm","dataforseo"]), startedAt, finishedAt, status, costMeterJson

summaryJson (business summary, audience, topics)

Keyword

id, projectId, phrase, locale, primaryTopic, source ("crawl"|"llm"|"manual")

metricsJson (searchVolume?, difficulty?, cpc?, competition?, sourceProvider, asOf)

status (recommended|planned|generated)

Unique by (projectId, phrase, locale)

PlanItem (30‑day title+outline plan; no body yet)

id, projectId, keywordId, plannedDate, title, outlineJson, status (planned|skipped|consumed)

createdAt, updatedAt

Article

id, projectId, keywordId, planItemId?

title, outlineJson, bodyHtml, language, tone, mediaJson

seoScore?, status (draft|published|failed), cmsExternalId?, url?

generationDate?, publicationDate?

Job

id, projectId, type (crawl|discovery|plan|generate|publish|linking|reoptimize)

payloadJson, status (queued|running|succeeded|failed|canceled)

progressPct, retries, startedAt, finishedAt, logs[]

MetricCache

id, projectId, provider ("dataforseo"), hash (phrase+locale+location)

metricsJson, fetchedAt, ttl (avoid re‑billing)

(Later: SearchMetrics from GSC; InternalLinks for link graph.)

3. Providers (swappable)

LLM Provider

summarizeSite(contentDump) -> { businessSummary, audience, products, topicClusters[] }

expandSeeds(topicClusters) -> seedKeywords[]

draftTitleOutline(keyword, locale, tone) -> { title, outline }

generateBody(title, outline, keyword, locale, flags) -> { bodyHtml, media? }

Discovery Metrics Provider (DataForSEO‑ready)

enrichMetrics(keywords[], locale, location) -> metrics[]

Returns: searchVolume, cpc, competition, (optionally) difficulty

Billing control: check MetricCache first; batch requests; throttle; idempotency by (normalizedPhrase, locale, location).

Note: You asked for research on DataForSEO. Their Keywords Data v3 product exposes multiple keyword endpoints (e.g., related/ideas/for site/search volume), with task‑based POSTs and rich results (volume, cpc, competition, etc.). Verify the exact endpoint list and payloads in their docs before wiring credentials. If you need me to enumerate request/response fields precisely, I can do that as a follow‑up once you confirm which endpoints you want (e.g., Search Volume, Related Keywords, Keywords For Site, Trends).

CMS Publisher

Drivers: webhook (v0), webflow (v0.1), then wordpress, framer (plugin), shopify, wix.

Contract: publish(portableArticle, integrationConfig) -> { externalId, url }.

4. CMS connectors — nature, quirks & build order

Shared: we publish a PortableArticle (title, excerpt, bodyHtml, outline, media, seo, locale, tags, slug).

Webhook (v0)

POST to targetUrl with HMAC header X-SEOA-Signature.

Retries, idempotency key X-SEOA-Idempotency.

Best for “connect anything” and for your local receiver during dev.

Webflow (v0.1)

Create CMS item in selected Collection, then Publish or leave Draft.

Quirk: per‑Collection field mapping; images may need prior upload.

WordPress (v0.2)

wp/v2/posts with App Passwords/JWT; categories/tags by id.

Quirk: sanitize HTML; upload images to media library when needed.

Framer (v0.3)

Plugin/receiver that pulls PortableArticle (or Webhook).

Shopify (v0.4)

Admin GraphQL Article; set blog handle; theme variations.

Wix (v0.4)

Requires Wix app & scopes; publish draft → live.

Build order: Webhook → Webflow → WordPress → Framer → Shopify/Wix.

5. Core flows (behavioral specs)
5.1 Onboarding → Crawl → Discovery → Planning

Create Project (siteUrl).

Crawl job starts automatically.

Playwright fetches sitemap, honors robots; queues pages (budgeted).

Each page stored as CrawlPage (metadata + content blob).

LLM Summary: run on the content dump to extract:

business model, audience, products/services, writing style, topic clusters.

Seed generation: LLM yields seed keywords by topic.

Metrics enrichment: call Discovery Metrics Provider (DataForSEO when enabled) to attach searchVolume / cpc / competition / (difficulty?).

Keyword list appears in Keywords Page (status=recommended).

30‑day Plan is created immediately:

For the top 30 keywords (by opportunity), the system pre‑generates Title+Outline only as PlanItems distributed across the upcoming 30 days (respect org limits).

Users can edit/skip/reorder plan items.

5.2 Daily Lazy Generation → Review/Edit → Publish

Daily cron (or seo schedule run): for today’s PlanItems, run Generate Body to produce full Draft articles.

Project setting controls the review policy:

Auto‑publish with buffer (recommended): plan is made 3 days ahead; if a PlanItem isn’t edited or skipped during the buffer, the Draft generated on the day is published automatically.

Auto‑publish immediately: skip buffer; same‑day publish.

Manual review: draft stays pending until human publishes.

Publish uses selected integration (Webhook by default). Retries with idempotency.

Why buffer is best: it gives users visibility (titles/outlines) and a chance to intervene, while maintaining automation if they ignore the drafts.

6. Scheduling rules

The calendar plans days using PlanItems (Title+Outline only), created at planning time.

One primary keyword per article; secondary keywords live in PlanItem metadata and are validated in outline coverage.

Each day pulls the next PlanItems by priority (user‑adjustable).

If a day fails (provider error), PlanItem remains and is retried next day.

7. Web FE (v0) — pages & components
7.1 Navigation

Sidebar: Calendar, Keywords, Articles, Integrations, Settings.

7.2 Keywords Page (like your screenshot)

Header stats: All, Recommended, Planned, Generated.

Table columns:

Keyword (phrase)

Opportunity (badge: Low/Med/High; from our scoring)

Difficulty (0‑100 or bucket)

Volume (formatted number)

CPC (currency)

Actions: “Plan” (adds to calendar / updates priority), Star.

Search + filters (topic, opportunity, language).

No CSV import in v0. Users can delete or add one by one.

7.3 Calendar Page (like your screenshot)

Month view with cards for PlanItems:

Status chip: PLANNED / DRAFT GENERATED / PUBLISHED

Title preview; “View Draft / View Article”.

Edit: drag‑drop (v0.1) or change date via modal (v0).

Shows “Next Generation: T‑24:00” indicator.

Guide panel explaining the buffer logic.

7.4 Articles Page

Tabs: Drafts, Published.

Draft details pane with rich text editor (recommend Tiptap or Lexical) to edit title/outline/body before publishing.

“Publish” button (select integration) and “Skip” action.

7.5 Integrations Page

Cards: Webhook (activate, test send), Webflow (connect, field mapping), others Coming soon.

8. CLI (seo) — commands
seo login
seo whoami
seo project create --name "Acme" --site https://acme.com
seo project ls
seo integration add webhook --project <id> --url https://hook.url --secret *****
seo integration test --integration <id>
seo keyword generate --project <id> --location "United States" --locale "en-US" --provider dataforseo   # runs crawl+summary+metrics (idempotent)
seo keyword ls --project <id> --status recommended
seo plan ls --project <id> --month 2025-11
seo plan move --plan <planId> --date 2025-11-12
seo schedule run --project <id>              # triggers today’s body generation
seo job watch --id <jobId>
seo article ls --project <id> --status draft
seo article publish --article <id> --integration <integrationId>


All functionality must be available both in Web and CLI.

9. API contract (server routes)

All payloads Zod‑validated; errors: {code, message, details?}.
Auth: cookie session (better‑auth). Org determined from session + X‑Org‑Id or active selection.

Auth & User

GET /api/auth/google/login → redirect

GET /api/auth/google/callback → cookie session

POST /api/auth/logout

GET /api/me → { user, orgs, activeOrg, entitlements }

Orgs & Billing (Polar)

POST /api/orgs/:id/invites → {inviteUrl}

POST /api/orgs/invites/:token/accept

POST /api/billing/checkout → {url}

GET /api/billing/portal?orgId=... → {url}

POST /api/webhooks/polar → updates org.plan/entitlements

Projects

POST /api/projects → {projectId} (auto‑starts crawl job)

GET /api/projects/:id

PATCH /api/projects/:id (locale, branding, autopublishPolicy: immediate|buffered|manual, bufferDays default=3)

DELETE /api/projects/:id

Integrations

POST /api/integrations → {integrationId} (type, config)

PATCH /api/integrations/:id

DELETE /api/integrations/:id

POST /api/integrations/:id/test → attempts a sample publish

Crawl & Discovery (renamed from “discovery”)

POST /api/crawl/run → {jobId} (idempotent by project+siteUrl hash; skips if recent)

GET /api/crawl/runs?projectId=... → list

GET /api/crawl/pages?projectId=...&q=... → paginated extracted pages

POST /api/keywords/generate → {jobId}
Pipeline: use latest crawl dump → LLM summary → seed keywords → metrics provider → upsert Keyword rows; compute Opportunity and set status:"recommended".

GET /api/projects/:id/keywords?status=...

PATCH /api/keywords/:id (star, delete, manual edit)

Planning (Titles + Outlines only)

POST /api/plan/create → {jobId}
Creates 30 PlanItems (or per entitlements) with Title+Outline via LLM for top keywords.

GET /api/projects/:id/plan?from=...&to=...

PATCH /api/plan/:id (reschedule date, edit title/outline, skip/unskip)

Generation (body = lazy, on the day)

POST /api/articles/generate → {jobId} *(payload: {planItemId})`

GET /api/articles/:id

PATCH /api/articles/:id (edit before publish)

Publishing

POST /api/articles/:id/publish → {externalId, url}

For Webhook: POST PortableArticle + HMAC.

For Webflow: create + (optional) publish.

Jobs

GET /api/jobs/:id

GET /api/projects/:id/jobs?type=...&status=...

Daily scheduler (lazy generation)

POST /api/schedules/run?projectId=...

Finds today’s PlanItems (status=planned), generates bodies → update Articles; apply policy (auto‑publish or wait).

10. Scoring & metrics (free‑first, provider‑swappable)

Volume: from DataForSEO when enabled; otherwise bucket from crawl/LLM frequency heuristics.

Difficulty: provider field when available; fallback proxy from competition heuristics.

Opportunity (0–100): weighted blend: High Volume × Low Difficulty × Intent Fit × Topical Gap.

CPC/Competition: provider fields when available.

Caching & billing control

MetricCache keyed by (projectId, phrase, locale, location, provider); TTL configurable.

Batch requests, exponential backoff, and daily budget caps per org.

11. Crawler (Playwright‑first) — details

Robots.txt + sitemaps respected; fallback to shallow crawl (same‑host only, path budget e.g. 200).

Fetch: Playwright Chromium; 10‑second timeout; render, then extract: <title>, <meta>, <h1..h3>, visible text (size‑capped), internal links.

Storage: CrawlPage rows + contentBlobUrl (chunk large text to object storage).

LLM input: top N pages by internal link rank + representative samples by section to cap tokens.

Idempotency: re‑crawl only if lastCrawled > N days or hash changed.

12. Worker & cron

Cron (platform scheduler) calls:

/api/schedules/run daily per active project.

Optional: /api/crawl/run weekly to refresh content dump.

Queueing (RabbitMQ):

- Direct exchange `seo.jobs` routes per jobType/project key into durable queue `seo.jobs.default`.
- Messages persisted with delivery-mode 2, TTL + retry headers; failures > N route to DLX `seo.jobs.dlq`.
- Configuration via env: `RABBITMQ_URL` (AMQP connection), `RABBITMQ_PREFETCH` (worker prefetch), `RABBITMQ_QUEUE_PREFIX` (optional namespace per org/env).

Worker app:

- Subscribes to `seo.jobs.default` with manual ack + prefetch window per org.
- Applies concurrency + rate limits per org; requeues with delay on transient failure.
- Emits heartbeats by extending ack deadline; moves exceeded retries to DLX.

13. PortableArticle
{
  "title": "Example Title",
  "excerpt": "One-sentence summary.",
  "bodyHtml": "<article>...</article>",
  "outline": [{"level":2,"text":"..."}, {"level":3,"text":"..."}],
  "media": {
    "images": [{"src":"https://...","alt":"...","caption":"..."}],
    "youtube": [{"id":"...", "title":"..."}]
  },
  "seo": {
    "canonical": "https://example.com/...",
    "metaTitle": "…",
    "metaDescription": "…",
    "primaryKeyword": "…",
    "secondaryKeywords": ["…","…"]
  },
  "locale": "en-US",
  "tags": ["…"],
  "slug": "example-title"
}

14. Project layout
```
src/
  app/
    routes/
      api/...          # REST endpoints (auth, orgs, billing, projects, crawl, keywords, plan, articles, jobs)
      (ui)             # login, dashboard, project pages (thin file routes)
    __root.tsx
    router.tsx
    styles.css
  pages/
    projects/
      loader.ts        # page loader/controller (SSR, compose services, prime query)
      page.tsx         # page component (compose features/blocks)
    ...                # other pages mirror route segments 1:1
  features/            # feature UI slices: keywords, calendar, articles, integrations
    <feature>/client
    <feature>/server
    <feature>/shared
  blocks/              # cross‑feature composites (dashboards, shells)
  entities/            # db schema, domain models, repositories/services
  common/              # http, logger, env, queue/db clients, generic utils
  cli/                 # CLI commands using the same API DTOs
  worker/              # background processors using repositories/services
tests/                 # unit/integration tests
```

Import boundaries are enforced per §1.2 (no upward imports).

15. Acceptance criteria (CLI + Web together)

Each atomic commit must include: routes, domain tests, CLI command, Web UI, docs (screenshots).

C00. Repo & Health

API: /api/health → {ok:true}

CLI: seo ping prints version.

Web: /login renders; /dashboard shows “no projects yet”.

C01. Auth (better‑auth Google)

API: login/callback, /api/me.

CLI: seo login, seo whoami.

Web: Sign‑in → profile chip visible.

C02. Orgs & Billing (Polar)

API: invites; checkout → redirect; /webhooks/polar updates entitlements.

CLI: seo org invite, seo billing checkout.

Web: Upgrade button, portal link.

AC: org entitlement fields updated after webhook.

C03. Projects (auto‑start crawl)

API: POST /projects triggers crawl job.

CLI: seo project create, seo job watch.

Web: Project appears; crawl status visible in Project → Crawl tab.

C04. Crawl storage (Playwright)

API: /api/crawl/pages lists extracted pages.

CLI: seo crawl run --project <id> re-runs; watch job logs.

Web: Crawl tab lists pages, last crawled.

C05. Keyword generation (no import)

API: /api/keywords/generate → LLM summary + seeds + metrics (cache).

CLI: seo keyword generate --project <id>.

Web: Keywords page shows list with Opportunity, Difficulty, Volume, CPC.

C06. Planning (30‑day Title+Outline)

API: /api/plan/create, GET /projects/:id/plan, PATCH /api/plan/:id.

CLI: seo plan ls/move.

Web: Calendar page displays PLANNED cards; reschedule modal.

AC: exactly N (quota) plan items created in the next 30 days.

C07. Daily lazy generation

API: /api/schedules/run generates today’s drafts; GET /articles/:id.

CLI: seo schedule run, seo article ls --status draft.

Web: Calendar shows card status DRAFT GENERATED; Articles tab lists Drafts.

C08. Publish via Webhook

API: /api/articles/:id/publish (HMAC); /api/integrations/:id/test.

CLI: seo article publish, seo integration test.

Web: Publish button; integration test sends sample.

AC: receiver gets PortableArticle; DB stores {externalId, url}.

C09. Rich text editing (web)

Web: Draft detail editor (Tiptap/Lexical), save/publish.

CLI: seo article edit (stdin) updates via PATCH /articles/:id.

AC: edits persist and are used on publish.

C10. Webflow connector

API: integration config + mapping; publishing works.

CLI: seo integration add webflow ... then publish.

Web: Mapping UI; publish to draft/live.

(Next: drag‑drop calendar, WordPress, Framer, GSC feedback, internal links.)

16. Sequence diagrams (text)

Onboard → Crawl → Keywords → Plan

User -> Web: Create Project(siteUrl)
Web -> API: POST /projects
API -> RabbitMQ: publish(crawl)
Worker -> Crawler: run(siteUrl)
Crawler -> DB: store CrawlPage[*]
Worker -> Discovery/LLM: summarize(contentDump)
Worker -> Discovery/LLM: generate seedKeywords
Worker -> MetricsProvider: enrichMetrics(seedKeywords)
MetricsProvider -> DB: upsert Keyword[*]
Worker -> DB: create 30 PlanItems (title+outline)
Web -> User: Keywords page + Calendar populated


Daily generation → Publish (buffered)

Cron -> API: POST /schedules/run
API -> DB: select today's PlanItems
API -> RabbitMQ: publish(generateBody) per item
Worker -> LLM: generate body from title+outline
Worker -> DB: create Draft Article
[Policy=buffered]
  if PlanItem older than bufferDays:
     Worker -> Publisher(Webhook/Webflow): publish PortableArticle
     Publisher -> DB: set Article.published
Web/CLI -> User: see Draft or Published status


Publish (manual)

User -> Web/CLI: publish article
Web/CLI -> API: POST /articles/:id/publish
API -> Publisher: publish(...)
Publisher -> API: { externalId, url }
API -> DB: update Article

17. Security & compliance

Robots.txt honored; same‑origin crawl only; user opts in.

Secrets encrypted at rest; webhook HMAC; idempotency keys.

Rate‑limits & exponential backoff for provider calls.

Session cookies (HTTP‑only), role‑based access (org/project scopes).

18. Feature flags & config

SEOA_PROVIDER_METRICS=dataforseo|mock

SEOA_AUTOPUBLISH_POLICY=buffered|immediate|manual

SEOA_BUFFER_DAYS=3

SEOA_CRAWL_BUDGET=200

SEOA_PLAYWRIGHT_HEADLESS=true

SEOA_PUBLICATION_ALLOWED=webhook,webflow

19. Open questions already resolved (decisions)

Always crawl first; no CSV import in v0.

Plan = 30 title+outline items created up front.

Lazy generation = full body only on the day.

Policy = buffered auto‑publish (default, 3‑day window).

Playwright as the main fetcher.

Separate worker app ships in v0 (not deferred).

20. What the coding agent should build first

C00–C10 (Acceptance criteria in §15), in order, with Web + CLI in each commit.
By C08 you already have: auth, orgs, billing, projects, crawl, keyword generation, planning, daily lazy generation, and Webhook publishing—end‑to‑end automation.

Note:
use tailwindcss and shadcn for ui, dont write, but use web search to install the components and first time setup
use bun as package manager and build scripts and tests

21. Testing & Commit Policy

Each commit must update UI + API + CLI together for the scoped feature and run the following checks:
- curl smoke: `curl -sS localhost:<port>/api/health` (and relevant new endpoints)
- unit tests: `bun test` (Vitest)
- integration tests: API contract tests (DTOs, error shapes)
- e2e: Playwright smoke for critical flows (where applicable)
- CLI tests: run specific command(s) (e.g., `seo ping`, `seo project create --dry-run`) in CI

Failing any check blocks the commit from merging. Prefer parallel test execution.

22. Implementation status (MVP v0)

- C00 Health: implemented
- C01 Auth (dev mock): implemented
- C02 Billing (dev mock): implemented
- C03 Projects: implemented
- C04 Crawl (seeded pages): implemented
- C05 Keywords (mock provider): implemented
- C06 Plan (30‑day): implemented
- C07 Schedule (lazy drafts): implemented
- C08 Publish (Webhook) + auto‑publish: implemented (HMAC + idempotency)
- C09 Editing (web): implemented
- C10 Webflow connector: stub implemented (v0.1)

Notes
- Current MVP uses in‑memory repositories and mocked providers; replace with Drizzle/Postgres and real integrations for production. SSR loaders added to prime queries. Biome is configured as linter/formatter. Playwright curl/e2e smokes included.

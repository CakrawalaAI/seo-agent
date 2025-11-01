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

DB: PostgreSQL via Drizzle. Workers are stateless: page text stored in `crawl_pages.content_text`. Site summaries and representative URL lists are kept in debug bundles when enabled, not persisted in DB.
Debug bundles: file-based bundles are disabled by default. To enable optional debug bundle writes (for lineage/costs inspection), set `config.debug.writeBundle=true`. In production and normal dev, no files are written.

Auth: Server-side Google OAuth 2.0 (no PKCE) + signed session cookies.

Payments: Polar plugin (org‑scoped entitlements).

Jobs: RabbitMQ-backed queue (durable, per-project routing); daily cron calls /api/schedules/run; worker app consumes queued jobs with concurrency.

Crawl: Playwright as the default fetcher (JS‑rendered), robots.txt + sitemap aware.

Providers: everything swappable via interfaces (LLM, keyword discovery, metrics/SERP, research, CMS, crawler). Default impls: DataForSEO (keyword discovery + metrics + SERP), OpenAI (LLM), Exa (research), Playwright (crawler).
Connectors:
- Webhook (prod-ready), Webflow (basic), WordPress/Framer (not implemented: fail in production; allowed only when `providers.allowStubs=true`).

CLI (seo) + Web FE share the same REST API.

Security & Admin
- RBAC: All project-scoped APIs require a session and project access. Membership is checked via `org_members`.
- Admin: Global schedules and admin tools require `ADMIN_EMAILS` (comma-separated list). Endpoints: `/api/admin/*`, `/api/schedules/{metrics,serp-monthly,crawl-weekly}`, `/api/{keyword,serp}/refresh`.
- Bundles: Debug bundle endpoints are disabled by default and only respond when `config.debug.writeBundle=true`.
- OAuth redirect safety: `redirect`/`to` params in `/api/auth/login` are sanitized to internal paths only (no external redirects). Callbacks also sanitize the stored `redirectTo` from the temp cookie.

1.7 Workers in Development (no Docker)

- Development runs workers as local processes, not containers.
- Commands (sane defaults):
  - General worker: `bun run worker`
  - Crawler worker: `bun run crawler`
- `docker-compose.yml` only provisions Postgres, RabbitMQ, and Adminer.

Scheduler (daily)
- The general worker runs a lightweight daily scheduler to trigger the same logic as `/api/schedules/run` across all projects.
- Enabled by default; disable with `SEOA_ENABLE_SCHEDULER=0`.
- Interval configurable via `SEOA_SCHEDULER_INTERVAL_MS` (default 600,000ms = 10 minutes in dev).

1.9 Crawl Strategy (LLM-guided representatives)

- Discover sitemap URLs (handles sitemap index). Sample up to 200.
- LLM ranks top N representative URLs (home, about, pricing, product/services). Config: `config.crawl.maxRepresentatives`.
- Crawl only those URLs (Playwright-first). Robots ignored by default (owner consent). Dev default expands one hop (`config.crawl.expandDepth=1`).
- Store page text in DB; summaries written to debug bundles (optional), not persisted in DB.

1.8 Providers & Stubs (central config)

- Central config at `src/common/config.ts` controls providers and stub behavior.
- Defaults: in development, stubs allowed; in production, fail without credentials.
- Edit `config.providers.allowStubs`, `config.serp.ttlDays`, `config.serp.topKDefault`, and email transport in one place.

1.6 Auth, Orgs, Payments — Mental Model (Server-side OAuth + Polar)

- Identity: Custom Google OAuth 2.0 implementation using the Authorization Code flow on the server (no PKCE). The app is a confidential client; token exchange uses `GOOGLE_CLIENT_SECRET` on the server (`/api/auth/**`).
- Sessions: Signed session cookies (HMAC-SHA256) with 7-day TTL; payload includes user + activeOrg + entitlements.
- Storage: All auth data persists in Postgres via Drizzle (`users`, `sessions`, `accounts`). No `oauth_states` table is used; state is held via a short‑lived httpOnly temp cookie.
- Organizations: Custom org/member model in `orgs` and `org_members` tables with role-based access (owner/admin/member).
- Invitations: Token-based invites stored in `org_invites` (token, orgId, email?, expiresAt, consumedAt). Accept consumes token and adds membership; expired/used tokens rejected.
- Payments: Polar SDK for checkout/portal; webhooks at `/api/billing/webhooks/polar` update org entitlements.
- Entitlements: source of truth is DB `orgs.entitlementsJson` (updated by Polar webhooks). Server endpoints read plan/entitlements from DB to avoid live Polar calls.
- Usage tracking: `org_usage` table tracks `postsUsed` per billing cycle; enforced via middleware.
  - Consumption model: a post credit is consumed when the first draft for a plan item is created (deduped). Publishing does not consume additional credits.

Single plan credits (v1)

- One subscription product with a fixed monthly price (e.g., $50/mo).
- Monthly post credits per org = 30 (base). Future 2x/10x via price metadata `multiplier` or subscription quantity.
- Checkout uses a server endpoint `/api/billing/checkout` that calls Polar `/v1/checkouts` with `{ product_price_id: POLAR_PRICE_POSTS_30, metadata.referenceId=orgId }` and 302-redirects to the URL.
- Webhooks (`onSubscriptionActive/Updated` and renewals via `onOrderPaid`) recompute credits and reset `org_usage.postsUsed` when `current_period_start` changes.
- Enforcement: article generation and schedule runner stop when `postsUsed ≥ monthlyPostCredits`; increments usage on success.
- Free trial: on first sign-in, seed `monthlyPostCredits=1` and ensure `org_usage` row exists.

Implementation decisions

- Auth flow: Google OAuth 2.0 server-side Authorization Code (no PKCE). State maintained in a short‑lived httpOnly cookie (`seoa_oauth`).
- Route structure:
  - `/api/auth/login` → initiates OAuth, redirects to Google
  - `/api/auth/callback/google` → exchanges code for tokens, creates user + session
  - `/api/auth/logout` → clears session cookie
- Session storage: Signed cookies (`seoa_session`) with v1 format: `version|base64(payload)|hmac`; payload includes user + activeOrgId + entitlements.
- Organization model:
  - `orgs` table with `plan`, `entitlementsJson` (monthlyPostCredits, projectQuota, etc.)
  - `org_members` table for membership (userId, orgId, role)
  - `org_invites` table for invitation tokens (7-day expiry)
- Active organization: stored in session payload (`activeOrgId`). Client uses `session.activeOrg`; API derives `orgId` from session.
- Polar: pass `customData.orgId` to checkout so subscriptions bind to an org. Webhooks at `/api/billing/webhooks/polar` resolve org by customData and update `orgs.plan` + `orgs.entitlementsJson`.
- Usage enforcement: Middleware checks `org_usage.postsUsed >= orgs.entitlementsJson.monthlyPostCredits` before generation/publish; returns 429 if exceeded.

1.7 Installation (Custom Auth + TanStack Start)

- Install packages
  - `bun add @polar-sh/sdk` (for billing only)
- Environment variables
  - `SESSION_SECRET=…` (required, HMAC signing key, 32+ chars)
  - `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET=…`
  - `GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google`
  - `POLAR_ACCESS_TOKEN=…`, `POLAR_WEBHOOK_SECRET=…`
  - `DATABASE_URL=postgres://…`
- Auth implementation
  - `src/common/auth/google.ts` implements Google OAuth 2.0 server-side code exchange
  - `src/common/infra/session.ts` handles signed cookie encoding/decoding
  - Routes at `src/app/routes/api/auth/**`
- Database tables
  - Run `npx drizzle-kit generate && npx drizzle-kit migrate`
  - Required tables: `users`, `sessions`, `accounts`, `orgs`, `org_members`, `org_invites`, `org_usage`
- Google redirect URIs (configure in Google Cloud Console)
  - Dev: `http://localhost:3000/api/auth/callback/google`
  - Prod: `https://YOUR_DOMAIN/api/auth/callback/google`

ENV (dev)

- `SESSION_SECRET` — random 32+ chars (HMAC signing)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` — full callback URL
- `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`
- `POLAR_PRICE_POSTS_30` — Polar price ID for 30 posts/month plan
- `DATABASE_URL` (Postgres)

DB migration plan

- Run Drizzle migrations to create all auth tables (`users`, `sessions`, `accounts`).
- Create org tables: `orgs` (with `plan`, `entitlementsJson`), `org_members`, `org_invites`, `org_usage`.
- Backfill: seed default org for existing users; create `org_usage` rows for all orgs.

1.8 Teams vs Organizations

- Organization = top‑level workspace (billing boundary, projects live here, members invited here).
- Team (optional) = subgroup inside an organization for finer permission scoping (e.g., Marketing vs Dev). Teams do not own billing; they inherit org plan. Enable only if we need team‑level roles/visibility. Initial rollout: teams disabled.

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

KeywordCanon (global)

id, phraseNorm, languageCode, createdAt

Unique by (phraseNorm, languageCode)

KeywordMetricsSnapshot (global slice)

id, canonId (FK KeywordCanon), provider, locationCode, asOfMonth (YYYY‑MM), metricsJson, fetchedAt, ttlSeconds (default 30d)

Unique by (canonId, provider, locationCode, asOfMonth)

SerpSnapshot (global slice)

id, canonId (FK KeywordCanon), engine ('google'), locationCode, device ('desktop'|'mobile'), topK, resultsJson, fetchedAt, anchorMonth? (optional)

Unique latest by (canonId, engine, locationCode, device, topK); optional monthly anchors for trends

Keyword (per‑project)

id, projectId, canonId (FK KeywordCanon), phrase, locale, primaryTopic, source ("crawl"|"llm"|"manual"),

status (recommended|planned|generated), starred?, opportunity?, createdAt, updatedAt

Unique by (projectId, canonId)

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

MetricCache (legacy helper)

id, provider, hash (e.g., request payload hash), projectId?, metricsJson, fetchedAt, ttlSeconds

Note: Keep for non‑canonical caches; canonical metrics live in KeywordMetricsSnapshot.

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
See also: ./workflow.md (Background Jobs & Loops)

5.1 Discovery Flow (multi‑source, cost‑optimized)
- Baseline first: Keywords For Site API to capture existing rankings and quick wins.
- LLM topical seeds from site summary (20–30), plus headings‑derived phrases.
- Expansion: Related Keywords API (broad) + Keyword Ideas API (category) to enlarge space.
- Scoring: Bulk Keyword Difficulty (batch) for 1k candidates.
- Enrichment: Keyword Overview for top 200 only (rich metrics).
- Caching: Persist global canon + monthly metrics snapshot; slice per project on access.

5. API Contract (discovery pipeline)
- 10 explicit steps: crawl → summarize → seeds → expand (site/related/ideas) → dedupe → bulk difficulty → rankability → overview(200) → persist canon+metrics → upsert project keywords.
- New env: `SEOA_PROVIDER_KEYWORD_DISCOVERY` selects discovery provider (default: dataforseo).

17. Provider Interfaces
- KeywordDiscoveryProvider: expand({ phrases, language, locationCode, limit }) → { phrase[] }.
- KeywordMetricsProvider: bulkDifficulty(phrases, locale, loc) and overview(phrases, locale, loc) split for cost control.
- Toggle via `SEOA_PROVIDER_KEYWORD_DISCOVERY`.

19.3 DataForSEO Endpoints (by phase)
- Discovery: keywords_for_site, related_keywords, keyword_ideas
- Scoring: bulk_keyword_difficulty
- Enrichment: keyword_overview (top 200 only)
- Competitive: serp/competitor endpoints when needed
5.1 Onboarding → Crawl → Discovery → Planning

Create Project (siteUrl).

Crawl job starts automatically.

Playwright fetches sitemap, honors robots; queues pages (budgeted).

Each page stored as CrawlPage (metadata + content blob).

LLM Summary: run on the content dump to extract:

business model, audience, products/services, writing style, topic clusters.

Keyword Discovery (multi-source):

Source A (existing rankings): Keywords For Site API extracts keywords the domain already ranks for (position 1-50, with volume/metrics).

Source B (LLM-guided expansion): LLM yields 20-30 topical seed keywords → Related Keywords API expands each seed (up to 4,680 variations) → Keyword Ideas API provides category-based, non-obvious terms.

Source C (optional v0.2): competitor gap analysis via Ranked Keywords API.

Deduplication: merge all sources by canonical (phrase_norm + language_code).

Metrics enrichment: Bulk Keyword Difficulty API (1,000 keywords/request) for efficient scoring → Keyword Overview API (top 200 only) for rich metrics: searchVolume, CPC, competition, difficulty, intent, monthly trends; ensure monthly KeywordMetricsSnapshot (global) via provider per (canon, location, YYYY‑MM).

Keyword list appears in Keywords Page (status=recommended).

Optionally ensure SERP snapshots for top‑M (global, TTL 7–14d) to prime research.

30‑day Plan is created immediately:

For the top 30 keywords (by opportunity), the system pre‑generates Title+Outline only as PlanItems distributed across the upcoming 30 days (respect org limits).

Users can edit/skip/reorder plan items.

5.2 Daily Lazy Generation → Review/Edit → Publish

Daily cron (or seo schedule run): for today’s PlanItems, run Generate Body to produce full Draft articles; ensure SERP snapshot present/fresh.

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

# Ops & maintenance (additional)
seo bundle-ls --project <id>
seo costs
seo logs --project <id> [--tail 200]
seo serp-warm --project <id> [--topM 50]
seo competitors-warm --project <id> [--topM 10]
seo score-run --project <id>
seo keyword-prioritized --project <id> [--limit 50]
seo schedule-crawl-weekly


All functionality must be available both in Web and CLI.

9. API contract (server routes)

All payloads Zod‑validated; errors: {code, message, details?}.
Auth: Custom Google OAuth 2.0 (session cookie, `/api/auth/**`). Org determined from session `activeOrgId` or explicit `orgId` param.

Auth & User

- GET `/api/auth/login` → redirect to Google OAuth consent screen
- GET `/api/auth/callback/google` → exchange code for tokens, create/update user, set session cookie, redirect to dashboard
- DELETE `/api/auth/logout` → clear session cookie, redirect to login
- GET `/api/auth/debug` → inspect current session (dev only)
- GET `/api/me` → session user + activeOrg + entitlements + orgs list

Orgs & Billing (Polar)

- Organizations:
  - GET `/api/orgs` → list user's orgs
  - POST `/api/orgs` → create org or invite member (body: `{ action: 'create'|'invite', name?, email? }`)
  - POST `/api/orgs/invites/$token/accept` → accept invite, join org
  - Active org: stored in session cookie, switched via `POST /api/orgs` with `{ action: 'switch', orgId }`
- Billing (single plan):
  - Checkout: POST `/api/billing/checkout` with `{ priceId?: POLAR_PRICE_POSTS_30 }` → 302 redirect to Polar Checkout
  - Portal: POST `/api/billing/portal` → 302 redirect to Polar Customer Portal
  - Webhooks: POST `/api/billing/webhooks/polar` → verify signature, handle events:
    - `subscription.created/updated/canceled` → update `orgs.plan` + `entitlementsJson.monthlyPostCredits`
    - Billing cycle reset → clear `org_usage.postsUsed` when `current_period_start` changes

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
Pipeline:
  1. Use latest crawl dump → LLM summary (business model, audience, topics)
  2. Keywords For Site API → baseline (what you already rank for; filter: position 1-50)
  3. LLM seed generation → 20-30 topical seeds from business context
  4. Related Keywords API → expand each seed (depth 2, min volume 100)
  5. Keyword Ideas API → category-based non-obvious terms (optional)
  6. Merge & deduplicate by canonical (phrase_norm + language_code)
  7. Bulk Keyword Difficulty API → efficient batch scoring (1k/request)
  8. Keyword Overview API → rich metrics for top 200 by volume (search_volume, cpc, intent, monthly_searches[])
  9. Compute Opportunity score → High Volume × Low Difficulty × Intent Fit
  10. Upsert Keyword rows (projectId, canonId, phrase, source, opportunity, status: "recommended")

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
Prioritization: a dedicated score job clusters phrases by a root‑phrase heuristic (stopword‑stripped first 1–2 tokens) to avoid cannibalization. Within each cluster, the highest‑opportunity term is marked primary; 1–2 follow‑ups are marked secondary. The resulting list is written to `keywords/prioritized.jsonl` and planning selects one primary per cluster by default.

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
See also: ./workflow.md (Queues, DAG transitions, loops)

Cron (platform scheduler) calls:

/api/schedules/run daily per active project.

Optional: /api/crawl/run weekly to refresh content dump.

Queueing (RabbitMQ):

- Exchange `seo.jobs` (topic), DLX `seo.jobs.dlq`.
- Default (today): single durable queue `seo_jobs` binds `#`.
- Recommended split: `seo_jobs.crawler` binds `crawl.*`; `seo_jobs.general` binds `discovery.* plan.* generate.* publish.* metrics.* serp.*`.
- Messages persisted with delivery-mode 2, TTL + retry headers; failures > N route to DLX.
- Env: `RABBITMQ_URL`, `RABBITMQ_PREFETCH`, `RABBITMQ_QUEUE_PREFIX`, `SEOA_QUEUE_NAME`, `SEOA_EXCHANGE_NAME`.

Worker apps:

- Crawler worker (Playwright image): consumes `seo_jobs.crawler` (or `seo_jobs` in single-queue mode); handles `crawl`.
- General worker (bun image): consumes `seo_jobs.general` (or `seo_jobs`); handles `discovery|plan|generate|publish|metrics|serp|competitors`.
- Both apply per‑org concurrency; retry/backoff; DLQ on exceeded retries.

Budget caps (provider calls)

- Daily caps enforced via env:
  - `SEOA_DAILY_SERP_CALLS_CAP` (0 = unlimited)
  - `SEOA_DAILY_METRICS_CALLS_CAP` (0 = unlimited)
- When cap exceeded, processors skip provider calls and log a `skipped: budget_exceeded` event to `bundle/global/metrics/costs.jsonl`.
- Costs summarized to `bundle/global/metrics/costs.json` with per‑day counts and est USD (configurable via `SEOA_COST_SERP_PER_CALL_USD`, `SEOA_COST_METRICS_PER_CALL_USD`).

18. Workflow manager (recipe)

- A tiny manager compiles a JSON recipe (src/common/workflow/recipe.json) to RabbitMQ publishes for next steps.
- Default: crawl → discovery → plan; generate → enrich (also queued by processor).
- Lives in worker process; invoked on success events.

17. Providers (interfaces + registry)

Interfaces live in `src/common/providers/interfaces/*` and are bound to concrete implementations by `src/common/providers/registry.ts` via env variables.

- KeywordDiscoveryProvider → default DataForSEO Labs
  - keywordsForSite(domain) → existing rankings baseline
  - relatedKeywords(seed[]) → "related searches" expansion
  - keywordIdeas(seed[]) → category-based suggestions
- KeywordMetricsProvider → default DataForSEO Labs
  - bulkKeywordDifficulty(phrases[]) → batch scoring (1k/request)
  - keywordOverview(phrases[]) → rich metrics (up to 700/request)
- KeywordExpandProvider → default DataForSEO Google Ads (legacy)
  - keywordsForKeywords(seed[]) → Google Ads suggestions
- SerpProvider → default DataForSEO SERP live regular
- LlmProvider → default OpenAI
- ResearchProvider → default Exa
- WebCrawler → default Playwright

Env switches
- `SEOA_PROVIDER_KEYWORD_DISCOVERY` (default `dataforseo`)
- `SEOA_PROVIDER_METRICS` (default `dataforseo`)
- `SEOA_PROVIDER_SERP` (default `dataforseo`)
- `SEOA_PROVIDER_LLM` (default `openai`)
- `SEOA_PROVIDER_RESEARCH` (default `exa`)

Storage
- Crawl/Serp store text dumps (no HTML), accessible via `/api/blobs/:id` with correct content-type. Competitor page dumps and other bundle files are only written when debug mode is enabled (`config.debug.writeBundle=true`); default production does not write files.

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
features/
  keyword/
    server/ensureCanon.ts
    server/ensureMetrics.ts
    server/computeOpportunity.ts
  serp/
    server/ensureSerp.ts
    server/parseSerp.ts
worker/
  crawler.entry.ts      # Playwright image entry (binds crawl.*)
  general.entry.ts      # bun image entry (binds discovery|plan|generate|publish|metrics|serp)
tests/                 # unit/integration tests
```

Import boundaries are enforced per §1.2 (no upward imports).

15. Acceptance criteria (CLI + Web together)

Each atomic commit must include: routes, domain tests, CLI command, Web UI, docs (screenshots).

C00. Repo & Health

API: /api/health → {ok:true}

CLI: seo ping prints version.

Web: /login renders; /dashboard shows “no projects yet”.

C01. Auth (Custom Google OAuth)

API: GET `/api/auth/login`, GET `/api/auth/callback/google`, DELETE `/api/auth/logout`, GET `/api/me`.

CLI: seo login, seo whoami.

Web: Sign‑in → profile chip visible.

AC: Signed session cookie set; user/org data in session payload.

C02. Orgs & Billing (Polar)

API: invites; checkout → redirect; Polar webhooks at `/api/billing/webhooks/polar` update entitlements.

CLI: seo org invite, seo billing checkout.

Web: Upgrade button, portal link.

AC: org entitlement fields updated after webhook; usage enforcement blocks over-quota requests.

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

19.1 Keyword/SERP canon & refresh policy
- Canon identity = `phrase_norm + language_code` (shared across orgs/projects). Snapshots carry geo/device: `location_code`, `device`, `topK`.
- Metrics snapshots (DataForSEO Labs) are monthly; refresh on calendar month change; keep history.
- SERP snapshots are cached with TTL (7–14 days) and may record a monthly anchor; always store `textDump` for LLM.
- Default geo = 2840 (US) unless project overrides.

19.2 Worker split rationale
- Crawler worker (Playwright) is isolated due to Chromium deps, RAM/CPU spikes, anti‑bot strategies.
- General worker (bun‑only) handles LLM, metrics, SERP, plan, publish.
- Scaling/ops: separate queues via `SEOA_BINDING_KEY` or run single queue until split is needed.

19.3 DataForSEO endpoints (default provider)
Discovery phase:
- Labs: `google/keywords_for_site/live` → existing rankings (baseline; what domain ranks for).
- Labs: `google/related_keywords/live` → "related searches" expansion (up to 4,680 per seed).
- Labs: `google/keyword_ideas/live` → category-based non-obvious keywords.
- Keywords: `google_ads/keywords_for_keywords/live` → Google Ads keyword suggestions (legacy/alternative).

Scoring phase:
- Labs: `google/bulk_keyword_difficulty/live` → batch difficulty (1,000 keywords/request).
- Labs: `google/keyword_overview/live` → rich metrics: `search_volume`, `cpc`, `competition`, `keyword_difficulty`, `search_intent_info`, `monthly_searches[]` (up to 700 keywords; use for top N only).

Enrichment phase:
- SERP: `serp/google/organic/live/regular` → top 10 organic results with `rank_group/title/description/url`.
- SERP: `serp/google/organic/live/advanced` → full SERP features (optional: People Also Ask, Featured Snippets).

Competitive intelligence (optional v0.2):
- Labs: `google/ranked_keywords/live` → all keywords a competitor ranks for.
- Labs: `google/serp_competitors/live` → domains ranking for specific keywords with traffic estimates.
- Labs: `google/domain_rank_overview/live` → competitor authority metrics.

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

- C00 Health: ✅ implemented
- C01 Auth: ✅ custom Google OAuth + signed cookies
- C02 Orgs: ✅ implemented; Billing: 🚧 checkout/portal working, webhook handler pending
- C03 Projects: ✅ implemented with auto-crawl
- C04 Crawl: ✅ Playwright + sitemap + robots.txt
- C05 Keywords: ✅ DataForSEO + LLM + canon model
- C06 Plan: ✅ 30‑day title+outline via LLM
- C07 Schedule: ✅ lazy body generation with SERP context
- C08 Publish (Webhook): ✅ HMAC + idempotency
- C09 Editing (web): ❌ pending rich text editor
- C10 Webflow connector: ❌ stubbed, needs real API implementation

Notes
- Production-ready Postgres + Drizzle implementation
- RabbitMQ job queue with worker processors
- DataForSEO, OpenAI, Exa integrations working
- Usage enforcement middleware pending
- Webflow needs real REST API integration
seo keyword refresh --canon <id> --location "United States" --what metrics --force  # manual global refresh
seo serp refresh --canon <id> --location "United States" --device desktop --topK 10
Keyword & SERP (global refresh)

POST /api/keyword/refresh → { queued: true } (body: { canonId | phrase + language, locationCode, what?: 'metrics'|'serp'|'both', force?: boolean })

POST /api/serp/refresh → { queued: true } (body: { canonId, locationCode, device?: 'desktop'|'mobile', topK?: number, force?: boolean })

GET /api/keywords/:canonId/snapshots?from=YYYY-MM&to=YYYY-MM → list monthly metrics snapshots

Schedulers

POST /api/schedules/metrics → enqueue monthly metrics refresh for in-use canons (global)

POST /api/schedules/serp-monthly → enqueue monthly SERP anchors for in-use canons (global)

POST /api/schedules/feedback → enqueue feedback loop (GSC placeholder/stub) for a project

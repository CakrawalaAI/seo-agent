# SEO Agent – Sequence & Architecture (DB‑Only)

All long‑running state is recorded in RabbitMQ; artifacts persist in Postgres only (stateless workers).

## 0. Architecture Snapshot (Nov 2025)

**Runtime:** TanStack Start (React Router) + Bun workers.
**Persistence:** PostgreSQL (DB-only; no filesystem bundles).
**Queues:** RabbitMQ (`seo.jobs` topic exchange).
**Providers:** Playwright (crawl), DataForSEO (keywords/metrics/SERP), OpenAI (LLM), Exa (research), CMS drivers (webhook, Webflow, WordPress).

**Directory Roles:**
- `src/common` – infra utilities (HTTP, session, queue, provider registry)
- `src/entities/*` – domain models + repository facades (DB access)
- `src/features/*` – UI + server logic per feature
- `src/blocks` – composed UI components
- `src/pages/*` & `src/app/routes/*` – loaders/controllers + TanStack route definitions
- `src/worker` – worker entrypoints & processors
- `tests` – Vitest & Playwright test definitions

**Auth:** Google OAuth via server-side code exchange. Stateless session cookie (`seoa_session`, signed). `E2E_NO_AUTH=1` bypasses guards in tests.

---

## 1. Actors

- **User** (web/CLI)
- **HTTP API** (TanStack Start file routes)
- **Postgres** (see `docs/erd.md` for full schema)
- **RabbitMQ** (`seo.jobs` exchange; queues: `seo_jobs.crawler`, `seo_jobs.general`)
- **Workers** (crawler, general)
- **External Providers:**
  - Playwright (headless crawl)
  - DataForSEO (keyword ideas, metrics, SERP)
  - OpenAI (LLM for summaries, keywords, article generation)
  - Exa (research)
  - CMS (webhook, Webflow, WordPress, etc.)

---
## 1A. Crawl BFS + Map-Reduce (DB-Only)

Design (concise)
- Start at landing page (same-host only, exclude subdomains)
- Ignore robots.txt (owner consent via submission)
- BFS with limits: N pages, maxDepth, maxBreadth per node
- Map: per-page plain-text `content` + 2–3 sentence `summary`
- Reduce: concat page summaries → LLM → plain-text `website.summary`

Algorithm (BFS)
- Inputs: `rootUrl`, `N=50` (`env.crawlBudgetPages`), `maxDepth=2` (`env.crawlMaxDepth`), `maxBreadth=20` (`config.crawl.maxBreadth`)
- State: `queue[{url, depth}]`, `seen`
- Loop until visited < N and queue not empty:
  - dequeue `{url, depth}`; if `depth>maxDepth` or seen → continue
  - fetch/render (Playwright preferred; fallback to fetch)
  - extract `title`, `bodyText`; links = anchors → normalize → filter → dedupe
  - `content = title + "\\n\\n" + bodyText`
  - `summary = summarizePage(content)` (plain text)
  - persist row in `crawl_pages`
  - enqueue up to `maxBreadth` normalized same-host links with `depth+1`

URL Rules
- same host equality only; no subdomains
- normalize: drop hash/query; collapse trailing slash
- filter: skip assets (pdf/images/media) and noisy paths (auth, admin, search, tag/category floods)

Reduce (site summary)
- Build big text: for each page → `=== URL: <url> | Title: <title> ===\\n<summary>`
- `summarizeWebsiteDump(siteUrl, bigText)` → `websites.summary`
- Fallback: `summarizeSite(sample pages)` if dump fails

DB Shape (crawl)
- `crawl_jobs(id, website_id, started_at, completed_at, created_at)`
- `crawl_pages(id, website_id, run_id, url, http_status, title TEXT, content TEXT, summary TEXT, created_at)`
- Removed legacy: `meta_json`, `headings_json`, `content_text`, `page_summary_json`

Rationale
- Plain-text storage simplifies pipelines and reduces JSON friction
- BFS biases shallow, crawlable pages; penalizes deep rarely-visited paths naturally

---

## 2. Flow A – Dashboard Onboarding → Crawl → Keywords → Plan

### 2.1 User Journey (Dashboard)

**Purpose:** Convert landing visitors into active websites with ready content plan.

**Funnel Steps:**
1. **Landing form** (`/` hero)
   - Input: website URL
   - Validate domain format + reachability (HEAD fetch w/ timeout)
   - Submit → stash payload in OAuth `state` (`{ redirect:'/dashboard/ensure', domain, slug }`)
   - If session exists, skip OAuth → `POST /api/websites`

2. **OAuth Callback** (`/api/auth/callback/google`)
   - Parse state, hydrate session cookie
   - Redirect to `/dashboard/ensure?site={siteUrl}`
   - On denial → return to landing with toast "Sign-in cancelled"

3. **Ensure Route** (`/dashboard/ensure?site=<url>`, server-owned)
   - Require authenticated session with active org
   - Normalize site from query (canonicalize host; compute slug/name server-side)
   - Insert website (org-scoped) or reuse existing
   - Update session `activeWebsiteId`, enqueue crawl job
   - Redirect to `/dashboard?website={id}`

4. **Dashboard** (`/dashboard?website={id}`)
   - Dashboard shows Website Status steps + Business Summary
   - Snapshot fetched via React Query (30s refetch) for crawl/keywords/plan status

5. **Crawl Animation**
   - While snapshot lacks `crawl_pages` rows: show faux keyword list (300–500 ms cadence)
   - Switch to real data once `crawl_pages` populated; show recent URLs with status chip
   - Progress meter from representatives count (if available)

6. **Keyword Animation**
   - Trigger when `keywords` count > 0
   - Stream top keyword tuples (`keyword | metrics`) in ticker

7. **Plan Summary Card**
   - When `articles` table gains rows, swap to plan summary card
   - Display first publish date, number scheduled, CTA `View content plan`
   - Provide inline tip to connect CMS integration; link to settings

8. **Completion Redirect**
   - On first `articles.status='scheduled'`, auto-redirect to `/dashboard`
   - Persist query flag `?onboarding=done` so dashboard can show welcome banner + next steps checklist

**Onboarding States (visualized on Dashboard):**
- `auth_required`: no session; redirect to landing
- `url_required`: authenticated, no website created yet
- `initializing`: website row exists, jobs enqueued
- `crawling`: `crawl_pages` non-empty
- `keywording`: `keywords` populated, articles empty
- `planning`: articles queued exist, none scheduled
- `ready`: scheduled article(s) present

**Error Paths:**
- OAuth denial → return to landing with toast "Sign-in cancelled"
- Website create fails → display message + allow retry with same domain
- Snapshot polling timeout (>2 min) → show fallback CTA to dashboard

**Telemetry:**
- Onboarding telemetry endpoint removed; events not recorded

### 2.2 Backend Sequence (Init Loop)

```
User              API                  Postgres         RabbitMQ               Worker (crawler)                Worker (general)
 |
 |  POST /api/websites
 | ------------>  INSERT websites      -----------------> publish(crawl.{website})
 |                (org-scoped)
 |  202 Accepted
 |  <------------
 |                                                            |
 |                                                            └──> Crawler Worker:
|  Poll snapshot                                                  • Map sitemap (index + child)
 |  (GET /api/websites/:id/snapshot)                               • Clean URLs, dedupe, same host
 | ----------------> SELECT websites                               • Rank representatives (LLM or first N≤100)
 |  <--------------- + crawl status                                • Crawl reps (Playwright, 8 concurrent)
 |                                                                  • Extract {title,meta,headings,content_text}
 |                                                                  • Per-page LLM summary → page_summary_json
 |                                                                  • INSERT crawl_jobs, crawl_pages (DB only)
 |                                                                  • Reduce all page summaries → websites.summary
|                                                                  • publish(generateKeywords.{website}) -----> Keyword Worker:
 |                                                                                                                 • Seeds (LLM from summary, 10 terms)
 |                                                                                                                 • One call: keyword_ideas/live (limit ≤30, include_serp_info=false)
 |                                                                                                                 • Normalize phrase → UPSERT keywords (per website)
 |                                                                                                                 • No global cache; no auto-refresh; SERP fetched later on article gen
 |                                                                                                                 • Enqueue plan rebuild (if requested)
```

**Snapshot Endpoint:**
`/api/websites/:id/snapshot` aggregates: `websites.summary`, `keywords`, `articles`, `integrations`.
Geo Defaults: `language_code`/`location_code` derived from `websites.defaultLocale` (e.g., en-US → en + 2840) with names mapped from DataForSEO lists.

### 2.3 Crawl Pipeline Detail

**Input:** `websites.url`

**Steps:**
1. Fetch sitemap (index + child); clean URLs, dedupe, same host
2. Rank representatives (LLM or fallback first N, N≤100)
3. Crawl representatives (Playwright); extract `{title,meta,headings,content_text}`
4. **Map:** LLM summarize each page → `crawl_pages.page_summary_json`
5. **Reduce:** LLM summarize all page summaries → `websites.summary`

**Defaults:**
- N (representatives): 100 (override with `MAX_PAGES_CRAWLED` env)
- Model: from `SEOA_LLM_MODEL`
- Playwright concurrency: 8; timeout/page: 12s

**Storage (DB only):**
- `crawl_jobs(id, website_id, started_at, completed_at)`
- `crawl_pages(id, website_id, run_id, url, http_status, title, content, summary, created_at)`
- `websites.summary` (reduce over per‑page summaries)
- `keywords(id, website_id, phrase_norm, language_code/name, location_code/name, search_volume, difficulty, cpc, competition, vol_12m_json, impressions_json, raw_json, metrics_as_of)`

**Error Handling:**
- If rank fails → take first N cleaned sitemap URLs
- If page fetch fails → skip; continue
- If per‑page summarize fails → store short excerpt as fallback in `page_summary_json`

**Process Contract:**
Input `websites.url` → Output `websites.summary`, `crawl_jobs` + `crawl_pages`
(See `docs/erd.md` for full schema)

### 2.4 Keyword Generation (DB-only, Global Cache)

**Goal:** Build reusable global keyword cache; websites point to global rows; fetch provider metrics only on cache miss.

**Inputs:**
- Website: `websites.summary`
- Headings: sample from latest `crawl_pages`

**Keyword Store (per website):**
- `keywords(id, website_id, phrase_norm UNIQUE per site+geo+lang, include BOOLEAN, starred INT, metrics columns…)`

**Steps:**
1. **Seeds:** from website summary (LLM) + headings (parser)
2. **Expand:** DataForSEO keyword ideas
3. **Canon:** normalize phrase
4. **Metrics:** fetch and upsert volume/difficulty
5. **Attach:** persist into `keywords` with default `include=false` (auto-include top picks)

**Notes:**
- No location/language/device dims; keyword identity is the string
- TTL default 30d; background refresh can update metrics

**Process Contract:**
Input `websites.summary` (+ headings) → Output `keywords` (per‑site rows)

---

## 3. Flow B – Daily Scheduler (Generate & Publish)

**Scope:**
- Plan runway: keep 30 days of titles+outlines (QUEUED) ahead
- Global policy: 3‑day generation buffer; daily publish when due
- Maintain buffer: items with `scheduled_date ≤ today+3` move QUEUED → SCHEDULED by generating body
- Publish: items with `scheduled_date ≤ today` and SCHEDULED
- First‑run: if no SCHEDULED/PUBLISHED exist, publish today after generation
- Entitlement: only within active subscription window; gate per `scheduled_date`

**Triggers:**
- Worker interval (default 24h; `SEOA_SCHEDULER_INTERVAL_MS` override)
- Manual: `POST /api/schedules/run { websiteId }`

**Selection Rules:**
For each website with a plan:
- **Outline runway:** planner ensures 1/day up to `today+30`; deletions leave gaps
- **Generation buffer:** `status='queued'` and `scheduled_date ≤ today+3` and subscription active → enqueue `generate`
- **First‑run publish:** none scheduled/published AND `scheduled_date===today` → publish after generate
- **Normal publish:** `status='scheduled'` and `scheduled_date ≤ today` and allowed integration connected → enqueue `publish`

**Subscription Gate:**
A plan item is eligible only if the organization's subscription is active for the target date.
Active when status is `active|trialing` and `scheduled_date <= activeUntil` (or `<= trialEndsAt` during trial).

**Sequence:**
```
Cron/User                API                          RabbitMQ                      Worker (general)
  |
  |  POST /api/schedules/run
  | ------------------------> enqueue(generate.{website}) ------------------->  Generate Worker:
  |                                                                              • List articles (today..today+3)
  |                                                                              • Filter by subscription active
  |                                                                              • outline-if-missing → body via LLM
  |                                                                              • UPDATE articles(status='scheduled', body_html)
  |                                                                              • First-run: enqueue publish for today
  |                                                                              • Normal publish: scheduled_date ≤ today -----> Publish Worker:
  |                                                                                                                             • Fetch article + integration config
  |                                                                                                                             • Build PortableArticle payload
  |                                                                                                                             • Call connectorRegistry.publish(type, article, config)
  |                                                                                                                             • Update articles(status='published', url, publish_date)
```

**Worker Behavior:**
- `runDailySchedules()` enqueues generate/publish; passes `publishAfterGenerate=true` on first run
- Interval 24h default

**Process Contracts:**
- **Plan/Schedule:** Input `keywords(include=true)` → Output `articles` rows (30‑day runway or full subscription period; round‑robin; deletions leave days empty)
- **Generate Articles:** Input `articles(status=queued)` within global 3‑day buffer → Output `articles(status=scheduled, body_html)`
- **Publish:** Input `articles(status=scheduled, scheduled_date<=today)` + integration → Output `articles(status=published, url)`

**Notes:**
- Planner fills 1/day across subscription; deletions leave gaps
- DB only; no filesystem artifacts

---

## 4. Flow C – Integrations (Lifecycle & Publish Handshake)

### 4.1 Integration Lifecycle

**Architecture:**
- `src/entities/integration/*`: persist website integrations (`integrations` table), OAuth tokens, status transitions
- `src/features/integrations/server/*`: connector registry, runtime adapters, shared helpers (no React deps)
- Routes, workers, CLI import from server package

**Steps:**
1. **Create:** `/api/integrations` stores `{websiteId,type,status,configJson}` via entities repo
2. **Configure:** UI writes provider-specific `configJson` (sites, tokens, collection IDs, publish mode)
3. **Verify:** routes call `connectorRegistry.test(type, configJson)`; status flips `connected|error`
4. **Publish:** scheduler queues jobs → `connectorRegistry.publish(type, article, config)`; connectors map PortableArticle into provider API
5. **Monitor:** workers update `status`, attach metadata (externalId, url), surface errors in integrations tab

### 4.2 Publish Handshake Sequence

```
Daily Scheduler      Worker (publish)       Integration Registry      CMS Provider (Webflow/Webhook/WordPress)
     |
     |  publish.{article}
     | -----------------> Publish Worker:
     |                     • Fetch article
     |                     • Fetch integration config
     |                     • Build PortableArticle
     |                     • registry.publish(type, article, config) -----> Connector Adapter:
     |                                                                         • Validate config (zod schema)
     |                                                                         • Map PortableArticle → CMS format
     |                                                                         • POST to CMS API (with retry logic)
     |                                                                         • Return {externalId, url, status}
     |                     • Update articles(status='published', url, publish_date, externalId)
     |                     • On error: retry 3x with exponential backoff (30–90s jitter)
     |                     • On 410 response: disable integration
```

### 4.3 Connect Flows (per Provider Type)

**Webhook (default):**
- Inline form (URL + secret)
- Submit → `POST /api/integrations` → optimistic card with switch enabled
- Provide copyable sample payload + curl test snippet

**OAuth providers** (Webflow, HubSpot, Squarespace, Wix):
- `Connect` opens hosted OAuth window (new tab)
- On callback server writes/updates integration + secrets, card auto-activates
- UI listens on channel (Pusher/long-poll) or polls `/snapshot` until status=connected

**API token providers** (Shopify, Ghost, WordPress app passwords, Notion, Unicorn Platform):
- `Connect` opens drawer containing form
- Submit saves config & immediately runs `test`; success flips to connected

**REST API:**
- Card links to docs and exposes test button only
- Scheduling uses manual triggers (`publish` endpoint)
- Treated as always available (no toggle)

**Coming Soon:**
- Disabled cards with CTA "Join Beta" collecting email via modal; no API calls

### 4.4 PortableArticle & Webhook Baseline

**PortableArticle** (see `src/common/connectors/interface.ts`) is authoritative payload for every connector.
**Webhook connector** is zero-dependency baseline; all other integrations adapt the same structure.

**Delivery:**
`POST` JSON with headers:
- `X-SEOA-Signature` (`sha256=` HMAC of body using stored secret)
- `X-SEOA-Timestamp` (ISO8601)
- `X-SEOA-Integration-Id`
- `X-SEOA-Website-Id`

**Body schema:**
```json
{
  "meta": {
    "integrationId": "int_xxx",
    "websiteId": "site_xxx",
    "articleId": "art_xxx",
    "trigger": "schedule|manual|test",
    "triggeredAt": "2025-11-02T00:12:34Z",
    "dryRun": false,
    "locale": "en-US"
  },
  "article": { /* PortableArticle */ }
}
```

**Retry Policy:**
- Receivers must return 2xx within 10s
- Non-2xx triggers retry with exponential backoff (max 3 attempts, jitter 30–90s)
- Respond `410` to disable integration

**Connector Registry:**
- `registry.ts` loads adapters from `server/*`
- Each adapter implements `{type,name,publish(),test()?}` and may override `buildPortable(article)`
- Shared helpers: slug/excerpt builders, media upload queue, rate-limit wrapper, OAuth token refresh hooks
- Routes/workers invoke registry only; they never reach into individual connector modules

**Configuration Patterns:**
- Store provider fields inside `configJson` per `type`
- Secrets (tokens, app passwords) encrypted at rest
- All connectors validate config via zod schema before persisting
- Each adapter exposes metadata via `getConnectorManifest()` describing config schema, supportsAutoActivate, supportsTest, supportsToggle
- Status values: `connected` (auto-publish enabled), `disconnected` (config retained, no publishes), `error` (last test failed), `pending` (mid OAuth flow), `coming_soon` (not selectable)

---

## 5. Flow D – Snapshot APIs (Read-Only Views)

**Snapshot Endpoints:**
- `GET /api/crawl/pages?websiteId` → DB `crawl_pages` (recent crawl pages from DB)
- `GET /api/websites/:id/snapshot` → Aggregator: `websites` + `keywords` + `articles` + `integrations`
  - Computes: `status`, `isActive`, `isConfigured`, `supportsOneClick`, `missingCapabilities`
  - When connector requires additional capabilities (images, categories), `missingCapabilities` array blocks activation + surfaces checklist

**Usage:**
- Dashboard health metrics
- Onboarding polling (5s interval until ready state)
- Integrations tab (card status updates)

---

## 6. Provider Touchpoints

### 6.1 DataForSEO Keyword Ideas (Primary Endpoint)

**Base URL:** `https://api.dataforseo.com`
**Auth:** HTTP Basic Auth (export `DATAFORSEO_AUTH=$(printf '%s:%s' "$LOGIN" "$PASSWORD" | base64)`)

- Endpoint: `/v3/dataforseo_labs/google/keyword_ideas/live`
- Contract: accepts up to 200 seed keywords, returns keyword ideas with `keyword_info`, `keyword_properties`, `impressions_info`.
- Client wrapper: `src/common/providers/impl/dataforseo/keyword-ideas.ts` (20s timeout, single-task payload, error logging).
- Provider interface: `src/common/providers/interfaces/keyword-ideas.ts` standardises return shape for providers.
- Geo helpers: `src/common/providers/impl/dataforseo/geo.ts` exposes `locationCodeFromLocale`, `languageCodeFromLocale`, plus name lookups.

**Keyword Generation Funnel:**
```
Seed selection (crawl summary + heuristics)
  ↓ ≤200 seeds → keyword_ideas/live (limit configurable, default 100)
Normalize + dedupe keyword_info
  ↓ persist into keywords (metrics_json payload)
Optional planner hook
  ↓ trigger schedule refresh when keyword list changes
```

Mock mode removed: keyword ideas always use DataForSEO.

**Smoke checks:**
```bash
curl -H "Authorization: Basic $DATAFORSEO_AUTH" \
     -H 'content-type: application/json' \
     -d '[{"keywords":["interview"],"location_code":2840,"language_code":"en"}]' \
     https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live
```

### 6.2 DataForSEO SERP (Organic Snapshot)

- Endpoint: `/v3/serp/google/organic/live/regular`
- Purpose: capture top organic results (rank, title, URL, snippet) for each prioritized keyword.
- Client wrapper: `src/common/providers/impl/dataforseo/serp.ts` (20s timeout, trimmed to topK results, text dump cached with snapshot).
- Device: desktop by default; mobile supported via optional parameter.
- SERP snapshots come from DataForSEO/scraping only.

### 6.2 Other Providers

**Playwright (crawl):**
- Headless browser automation
- Concurrency: 8 simultaneous pages
- Timeout: 12s per page
- Extracts: `{title, meta, headings, content_text}`

**OpenAI (LLM):**
- Model: from `SEOA_LLM_MODEL` (default: gpt-5-2025-08-07)
- Token budget: 80% for summaries
- Uses:
  - Per-page summaries (map phase)
  - Website summary (reduce phase)
  - Seed keywords generation
  - Article outline + body generation

**Exa (research):**
- AI-powered intelligent search and crawling
- Used for content research and enrichment

**CMS Drivers:**
- See Connector Catalog (Appendix B) for full list

---

## 7. Error Handling & Observability

**Job Transitions:**
- Tracked in queue system: `queued`, `running`, `completed`, `failed`
- No filesystem logs; all in DB

**Worker Lineage:**
- Workers append lineage (`logs/lineage.json`) per node run
- Job log JSONL includes status transitions

**Provider Credentials:**
- Providers resolved through `src/common/providers/registry.ts`
- External APIs (OpenAI, Exa, DataForSEO) are required; missing credentials fail jobs immediately
- Metrics & SERP caching use Postgres caches (no file cache)
- Third-party failures recorded in job logs (DB)

**Crawl Error Handling:**
- If rank fails → take first N cleaned sitemap URLs
- If page fetch fails → skip; continue
- If per‑page summarize fails → store short excerpt as fallback

**Integration Error Handling:**
- Failed test marks card `Error`; user sees toast + inline description
- Card provides `Retry` button (calls `POST /api/integrations/$id/test`)
- Publish failures trigger retry with exponential backoff (max 3 attempts, jitter 30–90s)
- Respond `410` to disable integration

---

## 8. Storage Policy

**DB-Only (Stateless):**
- All crawl pages, summaries, keyword caches, article drafts, and logs persist in Postgres
- No filesystem bundles in production
- Stateless across instances

**Queue Storage:**
- RabbitMQ `seo.jobs` topic exchange
- Queues: `seo_jobs.crawler` (crawl jobs), `seo_jobs.general` (generateKeywords, generate, publish)
- Worker queue name set via `SEOA_QUEUE_NAME` per worker type

---

## Appendix A: Selected API Routes

- `POST /api/websites` → `{ website }`, enqueues crawl when queue enabled
- `GET /api/websites/:id/snapshot` → DB aggregator for dashboard
- `GET /api/crawl/pages?websiteId` → recent crawl pages from DB
- `POST /api/keywords/generate` → queue generateKeywords
- `POST /api/plan/create` → rebuild plan (articles rows)
- `POST /api/articles/generate` → queue article generation for a plan item
- `POST /api/orgs { action: 'switch'|'invite' }` → switch org or emit stub invite email
- `GET /api/blobs/:id` → blob store (auth required unless `SEOA_BLOBS_PUBLIC=1`)

---

## Appendix B: Connector Catalog (Competitor Parity)

| Integration | Status | Auth | Publish Modes | Notes |
|---|---|---|---|---|
| REST API | GA | API key | Draft/Publish | Direct job control via `/api/articles/:id/publish` |
| Webhook | GA | Shared secret | Draft/Publish | Reference implementation; fallback for custom stacks |
| WordPress (.org/.com) | Beta | App password/JWT | Draft/Publish | Maps PortableArticle → `wp-json/wp/v2/posts` |
| Webflow | Beta | OAuth token | Draft/Publish | Collection schema mapping per site |
| Shopify | Planned | Admin API token | Draft | Blog + metafields support, images via asset API |
| Ghost | Planned | Admin API key | Draft/Publish | HTML/Markdown dual support |
| HubSpot | Planned | Private app token | Draft/Publish | CMS Blog v3 endpoint |
| Notion | Planned | Internal integration | Draft | Block tree expansion |
| Squarespace | Planned | OAuth client | Draft/Publish | Content API |
| Wix | Planned | OAuth client | Draft/Publish | Content Manager |
| Framer | Planned | Personal token | Draft | Falls back to webhook until public API matures |
| Unicorn Platform | Planned | API key | Draft | REST endpoints / CSV import |
| Zapier-style | Via webhook | n/a | Workflow-defined | Documented recipes only, no native connector |

---

## Appendix C: Configuration & Environment

**Provider API Keys (production):**
- `DATAFORSEO_AUTH` (or `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD`)
- `OPENAI_API_KEY`
- `EXA_API_KEY`
- `RESEND_API_KEY`

**Queue Configuration:**
- `RABBITMQ_URL`
- `SEOA_QUEUE_NAME` (per worker type: `seo_jobs.crawler`, `seo_jobs.general`)

**Database:**
- `DATABASE_URL`

**Session & Auth:**
- `SESSION_SECRET`
- `ADMIN_EMAILS`
- CMS credentials as needed per integration

**Scheduler:**
- `SEOA_SCHEDULER_INTERVAL_MS` (default: 24h)

**Provider Control:**
- `SEOA_LLM_MODEL` (default: gpt-5-2025-08-07)
- `SEOA_DFS_TIMEOUT_MS` (default: 20s)
- `SEOA_DFS_DEBUG=1` (enable debug logging)
- `SEOA_DFS_SUGGESTIONS_FIRST=1` (use suggestions before For Keywords)
- `SEOA_PROVIDER_KEYWORD_IDEAS=dataforseo` (override keyword ideas provider)

**Test Overrides:**
- `E2E_NO_AUTH=1` (bypass auth guards in tests)
- `SEOA_BLOBS_PUBLIC=1` (public blob access for testing)

---

## Notes

- Terminology: "websites" only (never "projects")
- Storage: "DB-only", "stateless" (no bundle/filesystem references)
- Queue names: `seo.jobs` exchange, `seo_jobs.crawler`/`seo_jobs.general` workers
Mock flags removed.
- Cross-refs: Sequence links to erd.md sections for produced tables; pages.md links to Snapshot APIs section here

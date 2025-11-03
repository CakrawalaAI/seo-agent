# SEO Agent Architectural Conventions

## Layered Flow (Bytes → Pixels)
```
PostgreSQL
  ↓ Drizzle schemas (src/entities/*/db/schema.ts)
  ↓ Domain models (src/entities/*/domain)
  ↓ Entity services & repositories (src/entities/*/service.ts)
  ↓ Server controllers/loaders (src/pages/**/loader.ts or controller.ts)
  ↓ Feature clients (src/features/**/client)
  ↓ Blocks (src/blocks/**) when composing multiple features
  ↓ Page components (src/pages/**/page.tsx)
  ↓ Thin file routes (src/app/routes/**.tsx)
  ↓ Root shell (src/app/__root.tsx, router.tsx)
  ↓ React DOM → pixels
```

## Directory Roles
- `docs/` — specifications, architecture notes.
- `src/common/` — infrastructure primitives and generic utilities (HTTP helpers, logger, env, queue, db client adapters). No domain knowledge.
- `src/entities/<entity>/`
  - `db/schema.ts` — Drizzle tables.
  - `domain/` — type definitions, validation helpers.
  - `service.ts` (and optional `repository.ts`) — API/DB access used by loaders, worker, CLI.
- `src/features/<feature>/`
  - `client/` — main UI components for that feature; consume loader data or TanStack Query.
  - `server/` — mutations/actions that call entity services.
  - `shared/` — state machines, hooks, view utilities.
- `src/blocks/` — cross-feature composites (dashboards, layouts) that assemble multiple features; may import `features`, `common`, `entities`.
- `src/pages/<route-id>/`
  - `loader.ts` (or `controller.ts`) — compose entity services, run privileged work, prime Query cache.
  - `page.tsx` — page-level component; imports feature clients and blocks; receives loader data.
- `src/app/routes/<route-id>.tsx` — TanStack Start file routes; import `{ loader, Page }` from `src/pages` and register with `createFileRoute`.
- `src/cli/` — CLI commands layered on entities/services.
- `src/worker/` — background processors using entities + common infra.
- `tests/` — aligned with entities, features, pages, and integration paths.

## Import Direction
`common → entities → features → blocks → pages → routes`

- `common` is dependency-free upward.
- `entities` may import from `common` only.
- `features` may import from `common` and `entities`.
- `blocks` may import from `features`, `entities`, `common`.
- `pages` may import from `blocks`, `features`, `entities`, `common`.
- `routes` import only from `pages` (plus TanStack router utilities).

## Data Loading Strategy
- Route loaders live in `src/pages/**/loader.ts`, orchestrating parallel service calls, auth checks, and Query priming.
- Feature components remain declarative, relying on hydrated loader data or TanStack Query cache (`useSuspenseQuery`).
- Component-scoped fetches are reserved for purely client-side concerns; all SSR-critical data originates in the loader.

## UI Components
- Use shadcn/ui components from `@src/common/ui/*`.
- When a needed component is missing, add via CLI: `bunx --bun shadcn@latest add <component>`.
- New UI components must live in `src/common/ui/` and import `cn` from `@src/common/ui/cn`.
- Data tables: use TanStack Table with `@src/common/ui/data-table` patterns (sorting, pagination, filtering via columns). Do not hand-roll table behavior.
- Date pickers: compose `@src/common/ui/date-picker` (Calendar + Popover).
- Combobox: compose `@src/common/ui/combobox` (Popover + Command).
- Selects: use `@src/common/ui/select` (no native `<select>`).

## Networking Defaults
- Outbound DNS is configured to prefer IPv4 by default to avoid IPv6 egress/DNS instability with external APIs (OpenAI, DataForSEO, etc.).
- This is enforced at runtime via `dns.setDefaultResultOrder('ipv4first')` in `src/common/infra/network.ts` and loaded by workers and providers automatically.
- Do not require users to export extra env for this. Only set `SEOA_IPV4_FIRST=0` if you explicitly need to disable IPv4-first (rare).
- Schema changes must be generated: run `bunx drizzle-kit generate` (or project alias) instead of hand-writing SQL migrations to keep metadata in sync.

## Operational Conventions
- Always run `bun run db:migrate` after pulling schema changes; migrations are idempotent via `DO $$` guards — do **not** rely on runtime ALTER fallbacks.
- `bun run db:reset` drops `public`/`drizzle` schemas and replays migrations; only use `bun run db:generate` when you intentionally add a schema change.
- Worker/CLI bootstraps no longer patch columns; if you see missing columns, fix via migrations instead of runtime ALTERs.
- When executing project scripts from automations, pass an explicit timeout (`timeout_ms`) so hung processes can be surfaced quickly.

## Mock Provider System (Composable)

The SEO agent supports atomic mock providers for offline development and testing without external API costs. Each mock can be enabled independently via environment flags.

### Atomic Mock Flags

| Flag | Env Var | Replaces | Returns |
|------|---------|----------|---------|
| `mocks.crawl` | `SEOA_MOCK_CRAWL=1` | Website scraping (Playwright/fetch) | Hardcoded PrepInterview.ai pages with realistic content |
| `mocks.llm` | `SEOA_MOCK_LLM=1` | OpenAI API calls | Topic-aware PrepInterview content (summaries, outlines, articles) |
| `mocks.keywordExpansion` | `SEOA_MOCK_KEYWORD_EXPANSION=1` | DataForSEO keyword expansion | PrepInterview-themed keywords with metrics |
| `mocks.serp` | `SEOA_MOCK_SERP=1` | SERP scraping/APIs | Fake Google search results for interview prep queries |

### Mock Composability

**Full Mock Mode (Zero External APIs):**
```bash
export SEOA_MOCK_CRAWL="1"
export SEOA_MOCK_LLM="1"
export SEOA_MOCK_KEYWORD_EXPANSION="1"
export SEOA_MOCK_SERP="1"
```
All pipeline steps use mocks. No OpenAI, DataForSEO, or web requests.

**Hybrid Mode Examples:**
```bash
# Real crawl + mock LLM (no OpenAI costs)
export SEOA_MOCK_LLM="1"

# Real everything except keyword expansion (test DataForSEO alternatives)
export SEOA_MOCK_KEYWORD_EXPANSION="1"

# Mock crawl only (test discovery pipeline with real APIs)
export SEOA_MOCK_CRAWL="1"
```

**Legacy Compatibility:**
```bash
# Old flag - enables all discovery-related mocks
export SEOA_DISCOVERY_MOCK_MODE="1"
# Equivalent to: SEOA_MOCK_CRAWL=1 + SEOA_MOCK_LLM=1 + SEOA_MOCK_KEYWORD_EXPANSION=1
```

### Pipeline Flow with Mocks

```
Discovery Pipeline:
├─ CRAWL → pages from domain
│   Real: Playwright/fetch scraping
│   Mock: PrepInterview.ai pages (5 hardcoded URLs)
├─ LLM.summarizeSite() → business summary + clusters
│   Real: OpenAI gpt-4o-mini
│   Mock: PrepInterview business description
├─ LLM.expandSeeds() → seed keywords
│   Real: OpenAI gpt-4o-mini
│   Mock: 20 PrepInterview keywords
├─ extractSeedsFromHeadings() → parse page headings
│   (Pure function, no mock needed)
├─ provider.keywordsForKeywords() → expand seeds
│   Real: DataForSEO Keyword Suggestion API
│   Mock: PrepInterview keywords with volume/CPC/difficulty
└─ enrichWithMetrics() → SEO metrics
    Real: DataForSEO Bulk Keyword Difficulty API
    Mock: Generated metrics (volume, difficulty, CPC)

Article Generation Pipeline:
├─ LLM.draftOutline() → title + outline
│   Real: OpenAI gpt-4o-mini
│   Mock: Topic-aware outline (behavioral vs technical vs FAANG)
├─ ensureSerp() → SERP data
│   Real: DataForSEO SERP API or scraping
│   Mock: Fake competitor results (LeetCode, Pramp, etc.)
├─ LLM.generateBody() → article HTML
│   Real: OpenAI gpt-4o-mini
│   Mock: Topic-matched article template with PrepInterview CTAs
└─ LLM.factCheck() → quality score
    Real: OpenAI gpt-4o-mini (optional)
    Mock: Returns score=85 (always pass)
```

### Mock Content Details

**Crawler Mock** (`src/common/providers/impl/mock/crawler.ts`):
- 5 PrepInterview.ai pages: home, features, pricing, behavioral guide, technical guide
- Realistic meta tags, headings, content text
- Used when `SEOA_MOCK_CRAWL=1`

**LLM Mock** (`src/common/providers/impl/mock/llm.ts`):
- Business summary: AI-powered interview prep platform description
- Topic detection: behavioral | technical | faang | system-design | general
- Article generation: Topic-aware templates with STAR method, algorithm patterns, company tips
- Used when `SEOA_MOCK_LLM=1`

**Keyword Mock** (`src/common/providers/impl/mock/keyword-generator.ts`):
- 15+ base PrepInterview keywords with real metrics
- Variations generated from domain: "prepinterview ai platform", "prepinterview ai tool", etc.
- Volume: 1700-6600, Difficulty: 38-46, CPC: $1.80-$4.55
- Used when `SEOA_MOCK_KEYWORD_EXPANSION=1`

**SERP Mock** (`src/common/providers/impl/mock/serp.ts`):
- Competitor sites: LeetCode, InterviewCake, Pramp, Glassdoor, HackerRank
- Keyword-aware filtering (behavioral queries exclude coding sites)
- Used when `SEOA_MOCK_SERP=1`

### When to Use Mocks

**Development:**
- Fast iteration without API rate limits or costs
- Test pipeline changes without external dependencies
- Develop UI/UX with consistent data

**Testing:**
- Integration tests with deterministic outputs
- CI/CD pipelines without API credentials
- Reproduce issues with known data

**Production:**
- Never use mocks in production
- All flags should be unset or `"0"`

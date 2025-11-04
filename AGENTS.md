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

### Stateless Runtime (DB‑only)
- No filesystem/bundle artifacts. Workers must not write to `.data/**`.
- All crawl pages, summaries, keyword caches, article drafts, logs persist in Postgres.
- Set `SEOA_ENABLE_BUNDLE=0` (default). Any bundle helpers are no‑ops under this mode.

## Mock Provider System (Composable)

> **Caution:** Mock toggles exist only for keyword ideas and SERP snapshots. Do not introduce new provider stubs or dev flags without architecture review; production flows must rely on real external APIs.

The SEO agent supports atomic mock providers for offline development and testing without external API costs. Each mock can be enabled independently via environment flags.

### Atomic Mock Flags

| Flag | Env Var | Replaces | Returns |
|------|---------|----------|---------|
| `keywordGenerator` | `MOCK_KEYWORD_GENERATOR=true` *(aliases: `SEOA_MOCK_KEYWORD_GENERATION`, `SEOA_MOCK_KEYWORD_EXPANSION`, `SEOA_DISCOVERY_MOCK_MODE`)* | DataForSEO keyword ideas | PrepInterview-themed keywords with metrics |
| `serp` | `SEOA_MOCK_SERP=1` | SERP scraping/APIs | Fake Google search results for interview prep queries |

### Mock Composability

**Keyword Mock Only:**
```bash
export MOCK_KEYWORD_GENERATOR="true"
```
Only the keyword ideas step uses the mocked provider; crawl + LLM remain real.

**Hybrid Mode Examples:**
```bash
# Real everything except keyword generation (avoid DataForSEO costs)
export MOCK_KEYWORD_GENERATOR="true"

# Mock SERP snapshots while keeping crawl/LLM real
export SEOA_MOCK_SERP="1"
```

**Legacy Compatibility:**
```bash
# Legacy flag - enables keyword mock
export SEOA_DISCOVERY_MOCK_MODE="1"
# Equivalent to: MOCK_KEYWORD_GENERATOR=true
```

### Runtime Overrides

```bash
# Limit crawler to 10 pages per run
export MAX_PAGES_CRAWLED=10
```

### Pipeline Flow with Mocks

```
Keyword Generation Pipeline:
├─ CRAWL → pages from domain
│   Real: Playwright/fetch scraping
│   Mock: PrepInterview.ai pages (5 hardcoded URLs)
├─ summarizeSite() → business summary + seed heuristics
│   Real: OpenAI gpt-4o-mini
├─ seedExtractor() → ≤200 keywords
│   Real: LLM + heading parser
├─ provider.keywordIdeas() → expand seeds
│   Real: DataForSEO keyword_ideas/live (limit≤100)
│   Mock: 100 deterministic ideas w/ keyword_info, keyword_properties, impressions
└─ persistKeywords() → write keywords rows
    Real: Drizzle UPSERT + metrics JSON snapshot
    Mock: same path using generated metrics

Article Generation Pipeline:
├─ LLM.draftOutline() → title + outline
│   Real: OpenAI gpt-4o-mini
├─ ensureSerp() → SERP data
│   Real: DataForSEO SERP API or scraping (mock optional)
├─ LLM.generateBody() → article HTML
│   Real: OpenAI gpt-4o-mini
└─ LLM.factCheck() → quality score (optional)
```

### Mock Content Details

**Keyword Mock** (`src/common/providers/impl/mock/keyword-generator.ts`):
- 100 deterministic ideas seeded by domain + request seeds
- Mirrors DataForSEO keyword ideas schema (`keyword_info`, `keyword_properties`, `impressions_info`)
- Metrics ranges: volume 1.2k–8.4k, CPC $1.20–$4.80, difficulty 18–65
- Used when `MOCK_KEYWORD_GENERATOR=true`

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

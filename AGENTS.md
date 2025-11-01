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

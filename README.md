# SEO Agent

MVP (C00–C10) implemented end‑to‑end with Web UI, REST API, and CLI.

Quick start
- Install: bun install
- Dev server: bun dev (default http://localhost:5173)
- Health: curl http://localhost:5173/api/health
- Lint: bun run lint (Biome)
- Tests: bun test (Vitest), bun run e2e (Playwright; server must be running)

Environment
- SEOA_PUBLICATION_ALLOWED=webhook,webflow
- SEOA_AUTOPUBLISH_POLICY=buffered|immediate|manual (default buffered)
- SEOA_BUFFER_DAYS=3
- SEO_AGENT_BASE_URL=http://localhost:5173 (for CLI)
- REDIS_URL=redis://localhost:6379/0 (required for entitlement cache)
- ENTITLEMENT_CACHE_TTL_SECONDS=3600 (optional override for Redis TTL)

CLI examples
- seo ping
- seo login; seo whoami
- seo project-create --org org-dev --name Acme --site https://acme.com
- seo crawl-run --project <id> ; seo crawl-pages --project <id>
- seo keyword-generate --project <id> ; seo keyword-ls --project <id>
- seo plan-ls --project <id> ; seo plan-move --plan <id> --date YYYY-MM-DD
- seo schedule-run --project <id> ; seo article-ls --project <id>
- seo integration-add-webhook --project <id> --url https://receiver --secret s
- seo integration-add-webflow --project <id> --site site --collection col
- seo article-publish --article <id> --integration <integrationId>

Notes
- Auth/Billing are dev-mocked; providers (crawler/metrics) are seeded; repos are in-memory.
- Swap to Drizzle/Postgres and real providers for production.

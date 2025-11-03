Integrations Spec
=================

Architecture
------------
- `src/entities/integration/*`: persist project integrations (`project_integrations` table), OAuth tokens, status transitions.
- `src/features/integrations/client/*`: React UI (tabs, forms, badges).
- `src/features/integrations/server/*`: connector registry, runtime adapters, shared helpers (no React deps). Routes, workers, CLI import from here.
- `src/common/integrations/format.ts`: label utilities remain dependency-free.
- Alias `@features/integrations/server` exposes registry + connector configs; future `@integrations` barrel may fan out to both client and server facets.

Lifecycle
---------
1. Create: `/api/integrations` stores `{projectId,type,status,configJson}` via entities repo.
2. Configure: UI writes provider-specific `configJson` (sites, tokens, collection IDs, publish mode).
3. Verify: routes call `connectorRegistry.test(type, configJson)`; status flips `connected|error`.
4. Publish: scheduler queues jobs → `connectorRegistry.publish(type, article, config)`; connectors map PortableArticle into provider API.
5. Monitor: workers update `status`, attach metadata (externalId, url), surface errors in integrations tab.

Integrations Route UX (/integrations)
-------------------------------------
- Layout: two-column page; left rail shows per-project integration cards grouped by availability (`Connected`, `Connectable`, `Coming Soon`). Right rail houses context drawer (forms, OAuth prompts, webhook creator).
- Card anatomy: logo, name, status pill (`Connected`, `Error`, `Not Connected`, `Coming Soon`), action button (`Connect`, `Activate`, `Edit`, `Disconnect`), HMAC badge for webhook.
- One-click activation: when connector exposes `connectMode = 'oneClick'` and stored credentials exist, pressing `Activate` immediately flips status to `connected` via `PATCH /api/integrations/$id` (`{status:'connected'}`) without additional modal.
- Toggle behaviour: active connectors render a `Switch` labelled `Publish automatically`; toggling off issues `PATCH` with `{status:'disconnected'}` but retains `configJson`. Re-enabling reuses stored config.
- Error handling: failed test marks card `Error`; user sees toast + inline description. Card provides `Retry` button (calls `POST /api/integrations/$id/test`).
- Filters: top-level segmented control (`All`, `Connected`, `Coming Soon`) to simplify project-level scanning.

Connect Flows
-------------
- Webhook: inline form (URL + secret). Submit calls `POST /api/integrations` → optimistic card with switch enabled. Provide copyable sample payload + curl test snippet.
- OAuth providers (Webflow, HubSpot, Squarespace, Wix): `Connect` opens hosted OAuth window (new tab). On callback the server writes/updates integration + secrets, then the card auto-activates. UI listens on channel (Pusher/long-poll) or polls `/snapshot` until status=connected.
- API token providers (Shopify, Ghost, WordPress app passwords, Notion internal integration, Unicorn Platform): `Connect` opens drawer containing form. Submit saves config & immediately runs `test`; success flips to connected.
- REST API: card links to docs and exposes test button only; scheduling uses manual triggers (`publish` endpoint). Treated as always available (no toggle).
- Coming Soon: disabled cards with CTA “Join Beta” collecting email via modal; no API calls.

Project Snapshots & State
-------------------------
- `/api/projects/:id/snapshot` returns both raw `integrations: ProjectIntegration[]` and computed `integrationViews: ProjectIntegrationView[]`. The view payload includes `status`, `isActive`, `isConfigured`, `supportsOneClick`, `missingCapabilities` so the UI can render cards without recomputing manifests client-side.
- When a connector requires additional capabilities (images, categories) before activation, `ProjectIntegrationView` includes `missingCapabilities` array; UI blocks activation and surfaces checklist.
- Tests and publish jobs always reference the persisted integration ID; toggles never delete config.

PortableArticle & Webhook Baseline
----------------------------------
- PortableArticle (see `src/common/connectors/interface.ts`) is authoritative payload for every connector.
- Webhook connector is zero-dependency baseline; all other integrations adapt the same structure.
- Delivery: `POST` JSON with headers `X-SEOA-Signature` (`sha256=` HMAC of body using stored secret), `X-SEOA-Timestamp` (ISO8601), `X-SEOA-Integration-Id`, `X-SEOA-Project-Id`.
- Body schema:
  ```json
  {
    "meta": {
      "integrationId": "int_xxx",
      "projectId": "proj_xxx",
      "articleId": "art_xxx",
      "trigger": "schedule|manual|test",
      "triggeredAt": "2025-11-02T00:12:34Z",
      "dryRun": false,
      "locale": "en-US"
    },
    "article": { /* PortableArticle */ }
  }
  ```
- Receivers must return 2xx within 10s; non-2xx triggers retry with exponential backoff (max 3 attempts, jitter 30–90s). Respond `410` to disable integration.
- Guidance: publish static JSON files, enqueue for CMS APIs, or store in custom DB. No bundled automation partner; this payload is the contract.

Connector Registry
------------------
- `registry.ts` loads adapters from `server/*`. Each adapter implements `{type,name,publish(),test()?}` and may override `buildPortable(article)`.
- Shared helpers: slug/excerpt builders, media upload queue, rate-limit wrapper, OAuth token refresh hooks.
- Routes/workers invoke registry only; they never reach into individual connector modules.
- Testing: each adapter ships with `spec.ts` covering `publish` happy-path (stub HTTP) and `test` failure cases. Add smoke job to QA agent for real creds when available.

Connector Catalog (Competitor Parity)
-------------------------------------
```
Integration       Status   Auth                Publish Modes       Notes
REST API          GA       API key             Draft/Publish      Direct job control via `/api/articles/:id/publish`.
Webhook           GA       Shared secret       Draft/Publish      Reference implementation; fallback for custom stacks.
WordPress (.org/.com) Beta App password/JWT    Draft/Publish      Maps PortableArticle → `wp-json/wp/v2/posts`.
Webflow           Beta     OAuth token         Draft/Publish      Collection schema mapping per site.
Shopify           Planned  Admin API token     Draft              Blog + metafields support, images via asset API.
Ghost             Planned  Admin API key       Draft/Publish      HTML/Markdown dual support.
HubSpot           Planned  Private app token   Draft/Publish      CMS Blog v3 endpoint.
Notion            Planned  Internal integration Draft             Block tree expansion.
Squarespace       Planned  OAuth client        Draft/Publish      Content API.
Wix               Planned  OAuth client        Draft/Publish      Content Manager.
Framer            Planned  Personal token      Draft              Falls back to webhook until public API matures.
Unicorn Platform  Planned  API key             Draft              REST endpoints / CSV import.
Zapier-style      Via webhook n/a             Workflow-defined   Documented recipes only, no native connector.
```

Configuration Patterns
----------------------
- Store provider fields inside `configJson` per `type`; minimal required keys documented alongside adapters.
- Secrets (tokens, app passwords) encrypted at rest; refresh tokens stored in `project_integrations_secrets` (tbd) instead of `configJson` when implemented.
- All connectors must validate config via zod schema before persisting.
- Each adapter exposes metadata via `getConnectorManifest()` describing config schema, supportsAutoActivate, supportsTest, supportsToggle; `/integrations` UI consumes manifest to render correct controls.
- Status values: `connected` (auto-publish enabled), `disconnected` (config retained, no publishes), `error` (last test failed), `pending` (mid OAuth flow), `coming_soon` (not selectable). Route toggles map switch → status transitions via `PATCH`.

Development Notes
-----------------
- Moving connectors under `src/features/integrations/server` requires updating import paths in routes, workers, CLI, tests.
- Ensure server package exports tree-shake without pulling React/shadcn dependencies.
- Future: surface capabilities matrix (supports images, categories, scheduling) in UI by reading static metadata from adapters.

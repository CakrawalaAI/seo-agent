# SEO Agent – Logical Data Model (v2025-11)

SEO Agent now keeps the operational state for crawling, queues, and enrichment in bundle files under `.data/bundle/{projectId}/**`. The relational database is intentionally small and only stores durable state that must survive worker restarts.

## Principles
- **Stateless workers:** crawler/queue processors append JSON bundles; legacy crawl/job tables are gone.
- **Multi-tenant:** organizations own projects; membership links via email.
- **Global keyword canon:** deduplicated phrases across all projects.
- **Articles = plan:** scheduling metadata and drafts share the `articles` table.
- **Attachment-friendly:** rich media stored in `article_attachments` with CASCADE delete.

## Table Inventory
```
users ─┐
       │  user_auth_providers (OAuth accounts)
orgs ──┼──────┐
       │      │
       │      └── org_members (email-based membership)
       │
projects ──┬──────── article_attachments
           │
           ├──── project_integrations (webhook/webflow, etc.)
           │
           ├──── articles (plan + drafts + published)
           │
           └──── keywords ──┐
                           │
keyword_canon ◄─────────────┘
   │
   └── metric_cache (global provider snapshot)
```

### users
| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK |
| `email` | text UNIQUE |
| `name`, `image` | optional profile |
| `email_verified` | boolean |
| `created_at`, `updated_at` | timestamptz |

### user_auth_providers
OAuth connections (Google). Unique by `(provider_id, provider_account_id)`.

### orgs & org_members
- `orgs`: `plan` and optional entitlements JSON.
- `org_members`: `(org_id, user_email)` unique; `role` (`owner`, `admin`, `member`).

### projects
| Column | Type | Default |
| --- | --- | --- |
| `id` | text PK |
| `org_id` | FK → orgs.id (CASCADE) |
| `name` | text |
| `site_url` | text |
| `default_locale` | text | `'en-US'`
| `status` | text | `'draft'` → `'crawling'` → `'crawled'` → `'keywords_ready'` → `'active'` → `'error'`
| `auto_publish_policy` | text | `'buffered'`/`'immediate'`/`'manual'`
| `buffer_days` | integer | `3`
| `serp_device` | text | `'desktop'`
| `serp_location_code` | integer | `2840` (US)
| `metrics_location_code` | integer | `2840`
| `created_at`, `updated_at` | timestamptz |

### project_integrations
Per-project CMS connections. CASCADE deletes via `project_id`.

### keyword_canon & keywords
- `keyword_canon`: `(phrase_norm, language_code)` unique; global dedupe.
- `keywords`: per-project junction. Columns: `id`, `project_id`, `canon_id`, `status` (`recommended`/`excluded`/`planned`), `starred`, timestamps.

### metric_cache
1:1 with `keyword_canon` (unique on `canon_id`). Stores provider payload JSON + TTL seconds.

### articles
Merged plan + content.
| Column | Notes |
| --- | --- |
| `id` | text PK (plan ids reused when promoting plan item to draft) |
| `project_id` | FK CASCADE |
| `keyword_id` | optional FK (SET NULL) |
| `planned_date` | ISO `YYYY-MM-DD` |
| `title`, `outline_json` | plan metadata |
| `body_html` | generated content |
| `language`, `tone` | optional metadata |
| `status` | `'draft'` (outline only) → `'generating'` → `'ready'` → `'published'` / `'failed'` |
| `generation_date`, `publish_date`, `url` | dates/links |
| `created_at`, `updated_at` | timestamptz |

### article_attachments
| Column | Notes |
| --- | --- |
| `id` | text PK |
| `article_id` | FK CASCADE |
| `type` | `image`, `youtube`, etc. |
| `url`, `caption`, `order` | Attachment metadata |
| `created_at` | timestamptz |

## Ephemeral Bundle Layout
Workers write to `.data/bundle/{projectId}/{timestamp}/`:
- `crawl/pages.jsonl` – per-page JSON dumps (`CrawlPage`).
- `crawl/link-graph.json` – derived nodes/edges for visualization.
- `keywords/*.jsonl` – seed, candidate, prioritized keyword lists.
- `logs/jobs.jsonl` – queue log (queued/running/completed/failed).
- `articles/drafts/{articleId}.html/json` – generated outputs.

These files feed API responses (`/api/projects/:id/snapshot`, `/api/crawl/pages`, `/api/projects/:id/link-graph`) without DB writes.

## Removed Tables
Legacy tables removed in this revision: `crawl_pages`, `link_graph`, `jobs`, `serp_snapshot`, `plan_items`, `blobs`, `sessions`, `verifications`, `org_usage`. References should be routed through bundle stores or service abstractions.

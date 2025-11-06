# SEO Agent — Logical Data Model (Websites, v2025‑11)

All artifacts persist in Postgres (stateless workers). No filesystem bundles.

Principles
- Single entity: websites own keywords, articles, integrations.
- Multi‑tenant: organizations own websites.
- Global keyword canon: dedupe phrases; per‑website pointers reference canon + cached metrics.
- Articles = plan: schedule rows and drafts share `articles`.
- Minimal: remove score/cluster and evaluation gate from docs.

Table Inventory
```
users ─┐
       │  user_auth_providers (OAuth accounts)
organizations ──┼──────┐
       │      │
       │      └── organization_members (email-based membership)
       │
websites ──┬──────── integrations
           │
           ├──── crawl_jobs / crawl_pages (per‑page text + summaries)
           │
           ├──── articles (plan + drafts + published)
           │       └── article_attachments
           │
           └──── keywords (per‑site)
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

### organizations & organization_members
- `organizations`: plan and entitlements JSON (subscription source of truth)
- `organization_members`: `(org_id, user_email)` unique; `role` (`owner`,`admin`,`member`)

### websites
| Column | Type | Notes/Default |
| --- | --- | --- |
| `id` | text PK |
| `org_id` | text FK → organizations.id (CASCADE) |
| `url` | text | canonical website URL (input artifact) |
| `default_locale` | text | `'en-US'` |
| `summary` | text | business context from crawl top‑N (output artifact) |
| `settings_json` | jsonb | content policy (e.g., `{allowYoutube:true,maxImages:2}`) |
| `status` | text enum | `'crawled'` → `'keyword_generated'` → `'articles_scheduled'` |
| `created_at`, `updated_at` | timestamptz |

### integrations
Per‑website CMS connections. CASCADE via `website_id`.

### keywords (per‑website)
- `keywords`: `id`, `website_id` FK, `phrase`, `phrase_norm`, `language_code/name`, `location_code/name`, `provider`, `include` (boolean), `starred` (int), metrics columns (`search_volume`,`difficulty`,`cpc`,`competition`,`vol_12m_json`), `metrics_as_of`, timestamps.

### keyword_serp
- Cached SERP snapshots per article/keyword pair.
- Columns: `article_id` PK (FK → `articles.id`), `phrase`, `language`, `location_code`, `device`, `top_k`, `snapshot_json`, `fetched_at`.

### crawl_jobs / crawl_pages
- `crawl_jobs`: `id`, `website_id` FK, `providers_json`, `started_at`, `completed_at`, `created_at`.
- `crawl_pages`: page rows with `url`, `http_status`, `title`, `meta_json`, `headings_json`, `content_text`, `page_summary_json`, `created_at`.

### subscriptions
- Polar sync source of truth per user/org.
- `subscriptions`: `polar_subscription_id`, `user_id`, optional `org_id`, status/tier/product/price/customer IDs, seat counts, billing timestamps (`current_period_end`, `trial_ends_at`, `cancel_at`), flags (`cancel_at_period_end`), entitlement metadata, raw payload cache, timestamps.

### articles (plan + content)
| Column | Notes |
| --- | --- |
| `id` | text PK (reused as plan id) |
| `website_id` | FK CASCADE |
| `keyword_id` | optional FK → `keywords.id` (SET NULL) |
| `scheduled_date` | ISO `YYYY‑MM‑DD` |
| `title`, `outline_json` | plan metadata |
| `body_html` | generated content |
| `status` | `'queued'` → `'scheduled'` → `'published'` |
| `publish_date`, `url` | links + timestamps |
| `created_at`, `updated_at` | timestamptz |

### article_attachments
| Column | Notes |
| --- | --- |
| `id` | text PK |
| `article_id` | FK CASCADE |
| `type` | `image`, `youtube`, etc. |
| `url`, `caption`, `order` | Attachment metadata |
| `created_at` | timestamptz |

## Filesystem
None. All crawl pages, summaries, keyword caches, and article drafts persist in Postgres. Operational logs are ephemeral (no DB table yet).

## Process Contracts (inputs → outputs)
- Crawl: input `websites.url` → output `websites.summary`, `crawl_jobs` + `crawl_pages`.
- Generate Keywords: input `websites.summary` (+ headings) → output `keywords` with metrics. Users toggle `include`.
- Plan/Schedule: input `keywords(include=true)` → output `articles` rows (30‑day runway or full subscription period; round‑robin; deletions leave days empty).
- Generate Articles: input `articles(status=queued)` within global 3‑day buffer → output `articles(status=scheduled, body_html)`.
- Publish: input `articles(status=scheduled, scheduled_date<=today)` + integration → output `articles(status=published, url)`.

## Subscription/Entitlement (intent)
- Planner ensures one article per day across active subscription period.
- Daily generator maintains a 3‑day buffer of full drafts.
- Deletion does not auto‑fill; user can regenerate.

## Removed/Legacy
- Replace all `projects*` references with `websites*` in docs.
- No filesystem bundle. All state in DB.

# SEO Agent - Entity Relationship Diagram

## Overview

Streamlined database schema for the SEO Agent application. Down from 17 tables to **10 core tables** by moving ephemeral state to RabbitMQ and eliminating redundant entities.

**Key Principles:**
- **Multi-tenant**: Organizations own projects
- **Team collaboration**: Invite teammates with role-based access
- **Stateless auth**: HTTP-only signed cookies (no session persistence)
- **Global keyword canon**: Shared normalized keywords across all projects
- **Lazy article generation**: Title/outline created upfront, body generated 3 days before publish
- **Queue-based jobs**: RabbitMQ for crawling, keyword discovery, article generation

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│               STREAMLINED SEO AGENT - ENTITY RELATIONSHIP DIAGRAM        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│ users                    │
├──────────────────────────┤
│ PK id                    │──┐
│    email (unique)        │  │
│    name                  │  │
│    image                 │  │
│    email_verified        │  │
│    created_at            │  │
│    updated_at            │  │
└──────────────────────────┘  │
                              │ 1:N
                              │
┌──────────────────────────┐  │
│ user_auth_providers      │  │
├──────────────────────────┤  │
│ PK id                    │  │
│ FK user_id               │◄─┘
│    provider_id           │    (google, github, etc.)
│    provider_account_id   │
│    access_token          │
│    refresh_token         │
│    expires_at            │
│    created_at            │
│    updated_at            │
└──────────────────────────┘
UNIQUE(provider_id, provider_account_id)

─────────────────────────────────────────────────────────────────────────

┌──────────────────────────┐
│ orgs                     │
├──────────────────────────┤
│ PK id                    │──┐
│    name                  │  │
│    plan                  │  │  (starter, pro, enterprise)
│    entitlements_json     │  │
│    created_at            │  │
│    updated_at            │  │
└──────────────────────────┘  │
                              │ 1:N
                              │
┌──────────────────────────┐  │
│ org_members              │  │
├──────────────────────────┤  │
│ FK org_id                │◄─┤
│    user_email            │  │
│    role                  │  │  (owner, admin, member)
│    created_at            │  │
└──────────────────────────┘  │
UNIQUE(org_id, user_email)    │
                              │ 1:N
                              │
┌──────────────────────────┐  │
│ projects                 │◄─┘
├──────────────────────────┤
│ PK id                    │──┐
│ FK org_id                │  │
│    name                  │  │
│    site_url              │  │
│    status                │  │  (draft, crawling, crawled,
│    created_at            │  │   keywords_ready, active)
│    updated_at            │  │
└──────────────────────────┘  │
                              │ 1:N (CASCADE DELETE)
         ┌────────────────────┼────────────────────┬───────────────────┐
         │                    │                    │                   │
         ▼                    ▼                    ▼                   ▼
┌────────────────────┐ ┌────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ articles           │ │ keywords           │ │ project_integr..│ │ (future tables) │
├────────────────────┤ ├────────────────────┤ ├─────────────────┤ └─────────────────┘
│ PK id              │ │ PK id              │ │ PK id           │
│ FK project_id      │ │ FK project_id      │ │ FK project_id   │
│ FK keyword_id      │◄┤ FK canon_id        │ │    type         │
│    planned_date    │ │    status          │ │    config_json  │
│    title           │ │    starred         │ │    webhook_url  │
│    outline_json    │ │    created_at      │ │    status       │
│    body_html       │ │    updated_at      │ │    created_at   │
│    status          │ └────────────────────┘ │    updated_at   │
│    language        │  (rotation control)   └─────────────────┘
│    tone            │                       (webflow, wordpress,
│    generation_date │        │               medium, etc.)
│    publish_date    │        │
│    created_at      │        │
│    updated_at      │        │
└────────────────────┘        │
         │                    │
         │ 1:N                │ N:1
         ▼                    ▼
┌────────────────────┐ ┌────────────────────────────┐
│ article_attachm..  │ │ keyword_canon              │
├────────────────────┤ ├────────────────────────────┤
│ PK id              │ │ PK id                      │
│ FK article_id      │ │    phrase_norm             │
│    type            │ │    language_code           │
│    url             │ │    created_at              │
│    caption         │ └────────────────────────────┘
│    order           │ UNIQUE(phrase_norm, language_code)
│    created_at      │         │
└────────────────────┘         │ 1:1
(image, youtube, etc.)         ▼
                       ┌────────────────────────────┐
                       │ metric_cache               │
                       ├────────────────────────────┤
                       │ PK id                      │
                       │ FK canon_id (unique)       │
                       │    provider                │
                       │    metrics_json            │
                       │    fetched_at              │
                       │    ttl_seconds             │
                       └────────────────────────────┘
```

---

## Table Definitions

### 1. `users`
Core user accounts.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | User ID |
| `email` | text | NOT NULL, UNIQUE | Email address |
| `name` | text | | Display name |
| `image` | text | | Avatar URL |
| `email_verified` | boolean | NOT NULL, default: false | Email verification status |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- UNIQUE: `email`

---

### 2. `user_auth_providers`
OAuth/identity provider connections (renamed from `accounts`).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Provider connection ID |
| `user_id` | text | FK → users.id | User reference |
| `provider_id` | text | NOT NULL | Provider name (google, github) |
| `provider_account_id` | text | NOT NULL | Provider's user ID |
| `access_token` | text | | OAuth access token |
| `refresh_token` | text | | OAuth refresh token |
| `expires_at` | timestamp | | Token expiration |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- UNIQUE: `(provider_id, provider_account_id)`
- INDEX: `user_id`

---

### 3. `orgs`
Organization/workspace for team collaboration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Organization ID |
| `name` | text | NOT NULL | Organization name |
| `plan` | text | NOT NULL, default: 'starter' | Subscription plan |
| `entitlements_json` | jsonb | | Feature flags/limits |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Plans:** `starter`, `pro`, `enterprise`

**Entitlements example:**
```json
{
  "max_projects": 5,
  "max_articles_per_month": 100,
  "max_keywords_per_project": 500,
  "features": ["webflow_integration", "custom_domain"]
}
```

---

### 4. `org_members`
Team members within an organization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `org_id` | text | FK → orgs.id | Organization reference |
| `user_email` | text | NOT NULL | Member email |
| `role` | text | NOT NULL, default: 'member' | Access role |
| `created_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- UNIQUE: `(org_id, user_email)`

**Roles:**
- `owner`: Full control, billing access
- `admin`: Manage members, all project access
- `member`: Read/write access to projects

**Note:** Uses `user_email` for pending invitations (user might not exist yet).

---

### 5. `projects`
SEO projects (websites being optimized).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Project ID |
| `org_id` | text | FK → orgs.id | Organization owner |
| `name` | text | NOT NULL | Project name |
| `site_url` | text | | Target website URL |
| `status` | text | NOT NULL, default: 'draft' | Project lifecycle status |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- INDEX: `org_id`

**Status values:**
- `draft`: Initial creation
- `crawling`: Site crawl in progress (RabbitMQ job)
- `crawled`: Crawl complete
- `keywords_ready`: Keyword discovery complete
- `active`: Ready for article generation

**Note:** Crawl/job state lives in RabbitMQ. Status enum tracks lifecycle.

---

### 6. `keywords`
**Junction table** linking projects to canonical keywords with rotation controls.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Keyword instance ID |
| `project_id` | text | FK → projects.id, CASCADE | Project reference |
| `canon_id` | text | FK → keyword_canon.id | Canonical keyword |
| `status` | text | NOT NULL, default: 'recommended' | Rotation status |
| `starred` | boolean | NOT NULL, default: false | Priority flag |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- INDEX: `(project_id, canon_id)`
- INDEX: `(project_id, status, starred)` (for rotation queries)

**Status values:**
- `recommended`: Available for article scheduling
- `excluded`: User excluded from rotation
- `planned`: Currently in use by scheduled articles

**Purpose:** Links projects to global canonical keywords. Allows per-project control over which keywords to use in article rotation (exclude/star for priority).

---

### 7. `keyword_canon`
Global canonical keyword storage (normalized, language-aware).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Canonical keyword ID |
| `phrase_norm` | text | NOT NULL | Normalized phrase (lowercase, trimmed) |
| `language_code` | text | NOT NULL | ISO language code (en, es, fr) |
| `created_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- UNIQUE: `(phrase_norm, language_code)`

**Example:**
```
"Best Coffee Maker" → phrase_norm: "best coffee maker", language_code: "en"
```

**Rationale:** Shared keyword data reduces duplication, enables cross-project analytics.

---

### 8. `metric_cache`
Cached keyword metrics (1:1 with keyword_canon).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Cache entry ID |
| `canon_id` | text | FK → keyword_canon.id, UNIQUE | Canonical keyword |
| `provider` | text | NOT NULL | Metrics source (ahrefs, semrush) |
| `metrics_json` | jsonb | | Search volume, difficulty, CPC, etc. |
| `fetched_at` | timestamp | NOT NULL, default: NOW() | Last fetch time |
| `ttl_seconds` | integer | NOT NULL, default: 604800 | TTL (7 days default) |

**Indexes:**
- UNIQUE: `canon_id`

**Metrics example:**
```json
{
  "search_volume": 12000,
  "keyword_difficulty": 45,
  "cpc": 2.35,
  "trend": [1200, 1300, 1250, ...]
}
```

---

### 9. `articles`
Content articles (merged from plan_items).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Article ID |
| `project_id` | text | FK → projects.id, CASCADE | Project reference |
| `keyword_id` | text | FK → keywords.id, SET NULL | Target keyword |
| `planned_date` | text | | Publish date (YYYY-MM-DD) |
| `title` | text | | Article title |
| `outline_json` | jsonb | | Article structure |
| `body_html` | text | | Generated content (lazy) |
| `status` | text | NOT NULL, default: 'draft' | Lifecycle status |
| `language` | text | | Content language |
| `tone` | text | | Writing tone |
| `generation_date` | timestamp | | When body was generated |
| `publish_date` | timestamp | | When published to CMS |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- INDEX: `(project_id, planned_date)`

**Status values:**
- `draft`: Title/outline only
- `generating`: Body generation in progress
- `ready`: Body generated, awaiting publish
- `published`: Pushed to CMS

**Lazy generation workflow:**
1. Create article with `title` + `outline_json` (status: `draft`)
2. 3 days before `planned_date`: Generate `body_html` (status: `generating` → `ready`)
3. On `planned_date`: Publish via integration (status: `published`)

**Outline example:**
```json
[
  { "heading": "Introduction", "subpoints": ["Hook", "Problem statement"] },
  { "heading": "Benefits of X", "subpoints": ["Benefit 1", "Benefit 2"] },
  { "heading": "Conclusion" }
]
```

---

### 10. `article_attachments`
Rich media assets for articles (images, videos, embeds).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Attachment ID |
| `article_id` | text | FK → articles.id, CASCADE | Article reference |
| `type` | text | NOT NULL | Asset type |
| `url` | text | NOT NULL | Asset URL |
| `caption` | text | | Alt text/caption |
| `order` | integer | | Display order in article |
| `created_at` | timestamp | NOT NULL, default: NOW() | |

**Indexes:**
- INDEX: `article_id`

**Types:** `image`, `youtube`, `vimeo`, `chart`, `infographic`

**Example:**
```json
{
  "type": "image",
  "url": "https://cdn.example.com/coffee-maker.jpg",
  "caption": "Top-rated coffee maker 2025",
  "order": 1
}
```

---

### 11. `project_integrations`
CMS/platform connections (Webflow, WordPress, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | text | PK | Integration ID |
| `project_id` | text | FK → projects.id, CASCADE | Project reference |
| `type` | text | NOT NULL | Platform type |
| `config_json` | jsonb | | Platform-specific config |
| `webhook_url` | text | | Webhook endpoint |
| `status` | text | NOT NULL, default: 'connected' | Connection status |
| `created_at` | timestamp | NOT NULL, default: NOW() | |
| `updated_at` | timestamp | NOT NULL, default: NOW() | |

**Types:** `webflow`, `wordpress`, `medium`, `ghost`, `contentful`

**Config example (Webflow):**
```json
{
  "site_id": "abc123",
  "collection_id": "def456",
  "api_token": "...",
  "auto_publish": true
}
```

---

## Removed Tables

### ✗ `sessions` (removed)
**Rationale:** Using HTTP-only signed cookies with TanStack Start sessions. No need for database persistence.

**Migration:** Delete table. Update auth to use cookie-based sessions.

---

### ✗ `verifications` (removed)
**Rationale:** OAuth providers (Google, GitHub) handle email verification. No need for custom verification flow.

**Migration:** Delete table. Remove verification logic.

---

### ✗ `crawl_pages` (removed)
**Rationale:** Crawl data is ephemeral. Store URLs/metadata in RabbitMQ during processing. Only persist final results (articles, keywords).

**Migration:** Delete table. Move crawl logic to worker with RabbitMQ. Update `project.status` enum to track lifecycle.

---

### ✗ `link_graph` (removed)
**Rationale:** Internal linking graph not needed for MVP. Can reintroduce if link analysis becomes a feature.

**Migration:** Delete table.

---

### ✗ `jobs` (removed)
**Rationale:** Job queue state lives in RabbitMQ. No need to persist job history in database.

**Migration:** Delete table. Use RabbitMQ queue states (pending, active, completed, failed).

---

### ✗ `blobs` (removed)
**Rationale:** Asset URLs stored directly in `article_attachments`. No need for separate blob table.

**Migration:** Delete table. Store URLs directly.

---

### ✗ `plan_items` (removed)
**Rationale:** Merged into `articles` table. Articles represent planned content (title/outline) + generated content (body).

**Migration:** Migrate `plan_items` → `articles` with `status: 'draft'`.

---

### ✗ `serp_snapshot` (removed)
**Rationale:** SERP data is ephemeral research data, not core to article workflow. Fetch on-demand, don't persist.

**Migration:** Delete table. Fetch SERP data via API when needed.

---

## Architecture Decisions

### 1. Stateless Sessions (Cookie-Based Auth)
- **Implementation:** TanStack Start server-side sessions with HTTP-only signed cookies
- **Benefits:** No database I/O for auth checks, simpler architecture
- **Trade-off:** Can't revoke sessions server-side (must wait for expiration)

### 2. RabbitMQ for Job State
- **Queues:**
  - `crawl.discover`: Site crawling jobs
  - `keywords.discover`: Keyword research jobs
  - `articles.generate`: Article body generation
  - `articles.publish`: CMS publishing jobs

- **Benefits:**
  - Natural retry/DLQ handling
  - Job prioritization
  - No database pollution with ephemeral state

### 3. Global Keyword Canon
- **Design:** Single `keyword_canon` table, projects reference via junction table
- **Benefits:**
  - Deduplicated metrics (one cache per keyword, not per project)
  - Cross-project keyword analytics
  - Reduced API costs for metrics providers

### 4. Lazy Article Generation
- **Workflow:**
  1. **Planning phase:** Create article with `title` + `outline_json`
  2. **Pre-publish:** 3 days before `planned_date`, enqueue `articles.generate` job
  3. **Publish:** On `planned_date`, push to CMS via integration

- **Benefits:**
  - Fresh content (generated close to publish date)
  - Resource efficiency (don't generate months in advance)
  - Opportunity to update outline before generation

### 5. Team Collaboration via Orgs
- **Flow:**
  1. User creates org (becomes owner)
  2. Invite teammates via email → `org_members` entry
  3. All org members can access all projects in org
  4. Role-based permissions (owner, admin, member)

---

## Migration Path

### Phase 1: Schema Changes
```sql
-- Drop removed tables
DROP TABLE sessions;
DROP TABLE verifications;
DROP TABLE crawl_pages;
DROP TABLE link_graph;
DROP TABLE jobs;
DROP TABLE blobs;
DROP TABLE serp_snapshot;

-- Rename accounts → user_auth_providers
ALTER TABLE accounts RENAME TO user_auth_providers;

-- Merge plan_items into articles
INSERT INTO articles (id, project_id, keyword_id, planned_date, title, outline_json, status)
SELECT id, project_id, keyword_id, planned_date, title, outline_json, 'draft'
FROM plan_items;

DROP TABLE plan_items;

-- Add new columns to articles
ALTER TABLE articles
  ADD COLUMN body_html text,
  ADD COLUMN generation_date timestamp,
  ADD COLUMN publish_date timestamp,
  ADD COLUMN language text,
  ADD COLUMN tone text;

-- Simplify projects
ALTER TABLE projects
  DROP COLUMN crawl_max_depth,
  DROP COLUMN crawl_budget_pages,
  DROP COLUMN buffer_days,
  DROP COLUMN serp_device,
  DROP COLUMN serp_location_code,
  DROP COLUMN metrics_location_code,
  ADD COLUMN status text DEFAULT 'draft';

-- Create article_attachments
CREATE TABLE article_attachments (
  id text PRIMARY KEY,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  caption text,
  "order" integer,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- Update metric_cache to 1:1 with keyword_canon
ALTER TABLE metric_cache
  ADD COLUMN canon_id text UNIQUE REFERENCES keyword_canon(id);

-- Simplify keywords to junction table
ALTER TABLE keywords
  DROP COLUMN phrase,
  DROP COLUMN status,
  DROP COLUMN starred,
  DROP COLUMN opportunity,
  DROP COLUMN metrics_json;
```

### Phase 2: Application Changes
1. Update auth to use TanStack Start sessions (remove session DB logic)
2. Implement RabbitMQ workers for crawl/keyword/article jobs
3. Update article workflow for lazy generation
4. Add org invitation flow
5. Remove SERP snapshot persistence

### Phase 3: Data Migration
1. Export existing crawl_pages/jobs data if needed for analytics
2. Migrate plan_items → articles
3. Populate article_attachments from existing blob references
4. Update keywords to reference keyword_canon

---

## Summary

**Final schema: 10 tables** (down from 17)

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `user_auth_providers` | OAuth connections |
| `orgs` | Team workspaces |
| `org_members` | Team members |
| `projects` | SEO projects |
| `keywords` | Project ↔ keyword_canon junction |
| `keyword_canon` | Global keyword storage |
| `metric_cache` | Keyword metrics cache |
| `articles` | Content (planned + generated) |
| `article_attachments` | Rich media assets |
| `project_integrations` | CMS connections |

**Key improvements:**
- 40% fewer tables
- Stateless auth (no session DB)
- Queue-based job state (RabbitMQ)
- Global keyword deduplication
- Lazy content generation
- Team collaboration built-in

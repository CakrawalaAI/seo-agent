-- drizzle-kit baseline migration reflecting streamlined schema

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  image text,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_auth_providers (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  provider_account_id text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  id_token text,
  scope text,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_auth_providers_unique UNIQUE (provider_id, provider_account_id)
);

CREATE TABLE IF NOT EXISTS orgs (
  id text PRIMARY KEY,
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'starter',
  entitlements_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_members_org_user_unique UNIQUE (org_id, user_email)
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  site_url text,
  default_locale text NOT NULL DEFAULT 'en-US',
  status text NOT NULL DEFAULT 'draft',
  auto_publish_policy text DEFAULT 'buffered',
  buffer_days integer DEFAULT 3,
  serp_device text DEFAULT 'desktop',
  serp_location_code integer DEFAULT 2840,
  metrics_location_code integer DEFAULT 2840,
  dfs_language_code text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects (org_id);

CREATE TABLE IF NOT EXISTS keyword_canon (
  id text PRIMARY KEY,
  phrase_norm text NOT NULL,
  language_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT keyword_canon_unique UNIQUE (phrase_norm, language_code)
);

CREATE TABLE IF NOT EXISTS keywords (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  canon_id text NOT NULL REFERENCES keyword_canon(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'recommended',
  starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT keywords_project_canon_unique UNIQUE (project_id, canon_id)
);

CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords (project_id);

CREATE TABLE IF NOT EXISTS metric_cache (
  id text PRIMARY KEY,
  canon_id text NOT NULL REFERENCES keyword_canon(id) ON DELETE CASCADE,
  provider text NOT NULL,
  metrics_json jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_seconds integer NOT NULL DEFAULT 2592000,
  CONSTRAINT metric_cache_canon_unique UNIQUE (canon_id)
);

CREATE TABLE IF NOT EXISTS keyword_metrics_snapshot (
  id text PRIMARY KEY,
  canon_id text NOT NULL REFERENCES keyword_canon(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'dataforseo',
  location_code integer NOT NULL DEFAULT 2840,
  as_of_month text NOT NULL,
  metrics_json jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_seconds integer NOT NULL DEFAULT 2592000,
  CONSTRAINT kms_unique UNIQUE (canon_id, provider, location_code, as_of_month)
);

CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword_id text REFERENCES keywords(id) ON DELETE SET NULL,
  planned_date text,
  title text,
  outline_json jsonb,
  body_html text,
  language text,
  tone text,
  status text NOT NULL DEFAULT 'draft',
  buffer_stage text NOT NULL DEFAULT 'seed',
  generation_date timestamptz,
  publish_date timestamptz,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_project_date ON articles (project_id, planned_date);

CREATE TABLE IF NOT EXISTS article_attachments (
  id text PRIMARY KEY,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  caption text,
  "order" integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_integrations (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  config_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

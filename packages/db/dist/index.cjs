"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DEFAULT_DATABASE_URL: () => DEFAULT_DATABASE_URL,
  createDb: () => createDb,
  createSqlClient: () => createSqlClient,
  schema: () => schema_exports
});
module.exports = __toCommonJS(index_exports);
var import_postgres_js = require("drizzle-orm/postgres-js");
var import_postgres = __toESM(require("postgres"), 1);

// src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accounts: () => accounts,
  articleStatusEnum: () => articleStatusEnum,
  articles: () => articles,
  crawlPages: () => crawlPages,
  discoveryRuns: () => discoveryRuns,
  featureFlags: () => featureFlags,
  integrationStatusEnum: () => integrationStatusEnum,
  integrationTypeEnum: () => integrationTypeEnum,
  integrations: () => integrations,
  jobStatusEnum: () => jobStatusEnum,
  jobTypeEnum: () => jobTypeEnum,
  jobs: () => jobs,
  keywordSourceEnum: () => keywordSourceEnum,
  keywordStatusEnum: () => keywordStatusEnum,
  keywords: () => keywords,
  metricCaches: () => metricCaches,
  metricsProviderEnum: () => metricsProviderEnum,
  orgInviteStatusEnum: () => orgInviteStatusEnum,
  orgInvites: () => orgInvites,
  orgMemberRoleEnum: () => orgMemberRoleEnum,
  orgMembers: () => orgMembers,
  orgs: () => orgs,
  planItemStatusEnum: () => planItemStatusEnum,
  planItems: () => planItems,
  projects: () => projects,
  sessions: () => sessions,
  users: () => users,
  verifications: () => verifications
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var import_domain = require("@seo-agent/domain");
var orgMemberRoleEnum = (0, import_pg_core.pgEnum)("org_member_role", import_domain.OrgMemberRoleSchema.options);
var orgInviteStatusEnum = (0, import_pg_core.pgEnum)("org_invite_status", import_domain.OrgInviteStatusSchema.options);
var integrationTypeEnum = (0, import_pg_core.pgEnum)("integration_type", import_domain.IntegrationTypeSchema.options);
var integrationStatusEnum = (0, import_pg_core.pgEnum)("integration_status", import_domain.IntegrationStatusSchema.options);
var planItemStatusEnum = (0, import_pg_core.pgEnum)("plan_item_status", ["planned", "skipped", "consumed"]);
var articleStatusEnum = (0, import_pg_core.pgEnum)("article_status", import_domain.ArticleStatusSchema.options);
var keywordSourceEnum = (0, import_pg_core.pgEnum)("keyword_source", import_domain.KeywordSourceSchema.options);
var keywordStatusEnum = (0, import_pg_core.pgEnum)("keyword_status", import_domain.KeywordStatusSchema.options);
var jobTypeEnum = (0, import_pg_core.pgEnum)("job_type", import_domain.JobTypeSchema.options);
var jobStatusEnum = (0, import_pg_core.pgEnum)("job_status", import_domain.JobStatusSchema.options);
var metricsProviderEnum = (0, import_pg_core.pgEnum)("metrics_provider", import_domain.MetricsProviderSchema.options);
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  imageUrl: (0, import_pg_core.text)("image_url"),
  emailVerified: (0, import_pg_core.boolean)("email_verified").default(false).notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var sessions = (0, import_pg_core.pgTable)(
  "sessions",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    userId: (0, import_pg_core.text)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: (0, import_pg_core.text)("token").notNull(),
    expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).notNull(),
    ipAddress: (0, import_pg_core.text)("ip_address"),
    userAgent: (0, import_pg_core.text)("user_agent"),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tokenIdx: (0, import_pg_core.uniqueIndex)("sessions_token_unq").on(table.token),
    userIdx: (0, import_pg_core.index)("sessions_user_idx").on(table.userId)
  })
);
var accounts = (0, import_pg_core.pgTable)(
  "accounts",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    userId: (0, import_pg_core.text)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: (0, import_pg_core.text)("provider_id").notNull(),
    accountId: (0, import_pg_core.text)("account_id").notNull(),
    accessToken: (0, import_pg_core.text)("access_token"),
    refreshToken: (0, import_pg_core.text)("refresh_token"),
    idToken: (0, import_pg_core.text)("id_token"),
    scope: (0, import_pg_core.text)("scope"),
    password: (0, import_pg_core.text)("password"),
    accessTokenExpiresAt: (0, import_pg_core.timestamp)("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: (0, import_pg_core.timestamp)("refresh_token_expires_at", { withTimezone: true }),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    providerAccountIdx: (0, import_pg_core.uniqueIndex)("accounts_provider_account_unq").on(
      table.providerId,
      table.accountId
    ),
    userIdx: (0, import_pg_core.index)("accounts_user_idx").on(table.userId)
  })
);
var verifications = (0, import_pg_core.pgTable)(
  "verifications",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    identifier: (0, import_pg_core.text)("identifier").notNull(),
    value: (0, import_pg_core.text)("value").notNull(),
    expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    identifierValueIdx: (0, import_pg_core.uniqueIndex)("verifications_identifier_value_unq").on(
      table.identifier,
      table.value
    )
  })
);
var orgs = (0, import_pg_core.pgTable)("orgs", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  plan: (0, import_pg_core.text)("plan").notNull(),
  entitlements: (0, import_pg_core.jsonb)("entitlements").$type().notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull()
});
var orgMembers = (0, import_pg_core.pgTable)(
  "org_members",
  {
    orgId: (0, import_pg_core.text)("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core.text)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: orgMemberRoleEnum("role").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: (0, import_pg_core.primaryKey)({ columns: [table.orgId, table.userId] })
  })
);
var orgInvites = (0, import_pg_core.pgTable)(
  "org_invites",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    orgId: (0, import_pg_core.text)("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    email: (0, import_pg_core.text)("email").notNull(),
    role: orgMemberRoleEnum("role").default("member").notNull(),
    token: (0, import_pg_core.text)("token").notNull(),
    status: orgInviteStatusEnum("status").default("pending").notNull(),
    expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: (0, import_pg_core.timestamp)("accepted_at", { withTimezone: true }),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: (0, import_pg_core.text)("created_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => ({
    tokenIdx: (0, import_pg_core.uniqueIndex)("org_invites_token_unq").on(table.token),
    orgIdx: (0, import_pg_core.index)("org_invites_org_idx").on(table.orgId)
  })
);
var projects = (0, import_pg_core.pgTable)("projects", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  orgId: (0, import_pg_core.text)("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: (0, import_pg_core.text)("name").notNull(),
  siteUrl: (0, import_pg_core.text)("site_url").notNull(),
  defaultLocale: (0, import_pg_core.text)("default_locale").notNull(),
  branding: (0, import_pg_core.jsonb)("branding").$type(),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull()
});
var integrations = (0, import_pg_core.pgTable)("integrations", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: integrationTypeEnum("type").notNull(),
  config: (0, import_pg_core.jsonb)("config").$type().notNull(),
  status: integrationStatusEnum("status").default("paused").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true })
});
var crawlPages = (0, import_pg_core.pgTable)(
  "crawl_pages",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    url: (0, import_pg_core.text)("url").notNull(),
    httpStatus: (0, import_pg_core.integer)("http_status").notNull(),
    contentHash: (0, import_pg_core.text)("content_hash").notNull(),
    extractedAt: (0, import_pg_core.timestamp)("extracted_at", { withTimezone: true }).notNull(),
    meta: (0, import_pg_core.jsonb)("meta").$type(),
    headings: (0, import_pg_core.jsonb)("headings").$type(),
    links: (0, import_pg_core.jsonb)("links").$type(),
    contentBlobUrl: (0, import_pg_core.text)("content_blob_url").notNull()
  },
  (table) => ({
    projectIdx: (0, import_pg_core.index)("crawl_pages_project_idx").on(table.projectId),
    urlIdx: (0, import_pg_core.uniqueIndex)("crawl_pages_project_url_unq").on(table.projectId, table.url)
  })
);
var discoveryRuns = (0, import_pg_core.pgTable)(
  "discovery_runs",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    providersUsed: (0, import_pg_core.jsonb)("providers_used").$type().default(import_drizzle_orm.sql`'[]'::jsonb`).notNull(),
    startedAt: (0, import_pg_core.timestamp)("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: (0, import_pg_core.timestamp)("finished_at", { withTimezone: true }),
    status: jobStatusEnum("status").default("queued").notNull(),
    costMeter: (0, import_pg_core.jsonb)("cost_meter").$type(),
    summary: (0, import_pg_core.jsonb)("summary").$type().notNull()
  },
  (table) => ({
    projectIdx: (0, import_pg_core.index)("discovery_project_idx").on(table.projectId)
  })
);
var keywords = (0, import_pg_core.pgTable)(
  "keywords",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    phrase: (0, import_pg_core.text)("phrase").notNull(),
    locale: (0, import_pg_core.text)("locale").notNull(),
    primaryTopic: (0, import_pg_core.text)("primary_topic"),
    source: keywordSourceEnum("source").notNull(),
    metrics: (0, import_pg_core.jsonb)("metrics").$type(),
    status: keywordStatusEnum("status").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true })
  },
  (table) => ({
    uniqPhrase: (0, import_pg_core.uniqueIndex)("keywords_project_phrase_locale_unq").on(
      table.projectId,
      table.phrase,
      table.locale
    ),
    projectIdx: (0, import_pg_core.index)("keywords_project_idx").on(table.projectId)
  })
);
var planItems = (0, import_pg_core.pgTable)(
  "plan_items",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    keywordId: (0, import_pg_core.text)("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
    plannedDate: (0, import_pg_core.date)("planned_date").notNull(),
    title: (0, import_pg_core.text)("title").notNull(),
    outline: (0, import_pg_core.jsonb)("outline").$type().notNull(),
    status: planItemStatusEnum("status").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    projectIdx: (0, import_pg_core.index)("plan_items_project_idx").on(table.projectId)
  })
);
var articles = (0, import_pg_core.pgTable)(
  "articles",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    keywordId: (0, import_pg_core.text)("keyword_id").notNull().references(() => keywords.id, { onDelete: "set null" }),
    planItemId: (0, import_pg_core.text)("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
    title: (0, import_pg_core.text)("title").notNull(),
    outline: (0, import_pg_core.jsonb)("outline").$type(),
    bodyHtml: (0, import_pg_core.text)("body_html").notNull(),
    language: (0, import_pg_core.text)("language").notNull(),
    tone: (0, import_pg_core.text)("tone"),
    media: (0, import_pg_core.jsonb)("media").$type(),
    seoScore: (0, import_pg_core.numeric)("seo_score", { precision: 5, scale: 2 }),
    status: articleStatusEnum("status").notNull(),
    cmsExternalId: (0, import_pg_core.text)("cms_external_id"),
    url: (0, import_pg_core.text)("url"),
    generationDate: (0, import_pg_core.timestamp)("generation_date", { withTimezone: true }),
    publicationDate: (0, import_pg_core.timestamp)("publication_date", { withTimezone: true }),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    projectIdx: (0, import_pg_core.index)("articles_project_idx").on(table.projectId)
  })
);
var jobs = (0, import_pg_core.pgTable)(
  "jobs",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: jobTypeEnum("type").notNull(),
    payload: (0, import_pg_core.jsonb)("payload").$type().notNull(),
    status: jobStatusEnum("status").default("queued").notNull(),
    progressPct: (0, import_pg_core.integer)("progress_pct"),
    priority: (0, import_pg_core.integer)("priority").default(0).notNull(),
    retries: (0, import_pg_core.integer)("retries").default(0).notNull(),
    startedAt: (0, import_pg_core.timestamp)("started_at", { withTimezone: true }),
    finishedAt: (0, import_pg_core.timestamp)("finished_at", { withTimezone: true }),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
    logs: (0, import_pg_core.jsonb)("logs").$type().default(import_drizzle_orm.sql`'[]'::jsonb`).notNull()
  },
  (table) => ({
    projectIdx: (0, import_pg_core.index)("jobs_project_idx").on(table.projectId),
    statusIdx: (0, import_pg_core.index)("jobs_status_idx").on(table.status),
    typeIdx: (0, import_pg_core.index)("jobs_type_idx").on(table.type)
  })
);
var metricCaches = (0, import_pg_core.pgTable)(
  "metric_cache",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.text)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    provider: metricsProviderEnum("provider").notNull(),
    hash: (0, import_pg_core.text)("hash").notNull(),
    metrics: (0, import_pg_core.jsonb)("metrics").$type().notNull(),
    fetchedAt: (0, import_pg_core.timestamp)("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    ttl: (0, import_pg_core.integer)("ttl").notNull()
  },
  (table) => ({
    uniqueHash: (0, import_pg_core.uniqueIndex)("metric_cache_project_hash_unq").on(table.projectId, table.hash)
  })
);
var featureFlags = (0, import_pg_core.pgTable)(
  "feature_flags",
  {
    key: (0, import_pg_core.text)("key").primaryKey(),
    enabled: (0, import_pg_core.boolean)("enabled").default(true).notNull(),
    value: (0, import_pg_core.jsonb)("value").$type(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    keyIdx: (0, import_pg_core.index)("feature_flags_key_idx").on(table.key)
  })
);

// src/index.ts
var DEFAULT_DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/seo_agent";
var createSqlClient = (url = DEFAULT_DATABASE_URL, options = {}) => {
  return (0, import_postgres.default)(url, {
    prepare: true,
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    ...options
  });
};
var createDb = (options = {}) => {
  const sqlClient = createSqlClient(options.url, options.postgresOptions);
  const db = (0, import_postgres_js.drizzle)(sqlClient, { schema: schema_exports });
  return { db, sql: sqlClient };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_DATABASE_URL,
  createDb,
  createSqlClient,
  schema
});

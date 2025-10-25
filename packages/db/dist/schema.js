// src/schema.ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
import {
  ArticleStatusSchema,
  IntegrationStatusSchema,
  IntegrationTypeSchema,
  JobStatusSchema,
  JobTypeSchema,
  KeywordSourceSchema,
  KeywordStatusSchema,
  MetricsProviderSchema,
  OrgInviteStatusSchema,
  OrgMemberRoleSchema
} from "@seo-agent/domain";
var orgMemberRoleEnum = pgEnum("org_member_role", OrgMemberRoleSchema.options);
var orgInviteStatusEnum = pgEnum("org_invite_status", OrgInviteStatusSchema.options);
var integrationTypeEnum = pgEnum("integration_type", IntegrationTypeSchema.options);
var integrationStatusEnum = pgEnum("integration_status", IntegrationStatusSchema.options);
var planItemStatusEnum = pgEnum("plan_item_status", ["planned", "skipped", "consumed"]);
var articleStatusEnum = pgEnum("article_status", ArticleStatusSchema.options);
var keywordSourceEnum = pgEnum("keyword_source", KeywordSourceSchema.options);
var keywordStatusEnum = pgEnum("keyword_status", KeywordStatusSchema.options);
var jobTypeEnum = pgEnum("job_type", JobTypeSchema.options);
var jobStatusEnum = pgEnum("job_status", JobStatusSchema.options);
var metricsProviderEnum = pgEnum("metrics_provider", MetricsProviderSchema.options);
var users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_unq").on(table.token),
    userIdx: index("sessions_user_idx").on(table.userId)
  })
);
var accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    scope: text("scope"),
    password: text("password"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    providerAccountIdx: uniqueIndex("accounts_provider_account_unq").on(
      table.providerId,
      table.accountId
    ),
    userIdx: index("accounts_user_idx").on(table.userId)
  })
);
var verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    identifierValueIdx: uniqueIndex("verifications_identifier_value_unq").on(
      table.identifier,
      table.value
    )
  })
);
var orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull(),
  entitlements: jsonb("entitlements").$type().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var orgMembers = pgTable(
  "org_members",
  {
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: orgMemberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.userId] })
  })
);
var orgInvites = pgTable(
  "org_invites",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgMemberRoleEnum("role").default("member").notNull(),
    token: text("token").notNull(),
    status: orgInviteStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => ({
    tokenIdx: uniqueIndex("org_invites_token_unq").on(table.token),
    orgIdx: index("org_invites_org_idx").on(table.orgId)
  })
);
var projects = pgTable("projects", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  siteUrl: text("site_url").notNull(),
  defaultLocale: text("default_locale").notNull(),
  branding: jsonb("branding").$type(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var integrations = pgTable("integrations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: integrationTypeEnum("type").notNull(),
  config: jsonb("config").$type().notNull(),
  status: integrationStatusEnum("status").default("paused").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
});
var crawlPages = pgTable(
  "crawl_pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    httpStatus: integer("http_status").notNull(),
    contentHash: text("content_hash").notNull(),
    extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull(),
    meta: jsonb("meta").$type(),
    headings: jsonb("headings").$type(),
    links: jsonb("links").$type(),
    contentBlobUrl: text("content_blob_url").notNull()
  },
  (table) => ({
    projectIdx: index("crawl_pages_project_idx").on(table.projectId),
    urlIdx: uniqueIndex("crawl_pages_project_url_unq").on(table.projectId, table.url)
  })
);
var discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    providersUsed: jsonb("providers_used").$type().default(sql`'[]'::jsonb`).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: jobStatusEnum("status").default("queued").notNull(),
    costMeter: jsonb("cost_meter").$type(),
    summary: jsonb("summary").$type().notNull()
  },
  (table) => ({
    projectIdx: index("discovery_project_idx").on(table.projectId)
  })
);
var keywords = pgTable(
  "keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    locale: text("locale").notNull(),
    primaryTopic: text("primary_topic"),
    source: keywordSourceEnum("source").notNull(),
    metrics: jsonb("metrics").$type(),
    status: keywordStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
  },
  (table) => ({
    uniqPhrase: uniqueIndex("keywords_project_phrase_locale_unq").on(
      table.projectId,
      table.phrase,
      table.locale
    ),
    projectIdx: index("keywords_project_idx").on(table.projectId)
  })
);
var planItems = pgTable(
  "plan_items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
    plannedDate: date("planned_date").notNull(),
    title: text("title").notNull(),
    outline: jsonb("outline").$type().notNull(),
    status: planItemStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    projectIdx: index("plan_items_project_idx").on(table.projectId)
  })
);
var articles = pgTable(
  "articles",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    keywordId: text("keyword_id").notNull().references(() => keywords.id, { onDelete: "set null" }),
    planItemId: text("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    outline: jsonb("outline").$type(),
    bodyHtml: text("body_html").notNull(),
    language: text("language").notNull(),
    tone: text("tone"),
    media: jsonb("media").$type(),
    seoScore: numeric("seo_score", { precision: 5, scale: 2 }),
    status: articleStatusEnum("status").notNull(),
    cmsExternalId: text("cms_external_id"),
    url: text("url"),
    generationDate: timestamp("generation_date", { withTimezone: true }),
    publicationDate: timestamp("publication_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    projectIdx: index("articles_project_idx").on(table.projectId)
  })
);
var jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: jobTypeEnum("type").notNull(),
    payload: jsonb("payload").$type().notNull(),
    status: jobStatusEnum("status").default("queued").notNull(),
    progressPct: integer("progress_pct"),
    priority: integer("priority").default(0).notNull(),
    retries: integer("retries").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    logs: jsonb("logs").$type().default(sql`'[]'::jsonb`).notNull()
  },
  (table) => ({
    projectIdx: index("jobs_project_idx").on(table.projectId),
    statusIdx: index("jobs_status_idx").on(table.status),
    typeIdx: index("jobs_type_idx").on(table.type)
  })
);
var metricCaches = pgTable(
  "metric_cache",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    provider: metricsProviderEnum("provider").notNull(),
    hash: text("hash").notNull(),
    metrics: jsonb("metrics").$type().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    ttl: integer("ttl").notNull()
  },
  (table) => ({
    uniqueHash: uniqueIndex("metric_cache_project_hash_unq").on(table.projectId, table.hash)
  })
);
var featureFlags = pgTable(
  "feature_flags",
  {
    key: text("key").primaryKey(),
    enabled: boolean("enabled").default(true).notNull(),
    value: jsonb("value").$type(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    keyIdx: index("feature_flags_key_idx").on(table.key)
  })
);
export {
  accounts,
  articleStatusEnum,
  articles,
  crawlPages,
  discoveryRuns,
  featureFlags,
  integrationStatusEnum,
  integrationTypeEnum,
  integrations,
  jobStatusEnum,
  jobTypeEnum,
  jobs,
  keywordSourceEnum,
  keywordStatusEnum,
  keywords,
  metricCaches,
  metricsProviderEnum,
  orgInviteStatusEnum,
  orgInvites,
  orgMemberRoleEnum,
  orgMembers,
  orgs,
  planItemStatusEnum,
  planItems,
  projects,
  sessions,
  users,
  verifications
};

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AcceptOrgInviteInputSchema: () => AcceptOrgInviteInputSchema,
  ApiErrorSchema: () => ApiErrorSchema,
  AppFeatureFlagSchema: () => AppFeatureFlagSchema,
  ArticleSchema: () => ArticleSchema,
  ArticleStatusSchema: () => ArticleStatusSchema,
  AutoPublishPolicySchema: () => AutoPublishPolicySchema,
  BillingCheckoutRequestSchema: () => BillingCheckoutRequestSchema,
  BillingLinkResponseSchema: () => BillingLinkResponseSchema,
  BillingPortalRequestSchema: () => BillingPortalRequestSchema,
  BrandingSchema: () => BrandingSchema,
  CrawlBudgetSchema: () => CrawlBudgetSchema,
  CrawlJobPayloadSchema: () => CrawlJobPayloadSchema,
  CrawlPageSchema: () => CrawlPageSchema,
  CreateIntegrationInputSchema: () => CreateIntegrationInputSchema,
  CreateKeywordInputSchema: () => CreateKeywordInputSchema,
  CreateOrgInputSchema: () => CreateOrgInputSchema,
  CreateOrgInviteInputSchema: () => CreateOrgInviteInputSchema,
  CreatePlanRequestSchema: () => CreatePlanRequestSchema,
  CreateProjectInputSchema: () => CreateProjectInputSchema,
  CreateProjectResponseSchema: () => CreateProjectResponseSchema,
  DEFAULT_BUFFER_DAYS: () => DEFAULT_BUFFER_DAYS,
  DEFAULT_CRAWL_BUDGET: () => DEFAULT_CRAWL_BUDGET,
  DEFAULT_DAILY_ARTICLES: () => DEFAULT_DAILY_ARTICLES,
  DiscoveryJobPayloadSchema: () => DiscoveryJobPayloadSchema,
  DiscoveryRunSchema: () => DiscoveryRunSchema,
  DiscoverySummarySchema: () => DiscoverySummarySchema,
  EntitlementSchema: () => EntitlementSchema,
  FeatureConfigSchema: () => FeatureConfigSchema,
  GenerateJobPayloadSchema: () => GenerateJobPayloadSchema,
  HealthResponseSchema: () => HealthResponseSchema,
  IntegrationSchema: () => IntegrationSchema,
  IntegrationStatusSchema: () => IntegrationStatusSchema,
  IntegrationTypeSchema: () => IntegrationTypeSchema,
  JobLogSchema: () => JobLogSchema,
  JobSchema: () => JobSchema,
  JobStatusSchema: () => JobStatusSchema,
  JobTypeSchema: () => JobTypeSchema,
  KeywordMetricsSchema: () => KeywordMetricsSchema,
  KeywordSchema: () => KeywordSchema,
  KeywordSourceSchema: () => KeywordSourceSchema,
  KeywordStatusSchema: () => KeywordStatusSchema,
  MeResponseSchema: () => MeResponseSchema,
  MetricCacheProviderSchema: () => MetricCacheProviderSchema,
  MetricCacheSchema: () => MetricCacheSchema,
  MetricSourceSchema: () => MetricSourceSchema,
  MetricsProviderSchema: () => MetricsProviderSchema,
  OrgInviteLinkResponseSchema: () => OrgInviteLinkResponseSchema,
  OrgInviteSchema: () => OrgInviteSchema,
  OrgInviteStatusSchema: () => OrgInviteStatusSchema,
  OrgMemberRoleSchema: () => OrgMemberRoleSchema,
  OrgMemberSchema: () => OrgMemberSchema,
  OrgSchema: () => OrgSchema,
  PaginatedResponseSchema: () => PaginatedResponseSchema,
  PaginationSchema: () => PaginationSchema,
  PlanItemSchema: () => PlanItemSchema,
  PlanItemStatusSchema: () => PlanItemStatusSchema,
  PlanJobPayloadSchema: () => PlanJobPayloadSchema,
  PolarWebhookEventSchema: () => PolarWebhookEventSchema,
  PortableArticleBlockSchema: () => PortableArticleBlockSchema,
  PortableArticleDocumentSchema: () => PortableArticleDocumentSchema,
  PortableArticleMediaImageSchema: () => PortableArticleMediaImageSchema,
  PortableArticleOutlineSectionSchema: () => PortableArticleOutlineSectionSchema,
  PortableArticleSchema: () => PortableArticleSchema,
  ProjectSchema: () => ProjectSchema,
  ProjectScopedJobSchema: () => ProjectScopedJobSchema,
  ProjectSnapshotSchema: () => ProjectSnapshotSchema,
  ProviderSchema: () => ProviderSchema,
  PublishJobPayloadSchema: () => PublishJobPayloadSchema,
  QueueJobDefinitionSchema: () => QueueJobDefinitionSchema,
  QueuePayloadSchemas: () => QueuePayloadSchemas,
  SchedulePolicySchema: () => SchedulePolicySchema,
  ScheduleRunRequestSchema: () => ScheduleRunRequestSchema,
  ScheduleRunResponseSchema: () => ScheduleRunResponseSchema,
  ScheduleRunResultSchema: () => ScheduleRunResultSchema,
  UpdateArticleInputSchema: () => UpdateArticleInputSchema,
  UpdateIntegrationInputSchema: () => UpdateIntegrationInputSchema,
  UpdateKeywordInputSchema: () => UpdateKeywordInputSchema,
  UpdatePlanItemSchema: () => UpdatePlanItemSchema,
  UpdateProjectInputSchema: () => UpdateProjectInputSchema,
  UserSchema: () => UserSchema,
  WebflowFieldMappingSchema: () => WebflowFieldMappingSchema,
  WebflowIntegrationConfigSchema: () => WebflowIntegrationConfigSchema,
  WebhookIntegrationConfigSchema: () => WebhookIntegrationConfigSchema
});
module.exports = __toCommonJS(index_exports);
var import_zod2 = require("zod");

// src/portable-article.ts
var import_zod = require("zod");
var PortableArticleBlockSchema = import_zod.z.discriminatedUnion("kind", [
  import_zod.z.object({
    kind: import_zod.z.literal("paragraph"),
    html: import_zod.z.string()
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("quote"),
    html: import_zod.z.string(),
    citation: import_zod.z.string().optional()
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("image"),
    src: import_zod.z.string(),
    alt: import_zod.z.string().optional(),
    caption: import_zod.z.string().optional()
  }),
  import_zod.z.object({
    kind: import_zod.z.literal("embed"),
    provider: import_zod.z.string(),
    url: import_zod.z.string().url(),
    html: import_zod.z.string().optional()
  })
]);
var PortableArticleDocumentSchema = import_zod.z.object({
  metadata: import_zod.z.object({
    title: import_zod.z.string(),
    description: import_zod.z.string().optional(),
    canonicalUrl: import_zod.z.string().url().optional(),
    tags: import_zod.z.array(import_zod.z.string()).optional(),
    locale: import_zod.z.string().min(2).optional()
  }),
  content: import_zod.z.array(PortableArticleBlockSchema)
});

// src/index.ts
var isoDate = () => import_zod2.z.string().datetime({ offset: true });
var OrgMemberRoleSchema = import_zod2.z.enum(["owner", "admin", "member"]);
var OrgInviteStatusSchema = import_zod2.z.enum(["pending", "accepted", "revoked", "expired"]);
var IntegrationTypeSchema = import_zod2.z.enum([
  "webhook",
  "webflow",
  "wordpress",
  "framer",
  "shopify",
  "wix"
]);
var IntegrationStatusSchema = import_zod2.z.enum(["connected", "error", "paused"]);
var PlanItemStatusSchema = import_zod2.z.enum(["planned", "skipped", "consumed"]);
var ArticleStatusSchema = import_zod2.z.enum(["draft", "published", "failed"]);
var KeywordStatusSchema = import_zod2.z.enum(["recommended", "planned", "generated"]);
var KeywordSourceSchema = import_zod2.z.enum(["crawl", "llm", "manual"]);
var JobTypeSchema = import_zod2.z.enum([
  "crawl",
  "discovery",
  "plan",
  "generate",
  "publish",
  "linking",
  "reoptimize"
]);
var JobStatusSchema = import_zod2.z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled"
]);
var ProviderSchema = import_zod2.z.enum(["crawl", "llm", "dataforseo"]);
var MetricsProviderSchema = import_zod2.z.enum(["dataforseo"]);
var MetricSourceSchema = import_zod2.z.enum(["crawl", "llm", "manual", "provider"]);
var MetricCacheProviderSchema = import_zod2.z.enum(["dataforseo"]);
var AutoPublishPolicySchema = import_zod2.z.enum(["buffered", "immediate", "manual"]);
var EntitlementSchema = import_zod2.z.object({
  projectQuota: import_zod2.z.number().int().nonnegative(),
  crawlPages: import_zod2.z.number().int().nonnegative(),
  dailyArticles: import_zod2.z.number().int().nonnegative(),
  autoPublishPolicy: AutoPublishPolicySchema,
  bufferDays: import_zod2.z.number().int().min(0).default(3)
});
var UserSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  email: import_zod2.z.string().email(),
  name: import_zod2.z.string().min(1),
  imageUrl: import_zod2.z.string().url().optional(),
  emailVerified: import_zod2.z.boolean().optional(),
  createdAt: isoDate(),
  updatedAt: isoDate().optional()
});
var OrgSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  name: import_zod2.z.string().min(1),
  plan: import_zod2.z.string().min(1),
  entitlementsJson: EntitlementSchema,
  createdAt: isoDate()
});
var OrgMemberSchema = import_zod2.z.object({
  orgId: import_zod2.z.string().min(1),
  userId: import_zod2.z.string().min(1),
  role: OrgMemberRoleSchema
});
var OrgInviteSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  orgId: import_zod2.z.string().min(1),
  email: import_zod2.z.string().email(),
  role: OrgMemberRoleSchema,
  token: import_zod2.z.string().min(1),
  status: OrgInviteStatusSchema,
  createdAt: isoDate(),
  expiresAt: isoDate(),
  acceptedAt: isoDate().optional(),
  createdBy: import_zod2.z.string().min(1).optional()
});
var CreateOrgInviteInputSchema = import_zod2.z.object({
  orgId: import_zod2.z.string().min(1),
  email: import_zod2.z.string().email(),
  role: OrgMemberRoleSchema.default("member"),
  expiresInHours: import_zod2.z.number().int().positive().max(168).default(72)
});
var AcceptOrgInviteInputSchema = import_zod2.z.object({
  token: import_zod2.z.string().min(1),
  userId: import_zod2.z.string().min(1).optional()
});
var OrgInviteLinkResponseSchema = import_zod2.z.object({
  inviteUrl: import_zod2.z.string().url()
});
var BillingCheckoutRequestSchema = import_zod2.z.object({
  orgId: import_zod2.z.string().min(1),
  plan: import_zod2.z.string().min(1),
  successUrl: import_zod2.z.string().url(),
  cancelUrl: import_zod2.z.string().url()
});
var BillingPortalRequestSchema = import_zod2.z.object({
  orgId: import_zod2.z.string().min(1),
  returnUrl: import_zod2.z.string().url().optional()
});
var BillingLinkResponseSchema = import_zod2.z.object({
  url: import_zod2.z.string().url()
});
var PolarWebhookEventSchema = import_zod2.z.object({
  type: import_zod2.z.string().min(1),
  data: import_zod2.z.object({
    orgId: import_zod2.z.string().min(1),
    plan: import_zod2.z.string().min(1),
    entitlements: EntitlementSchema.optional()
  })
});
var BrandingSchema = import_zod2.z.object({
  tone: import_zod2.z.string().optional(),
  voice: import_zod2.z.string().optional(),
  palette: import_zod2.z.array(import_zod2.z.string()).optional(),
  brandPillars: import_zod2.z.array(import_zod2.z.string()).optional()
});
var ProjectSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  orgId: import_zod2.z.string().min(1),
  name: import_zod2.z.string().min(1),
  siteUrl: import_zod2.z.string().url(),
  defaultLocale: import_zod2.z.string().min(2),
  brandingJson: BrandingSchema.optional(),
  autoPublishPolicy: AutoPublishPolicySchema.optional(),
  bufferDays: import_zod2.z.number().int().min(0).optional(),
  createdAt: isoDate()
});
var CreateProjectResponseSchema = import_zod2.z.object({
  project: ProjectSchema,
  crawlJobId: import_zod2.z.string().min(1).optional()
});
var IntegrationSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  type: IntegrationTypeSchema,
  configJson: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()),
  status: IntegrationStatusSchema,
  createdAt: isoDate().optional(),
  updatedAt: isoDate().optional()
});
var WebhookIntegrationConfigSchema = import_zod2.z.object({
  targetUrl: import_zod2.z.string().url(),
  secret: import_zod2.z.string().min(1)
});
var WebflowFieldMappingSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1).default("name"),
  slug: import_zod2.z.string().min(1).default("slug"),
  body: import_zod2.z.string().min(1),
  excerpt: import_zod2.z.string().min(1).optional(),
  seoTitle: import_zod2.z.string().min(1).optional(),
  seoDescription: import_zod2.z.string().min(1).optional(),
  tags: import_zod2.z.string().min(1).optional(),
  mainImage: import_zod2.z.string().min(1).optional()
});
var WebflowIntegrationConfigSchema = import_zod2.z.object({
  accessToken: import_zod2.z.string().min(1),
  siteId: import_zod2.z.string().min(1).optional(),
  collectionId: import_zod2.z.string().min(1),
  fieldMapping: WebflowFieldMappingSchema,
  publishMode: import_zod2.z.enum(["draft", "live"]).default("draft"),
  cmsLocaleId: import_zod2.z.string().min(1).optional()
});
var CrawlPageSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  url: import_zod2.z.string().url(),
  httpStatus: import_zod2.z.number().int().min(100).max(599),
  contentHash: import_zod2.z.string().min(1),
  extractedAt: isoDate(),
  metaJson: import_zod2.z.object({
    title: import_zod2.z.string().optional(),
    description: import_zod2.z.string().optional()
  }),
  headingsJson: import_zod2.z.array(
    import_zod2.z.object({
      tag: import_zod2.z.string(),
      content: import_zod2.z.string()
    })
  ),
  linksJson: import_zod2.z.array(
    import_zod2.z.object({
      href: import_zod2.z.string(),
      text: import_zod2.z.string().optional()
    })
  ),
  contentBlobUrl: import_zod2.z.string().url()
});
var DiscoverySummarySchema = import_zod2.z.object({
  businessSummary: import_zod2.z.string(),
  audience: import_zod2.z.array(import_zod2.z.string()),
  products: import_zod2.z.array(import_zod2.z.string()).optional(),
  topicClusters: import_zod2.z.array(import_zod2.z.string())
});
var DiscoveryRunSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  providersUsed: import_zod2.z.array(ProviderSchema),
  startedAt: isoDate(),
  finishedAt: isoDate().nullable(),
  status: JobStatusSchema,
  costMeterJson: import_zod2.z.object({
    creditsConsumed: import_zod2.z.number().nonnegative(),
    currency: import_zod2.z.string().default("usd")
  }).optional(),
  summaryJson: DiscoverySummarySchema
});
var KeywordMetricsSchema = import_zod2.z.object({
  searchVolume: import_zod2.z.number().nonnegative().nullable(),
  cpc: import_zod2.z.number().nonnegative().nullable(),
  competition: import_zod2.z.number().nonnegative().nullable(),
  trend12mo: import_zod2.z.array(import_zod2.z.number().nullable()).max(24).optional(),
  difficulty: import_zod2.z.number().nonnegative().nullable(),
  intent: import_zod2.z.string().min(1).nullable().optional(),
  sourceProvider: MetricsProviderSchema.optional(),
  provider: import_zod2.z.string().min(1).optional(),
  fetchedAt: isoDate().optional(),
  asOf: isoDate().optional()
});
var KeywordMetricsUpdateSchema = KeywordMetricsSchema.partial();
var KeywordSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  phrase: import_zod2.z.string().min(1),
  locale: import_zod2.z.string().min(2),
  primaryTopic: import_zod2.z.string().optional(),
  source: KeywordSourceSchema,
  metricsJson: KeywordMetricsSchema.optional(),
  status: KeywordStatusSchema,
  isStarred: import_zod2.z.boolean().optional(),
  opportunityScore: import_zod2.z.number().min(0).max(100).optional(),
  createdAt: isoDate().optional(),
  updatedAt: isoDate().optional()
});
var UpdateKeywordInputSchema = import_zod2.z.object({
  phrase: import_zod2.z.string().min(1).optional(),
  primaryTopic: import_zod2.z.string().nullable().optional(),
  status: KeywordStatusSchema.optional(),
  metricsJson: KeywordMetricsUpdateSchema.optional(),
  isStarred: import_zod2.z.boolean().optional(),
  opportunityScore: import_zod2.z.number().min(0).max(100).optional()
}).refine(
  (value) => value.phrase !== void 0 || value.primaryTopic !== void 0 || value.status !== void 0 || value.metricsJson !== void 0 || value.isStarred !== void 0 || value.opportunityScore !== void 0,
  { message: "Provide at least one field to update" }
);
var CreateKeywordInputSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  phrase: import_zod2.z.string().min(1),
  locale: import_zod2.z.string().min(2).default("en-US"),
  primaryTopic: import_zod2.z.string().optional(),
  metricsJson: KeywordMetricsSchema.optional(),
  status: KeywordStatusSchema.default("recommended"),
  isStarred: import_zod2.z.boolean().default(false),
  opportunityScore: import_zod2.z.number().min(0).max(100).optional()
});
var PlanItemSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  keywordId: import_zod2.z.string().min(1),
  plannedDate: import_zod2.z.string().date(),
  title: import_zod2.z.string().min(1),
  outlineJson: import_zod2.z.array(
    import_zod2.z.object({
      heading: import_zod2.z.string(),
      subpoints: import_zod2.z.array(import_zod2.z.string()).default([])
    })
  ),
  status: PlanItemStatusSchema,
  createdAt: isoDate(),
  updatedAt: isoDate()
});
var ArticleSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  keywordId: import_zod2.z.string().min(1),
  planItemId: import_zod2.z.string().optional(),
  title: import_zod2.z.string().min(1),
  outlineJson: PlanItemSchema.shape.outlineJson.optional(),
  bodyHtml: import_zod2.z.string(),
  language: import_zod2.z.string().min(2),
  tone: import_zod2.z.string().optional(),
  mediaJson: import_zod2.z.array(
    import_zod2.z.object({
      kind: import_zod2.z.enum(["image", "video", "embed"]),
      src: import_zod2.z.string(),
      alt: import_zod2.z.string().optional()
    })
  ).optional(),
  seoScore: import_zod2.z.number().min(0).max(100).nullable().optional(),
  status: ArticleStatusSchema,
  cmsExternalId: import_zod2.z.string().optional(),
  url: import_zod2.z.string().url().optional(),
  generationDate: isoDate().optional(),
  publicationDate: isoDate().optional(),
  createdAt: isoDate(),
  updatedAt: isoDate()
});
var UpdateArticleInputSchema = import_zod2.z.object({
  title: import_zod2.z.string().min(1).optional(),
  outlineJson: PlanItemSchema.shape.outlineJson.optional(),
  bodyHtml: import_zod2.z.string().min(1).optional(),
  language: import_zod2.z.string().min(2).optional(),
  tone: import_zod2.z.string().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one field to update"
});
var JobLogSchema = import_zod2.z.object({
  message: import_zod2.z.string(),
  level: import_zod2.z.enum(["info", "warn", "error"]).default("info"),
  timestamp: isoDate()
});
var JobSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  type: JobTypeSchema,
  payloadJson: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()),
  status: JobStatusSchema,
  progressPct: import_zod2.z.number().min(0).max(100).optional(),
  retries: import_zod2.z.number().int().nonnegative().default(0),
  startedAt: isoDate().nullable(),
  finishedAt: isoDate().nullable(),
  logs: import_zod2.z.array(JobLogSchema).default([])
});
var MetricCacheSchema = import_zod2.z.object({
  id: import_zod2.z.string().min(1),
  projectId: import_zod2.z.string().min(1),
  provider: MetricCacheProviderSchema,
  hash: import_zod2.z.string().min(1),
  metricsJson: KeywordMetricsSchema,
  fetchedAt: isoDate(),
  ttl: import_zod2.z.number().int().nonnegative()
});
var PortableArticleOutlineSectionSchema = import_zod2.z.object({
  heading: import_zod2.z.string(),
  level: import_zod2.z.number().int().min(2).max(6).optional(),
  subpoints: import_zod2.z.array(import_zod2.z.string()).optional()
});
var PortableArticleMediaImageSchema = import_zod2.z.object({
  src: import_zod2.z.string().url(),
  alt: import_zod2.z.string().optional(),
  caption: import_zod2.z.string().optional()
});
var PortableArticleSchema = import_zod2.z.object({
  title: import_zod2.z.string(),
  excerpt: import_zod2.z.string().optional(),
  bodyHtml: import_zod2.z.string(),
  outline: import_zod2.z.array(PortableArticleOutlineSectionSchema).optional(),
  media: import_zod2.z.object({
    images: import_zod2.z.array(PortableArticleMediaImageSchema).optional()
  }).partial().optional(),
  tags: import_zod2.z.array(import_zod2.z.string()).optional(),
  locale: import_zod2.z.string().optional(),
  slug: import_zod2.z.string().optional(),
  seo: import_zod2.z.object({
    metaTitle: import_zod2.z.string().optional(),
    metaDescription: import_zod2.z.string().optional(),
    canonicalUrl: import_zod2.z.string().url().optional()
  }).optional()
});
var QueueJobDefinitionSchema = import_zod2.z.object({
  type: JobTypeSchema,
  payload: import_zod2.z.any(),
  priority: import_zod2.z.number().int().default(0),
  runAt: isoDate().optional()
});
var ScheduleRunResultSchema = import_zod2.z.object({
  generatedDrafts: import_zod2.z.number().int().nonnegative(),
  enqueuedJobs: import_zod2.z.number().int().nonnegative(),
  publishedArticles: import_zod2.z.number().int().nonnegative()
});
var ProjectScopedJobSchema = QueueJobDefinitionSchema.extend({
  projectId: import_zod2.z.string().min(1)
});
var PaginationSchema = import_zod2.z.object({
  cursor: import_zod2.z.string().optional(),
  limit: import_zod2.z.number().int().min(1).max(100).default(20)
});
var ProjectSnapshotSchema = import_zod2.z.object({
  project: ProjectSchema,
  integrations: import_zod2.z.array(IntegrationSchema),
  latestDiscovery: DiscoveryRunSchema.optional(),
  planItems: import_zod2.z.array(PlanItemSchema),
  queueDepth: import_zod2.z.number().int().nonnegative()
});
var CrawlBudgetSchema = import_zod2.z.object({
  maxPages: import_zod2.z.number().int().positive(),
  respectRobots: import_zod2.z.boolean().default(true),
  includeSitemaps: import_zod2.z.boolean().default(true)
});
var CrawlJobPayloadSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  siteUrl: import_zod2.z.string().url(),
  crawlBudget: CrawlBudgetSchema
});
var DiscoveryJobPayloadSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  pageIds: import_zod2.z.array(import_zod2.z.string().min(1)),
  locale: import_zod2.z.string().min(2),
  location: import_zod2.z.string().min(2).optional(),
  maxKeywords: import_zod2.z.number().int().positive().max(2e3).default(500),
  includeGAds: import_zod2.z.boolean().default(false),
  costEstimate: import_zod2.z.object({
    currency: import_zod2.z.string().default("usd"),
    labsSubtotal: import_zod2.z.number().nonnegative(),
    gadsSubtotal: import_zod2.z.number().nonnegative().optional(),
    total: import_zod2.z.number().nonnegative()
  }).optional()
});
var PlanJobPayloadSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  keywords: import_zod2.z.array(import_zod2.z.string().min(1)),
  locale: import_zod2.z.string().min(2),
  keywordIds: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  startDate: import_zod2.z.string().date().optional(),
  days: import_zod2.z.number().int().positive().max(90).optional()
});
var GenerateJobPayloadSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  planItemId: import_zod2.z.string().min(1)
});
var PublishJobPayloadSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  articleId: import_zod2.z.string().min(1),
  integrationId: import_zod2.z.string().min(1)
});
var QueuePayloadSchemas = {
  crawl: CrawlJobPayloadSchema,
  discovery: DiscoveryJobPayloadSchema,
  plan: PlanJobPayloadSchema,
  generate: GenerateJobPayloadSchema,
  publish: PublishJobPayloadSchema,
  linking: import_zod2.z.object({ projectId: import_zod2.z.string().min(1) }),
  reoptimize: import_zod2.z.object({ projectId: import_zod2.z.string().min(1), articleId: import_zod2.z.string().min(1) })
};
var DEFAULT_BUFFER_DAYS = 3;
var DEFAULT_DAILY_ARTICLES = 1;
var DEFAULT_CRAWL_BUDGET = 200;
var AppFeatureFlagSchema = import_zod2.z.enum([
  "seo-provider-metrics",
  "seo-autopublish-policy",
  "seo-buffer-days",
  "seo-crawl-budget",
  "seo-playwright-headless",
  "seo-publication-allowed"
]);
var FeatureConfigSchema = import_zod2.z.object({
  metricsProvider: MetricsProviderSchema.default("dataforseo"),
  autoPublishPolicy: AutoPublishPolicySchema.default("buffered"),
  bufferDays: import_zod2.z.number().int().min(0).default(DEFAULT_BUFFER_DAYS),
  crawlBudget: import_zod2.z.number().int().positive().default(DEFAULT_CRAWL_BUDGET),
  playwrightHeadless: import_zod2.z.boolean().default(true),
  publicationAllowed: import_zod2.z.array(IntegrationTypeSchema).default(["webhook"])
});
var SchedulePolicySchema = import_zod2.z.object({
  policy: AutoPublishPolicySchema,
  bufferDays: import_zod2.z.number().int().min(0)
});
var CreateOrgInputSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1),
  plan: import_zod2.z.string().min(1),
  entitlements: EntitlementSchema
});
var CreateProjectInputSchema = import_zod2.z.object({
  orgId: import_zod2.z.string().min(1),
  name: import_zod2.z.string().min(1),
  siteUrl: import_zod2.z.string().url(),
  defaultLocale: import_zod2.z.string().min(2),
  branding: BrandingSchema.optional()
});
var CreateIntegrationInputSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  type: IntegrationTypeSchema,
  config: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()),
  status: IntegrationStatusSchema.default("paused")
});
var UpdateIntegrationInputSchema = import_zod2.z.object({
  config: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.unknown()).optional(),
  status: IntegrationStatusSchema.optional()
});
var UpdateProjectInputSchema = import_zod2.z.object({
  defaultLocale: import_zod2.z.string().min(2).optional(),
  branding: BrandingSchema.optional(),
  autoPublishPolicy: AutoPublishPolicySchema.optional(),
  bufferDays: import_zod2.z.number().int().min(0).optional()
});
var ScheduleRunRequestSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1).optional(),
  policyOverride: SchedulePolicySchema.optional()
});
var ScheduleRunResponseSchema = import_zod2.z.object({
  status: import_zod2.z.literal("ok"),
  result: ScheduleRunResultSchema
});
var CreatePlanRequestSchema = import_zod2.z.object({
  projectId: import_zod2.z.string().min(1),
  keywordIds: import_zod2.z.array(import_zod2.z.string().min(1)).optional(),
  days: import_zod2.z.number().int().positive().max(90).default(30),
  startDate: import_zod2.z.string().date().optional()
});
var UpdatePlanItemSchema = import_zod2.z.object({
  plannedDate: import_zod2.z.string().date().optional(),
  status: PlanItemStatusSchema.optional(),
  title: import_zod2.z.string().min(1).optional(),
  outlineJson: PlanItemSchema.shape.outlineJson.optional()
}).refine(
  (data) => data.plannedDate !== void 0 || data.status !== void 0 || data.title !== void 0 || data.outlineJson !== void 0,
  {
    message: "Must provide at least one field to update"
  }
);
var MeResponseSchema = import_zod2.z.object({
  user: UserSchema.nullable(),
  orgs: import_zod2.z.array(OrgSchema).default([]),
  activeOrg: OrgSchema.nullable(),
  entitlements: EntitlementSchema.nullable().optional()
});
var HealthResponseSchema = import_zod2.z.object({
  ok: import_zod2.z.literal(true),
  service: import_zod2.z.string().min(1),
  version: import_zod2.z.string().min(1),
  timestamp: import_zod2.z.string().datetime({ offset: true })
});
var ApiErrorSchema = import_zod2.z.object({
  message: import_zod2.z.string(),
  code: import_zod2.z.string().optional(),
  details: import_zod2.z.any().optional()
});
var PaginatedResponseSchema = (item) => import_zod2.z.object({
  items: import_zod2.z.array(item),
  nextCursor: import_zod2.z.string().optional()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AcceptOrgInviteInputSchema,
  ApiErrorSchema,
  AppFeatureFlagSchema,
  ArticleSchema,
  ArticleStatusSchema,
  AutoPublishPolicySchema,
  BillingCheckoutRequestSchema,
  BillingLinkResponseSchema,
  BillingPortalRequestSchema,
  BrandingSchema,
  CrawlBudgetSchema,
  CrawlJobPayloadSchema,
  CrawlPageSchema,
  CreateIntegrationInputSchema,
  CreateKeywordInputSchema,
  CreateOrgInputSchema,
  CreateOrgInviteInputSchema,
  CreatePlanRequestSchema,
  CreateProjectInputSchema,
  CreateProjectResponseSchema,
  DEFAULT_BUFFER_DAYS,
  DEFAULT_CRAWL_BUDGET,
  DEFAULT_DAILY_ARTICLES,
  DiscoveryJobPayloadSchema,
  DiscoveryRunSchema,
  DiscoverySummarySchema,
  EntitlementSchema,
  FeatureConfigSchema,
  GenerateJobPayloadSchema,
  HealthResponseSchema,
  IntegrationSchema,
  IntegrationStatusSchema,
  IntegrationTypeSchema,
  JobLogSchema,
  JobSchema,
  JobStatusSchema,
  JobTypeSchema,
  KeywordMetricsSchema,
  KeywordSchema,
  KeywordSourceSchema,
  KeywordStatusSchema,
  MeResponseSchema,
  MetricCacheProviderSchema,
  MetricCacheSchema,
  MetricSourceSchema,
  MetricsProviderSchema,
  OrgInviteLinkResponseSchema,
  OrgInviteSchema,
  OrgInviteStatusSchema,
  OrgMemberRoleSchema,
  OrgMemberSchema,
  OrgSchema,
  PaginatedResponseSchema,
  PaginationSchema,
  PlanItemSchema,
  PlanItemStatusSchema,
  PlanJobPayloadSchema,
  PolarWebhookEventSchema,
  PortableArticleBlockSchema,
  PortableArticleDocumentSchema,
  PortableArticleMediaImageSchema,
  PortableArticleOutlineSectionSchema,
  PortableArticleSchema,
  ProjectSchema,
  ProjectScopedJobSchema,
  ProjectSnapshotSchema,
  ProviderSchema,
  PublishJobPayloadSchema,
  QueueJobDefinitionSchema,
  QueuePayloadSchemas,
  SchedulePolicySchema,
  ScheduleRunRequestSchema,
  ScheduleRunResponseSchema,
  ScheduleRunResultSchema,
  UpdateArticleInputSchema,
  UpdateIntegrationInputSchema,
  UpdateKeywordInputSchema,
  UpdatePlanItemSchema,
  UpdateProjectInputSchema,
  UserSchema,
  WebflowFieldMappingSchema,
  WebflowIntegrationConfigSchema,
  WebhookIntegrationConfigSchema
});

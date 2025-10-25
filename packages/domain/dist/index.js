// src/index.ts
import { z as z2 } from "zod";

// src/portable-article.ts
import { z } from "zod";
var PortableArticleBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paragraph"),
    html: z.string()
  }),
  z.object({
    kind: z.literal("quote"),
    html: z.string(),
    citation: z.string().optional()
  }),
  z.object({
    kind: z.literal("image"),
    src: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional()
  }),
  z.object({
    kind: z.literal("embed"),
    provider: z.string(),
    url: z.string().url(),
    html: z.string().optional()
  })
]);
var PortableArticleDocumentSchema = z.object({
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    canonicalUrl: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    locale: z.string().min(2).optional()
  }),
  content: z.array(PortableArticleBlockSchema)
});

// src/index.ts
var isoDate = () => z2.string().datetime({ offset: true });
var OrgMemberRoleSchema = z2.enum(["owner", "admin", "member"]);
var OrgInviteStatusSchema = z2.enum(["pending", "accepted", "revoked", "expired"]);
var IntegrationTypeSchema = z2.enum([
  "webhook",
  "webflow",
  "wordpress",
  "framer",
  "shopify",
  "wix"
]);
var IntegrationStatusSchema = z2.enum(["connected", "error", "paused"]);
var PlanItemStatusSchema = z2.enum(["planned", "skipped", "consumed"]);
var ArticleStatusSchema = z2.enum(["draft", "published", "failed"]);
var KeywordStatusSchema = z2.enum(["recommended", "planned", "generated"]);
var KeywordSourceSchema = z2.enum(["crawl", "llm", "manual"]);
var JobTypeSchema = z2.enum([
  "crawl",
  "discovery",
  "plan",
  "generate",
  "publish",
  "linking",
  "reoptimize"
]);
var JobStatusSchema = z2.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled"
]);
var ProviderSchema = z2.enum(["crawl", "llm", "dataforseo"]);
var MetricsProviderSchema = z2.enum(["dataforseo"]);
var MetricSourceSchema = z2.enum(["crawl", "llm", "manual", "provider"]);
var MetricCacheProviderSchema = z2.enum(["dataforseo"]);
var AutoPublishPolicySchema = z2.enum(["buffered", "immediate", "manual"]);
var EntitlementSchema = z2.object({
  projectQuota: z2.number().int().nonnegative(),
  crawlPages: z2.number().int().nonnegative(),
  dailyArticles: z2.number().int().nonnegative(),
  autoPublishPolicy: AutoPublishPolicySchema,
  bufferDays: z2.number().int().min(0).default(3)
});
var UserSchema = z2.object({
  id: z2.string().min(1),
  email: z2.string().email(),
  name: z2.string().min(1),
  imageUrl: z2.string().url().optional(),
  emailVerified: z2.boolean().optional(),
  createdAt: isoDate(),
  updatedAt: isoDate().optional()
});
var OrgSchema = z2.object({
  id: z2.string().min(1),
  name: z2.string().min(1),
  plan: z2.string().min(1),
  entitlementsJson: EntitlementSchema,
  createdAt: isoDate()
});
var OrgMemberSchema = z2.object({
  orgId: z2.string().min(1),
  userId: z2.string().min(1),
  role: OrgMemberRoleSchema
});
var OrgInviteSchema = z2.object({
  id: z2.string().min(1),
  orgId: z2.string().min(1),
  email: z2.string().email(),
  role: OrgMemberRoleSchema,
  token: z2.string().min(1),
  status: OrgInviteStatusSchema,
  createdAt: isoDate(),
  expiresAt: isoDate(),
  acceptedAt: isoDate().optional(),
  createdBy: z2.string().min(1).optional()
});
var CreateOrgInviteInputSchema = z2.object({
  orgId: z2.string().min(1),
  email: z2.string().email(),
  role: OrgMemberRoleSchema.default("member"),
  expiresInHours: z2.number().int().positive().max(168).default(72)
});
var AcceptOrgInviteInputSchema = z2.object({
  token: z2.string().min(1),
  userId: z2.string().min(1).optional()
});
var OrgInviteLinkResponseSchema = z2.object({
  inviteUrl: z2.string().url()
});
var BillingCheckoutRequestSchema = z2.object({
  orgId: z2.string().min(1),
  plan: z2.string().min(1),
  successUrl: z2.string().url(),
  cancelUrl: z2.string().url()
});
var BillingPortalRequestSchema = z2.object({
  orgId: z2.string().min(1),
  returnUrl: z2.string().url().optional()
});
var BillingLinkResponseSchema = z2.object({
  url: z2.string().url()
});
var PolarWebhookEventSchema = z2.object({
  type: z2.string().min(1),
  data: z2.object({
    orgId: z2.string().min(1),
    plan: z2.string().min(1),
    entitlements: EntitlementSchema.optional()
  })
});
var BrandingSchema = z2.object({
  tone: z2.string().optional(),
  voice: z2.string().optional(),
  palette: z2.array(z2.string()).optional(),
  brandPillars: z2.array(z2.string()).optional()
});
var ProjectSchema = z2.object({
  id: z2.string().min(1),
  orgId: z2.string().min(1),
  name: z2.string().min(1),
  siteUrl: z2.string().url(),
  defaultLocale: z2.string().min(2),
  brandingJson: BrandingSchema.optional(),
  autoPublishPolicy: AutoPublishPolicySchema.optional(),
  bufferDays: z2.number().int().min(0).optional(),
  createdAt: isoDate()
});
var CreateProjectResponseSchema = z2.object({
  project: ProjectSchema,
  crawlJobId: z2.string().min(1).optional()
});
var IntegrationSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  type: IntegrationTypeSchema,
  configJson: z2.record(z2.string(), z2.unknown()),
  status: IntegrationStatusSchema,
  createdAt: isoDate().optional(),
  updatedAt: isoDate().optional()
});
var WebhookIntegrationConfigSchema = z2.object({
  targetUrl: z2.string().url(),
  secret: z2.string().min(1)
});
var WebflowFieldMappingSchema = z2.object({
  name: z2.string().min(1).default("name"),
  slug: z2.string().min(1).default("slug"),
  body: z2.string().min(1),
  excerpt: z2.string().min(1).optional(),
  seoTitle: z2.string().min(1).optional(),
  seoDescription: z2.string().min(1).optional(),
  tags: z2.string().min(1).optional(),
  mainImage: z2.string().min(1).optional()
});
var WebflowIntegrationConfigSchema = z2.object({
  accessToken: z2.string().min(1),
  siteId: z2.string().min(1).optional(),
  collectionId: z2.string().min(1),
  fieldMapping: WebflowFieldMappingSchema,
  publishMode: z2.enum(["draft", "live"]).default("draft"),
  cmsLocaleId: z2.string().min(1).optional()
});
var CrawlPageSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  url: z2.string().url(),
  httpStatus: z2.number().int().min(100).max(599),
  contentHash: z2.string().min(1),
  extractedAt: isoDate(),
  metaJson: z2.object({
    title: z2.string().optional(),
    description: z2.string().optional()
  }),
  headingsJson: z2.array(
    z2.object({
      tag: z2.string(),
      content: z2.string()
    })
  ),
  linksJson: z2.array(
    z2.object({
      href: z2.string(),
      text: z2.string().optional()
    })
  ),
  contentBlobUrl: z2.string().url()
});
var DiscoverySummarySchema = z2.object({
  businessSummary: z2.string(),
  audience: z2.array(z2.string()),
  products: z2.array(z2.string()).optional(),
  topicClusters: z2.array(z2.string())
});
var DiscoveryRunSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  providersUsed: z2.array(ProviderSchema),
  startedAt: isoDate(),
  finishedAt: isoDate().nullable(),
  status: JobStatusSchema,
  costMeterJson: z2.object({
    creditsConsumed: z2.number().nonnegative(),
    currency: z2.string().default("usd")
  }).optional(),
  summaryJson: DiscoverySummarySchema
});
var KeywordMetricsSchema = z2.object({
  searchVolume: z2.number().nonnegative().nullable(),
  cpc: z2.number().nonnegative().nullable(),
  competition: z2.number().nonnegative().nullable(),
  trend12mo: z2.array(z2.number().nullable()).max(24).optional(),
  difficulty: z2.number().nonnegative().nullable(),
  intent: z2.string().min(1).nullable().optional(),
  sourceProvider: MetricsProviderSchema.optional(),
  provider: z2.string().min(1).optional(),
  fetchedAt: isoDate().optional(),
  asOf: isoDate().optional()
});
var KeywordMetricsUpdateSchema = KeywordMetricsSchema.partial();
var KeywordSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  phrase: z2.string().min(1),
  locale: z2.string().min(2),
  primaryTopic: z2.string().optional(),
  source: KeywordSourceSchema,
  metricsJson: KeywordMetricsSchema.optional(),
  status: KeywordStatusSchema,
  isStarred: z2.boolean().optional(),
  opportunityScore: z2.number().min(0).max(100).optional(),
  createdAt: isoDate().optional(),
  updatedAt: isoDate().optional()
});
var UpdateKeywordInputSchema = z2.object({
  phrase: z2.string().min(1).optional(),
  primaryTopic: z2.string().nullable().optional(),
  status: KeywordStatusSchema.optional(),
  metricsJson: KeywordMetricsUpdateSchema.optional(),
  isStarred: z2.boolean().optional(),
  opportunityScore: z2.number().min(0).max(100).optional()
}).refine(
  (value) => value.phrase !== void 0 || value.primaryTopic !== void 0 || value.status !== void 0 || value.metricsJson !== void 0 || value.isStarred !== void 0 || value.opportunityScore !== void 0,
  { message: "Provide at least one field to update" }
);
var CreateKeywordInputSchema = z2.object({
  projectId: z2.string().min(1),
  phrase: z2.string().min(1),
  locale: z2.string().min(2).default("en-US"),
  primaryTopic: z2.string().optional(),
  metricsJson: KeywordMetricsSchema.optional(),
  status: KeywordStatusSchema.default("recommended"),
  isStarred: z2.boolean().default(false),
  opportunityScore: z2.number().min(0).max(100).optional()
});
var PlanItemSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  keywordId: z2.string().min(1),
  plannedDate: z2.string().date(),
  title: z2.string().min(1),
  outlineJson: z2.array(
    z2.object({
      heading: z2.string(),
      subpoints: z2.array(z2.string()).default([])
    })
  ),
  status: PlanItemStatusSchema,
  createdAt: isoDate(),
  updatedAt: isoDate()
});
var ArticleSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  keywordId: z2.string().min(1),
  planItemId: z2.string().optional(),
  title: z2.string().min(1),
  outlineJson: PlanItemSchema.shape.outlineJson.optional(),
  bodyHtml: z2.string(),
  language: z2.string().min(2),
  tone: z2.string().optional(),
  mediaJson: z2.array(
    z2.object({
      kind: z2.enum(["image", "video", "embed"]),
      src: z2.string(),
      alt: z2.string().optional()
    })
  ).optional(),
  seoScore: z2.number().min(0).max(100).nullable().optional(),
  status: ArticleStatusSchema,
  cmsExternalId: z2.string().optional(),
  url: z2.string().url().optional(),
  generationDate: isoDate().optional(),
  publicationDate: isoDate().optional(),
  createdAt: isoDate(),
  updatedAt: isoDate()
});
var UpdateArticleInputSchema = z2.object({
  title: z2.string().min(1).optional(),
  outlineJson: PlanItemSchema.shape.outlineJson.optional(),
  bodyHtml: z2.string().min(1).optional(),
  language: z2.string().min(2).optional(),
  tone: z2.string().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one field to update"
});
var JobLogSchema = z2.object({
  message: z2.string(),
  level: z2.enum(["info", "warn", "error"]).default("info"),
  timestamp: isoDate()
});
var JobSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  type: JobTypeSchema,
  payloadJson: z2.record(z2.string(), z2.unknown()),
  status: JobStatusSchema,
  progressPct: z2.number().min(0).max(100).optional(),
  retries: z2.number().int().nonnegative().default(0),
  startedAt: isoDate().nullable(),
  finishedAt: isoDate().nullable(),
  logs: z2.array(JobLogSchema).default([])
});
var MetricCacheSchema = z2.object({
  id: z2.string().min(1),
  projectId: z2.string().min(1),
  provider: MetricCacheProviderSchema,
  hash: z2.string().min(1),
  metricsJson: KeywordMetricsSchema,
  fetchedAt: isoDate(),
  ttl: z2.number().int().nonnegative()
});
var PortableArticleOutlineSectionSchema = z2.object({
  heading: z2.string(),
  level: z2.number().int().min(2).max(6).optional(),
  subpoints: z2.array(z2.string()).optional()
});
var PortableArticleMediaImageSchema = z2.object({
  src: z2.string().url(),
  alt: z2.string().optional(),
  caption: z2.string().optional()
});
var PortableArticleSchema = z2.object({
  title: z2.string(),
  excerpt: z2.string().optional(),
  bodyHtml: z2.string(),
  outline: z2.array(PortableArticleOutlineSectionSchema).optional(),
  media: z2.object({
    images: z2.array(PortableArticleMediaImageSchema).optional()
  }).partial().optional(),
  tags: z2.array(z2.string()).optional(),
  locale: z2.string().optional(),
  slug: z2.string().optional(),
  seo: z2.object({
    metaTitle: z2.string().optional(),
    metaDescription: z2.string().optional(),
    canonicalUrl: z2.string().url().optional()
  }).optional()
});
var QueueJobDefinitionSchema = z2.object({
  type: JobTypeSchema,
  payload: z2.any(),
  priority: z2.number().int().default(0),
  runAt: isoDate().optional()
});
var ScheduleRunResultSchema = z2.object({
  generatedDrafts: z2.number().int().nonnegative(),
  enqueuedJobs: z2.number().int().nonnegative(),
  publishedArticles: z2.number().int().nonnegative()
});
var ProjectScopedJobSchema = QueueJobDefinitionSchema.extend({
  projectId: z2.string().min(1)
});
var PaginationSchema = z2.object({
  cursor: z2.string().optional(),
  limit: z2.number().int().min(1).max(100).default(20)
});
var ProjectSnapshotSchema = z2.object({
  project: ProjectSchema,
  integrations: z2.array(IntegrationSchema),
  latestDiscovery: DiscoveryRunSchema.optional(),
  planItems: z2.array(PlanItemSchema),
  queueDepth: z2.number().int().nonnegative()
});
var CrawlBudgetSchema = z2.object({
  maxPages: z2.number().int().positive(),
  respectRobots: z2.boolean().default(true),
  includeSitemaps: z2.boolean().default(true)
});
var CrawlJobPayloadSchema = z2.object({
  projectId: z2.string().min(1),
  siteUrl: z2.string().url(),
  crawlBudget: CrawlBudgetSchema
});
var DiscoveryJobPayloadSchema = z2.object({
  projectId: z2.string().min(1),
  pageIds: z2.array(z2.string().min(1)),
  locale: z2.string().min(2),
  location: z2.string().min(2).optional(),
  maxKeywords: z2.number().int().positive().max(2e3).default(500),
  includeGAds: z2.boolean().default(false),
  costEstimate: z2.object({
    currency: z2.string().default("usd"),
    labsSubtotal: z2.number().nonnegative(),
    gadsSubtotal: z2.number().nonnegative().optional(),
    total: z2.number().nonnegative()
  }).optional()
});
var PlanJobPayloadSchema = z2.object({
  projectId: z2.string().min(1),
  keywords: z2.array(z2.string().min(1)),
  locale: z2.string().min(2),
  keywordIds: z2.array(z2.string().min(1)).optional(),
  startDate: z2.string().date().optional(),
  days: z2.number().int().positive().max(90).optional()
});
var GenerateJobPayloadSchema = z2.object({
  projectId: z2.string().min(1),
  planItemId: z2.string().min(1)
});
var PublishJobPayloadSchema = z2.object({
  projectId: z2.string().min(1),
  articleId: z2.string().min(1),
  integrationId: z2.string().min(1)
});
var QueuePayloadSchemas = {
  crawl: CrawlJobPayloadSchema,
  discovery: DiscoveryJobPayloadSchema,
  plan: PlanJobPayloadSchema,
  generate: GenerateJobPayloadSchema,
  publish: PublishJobPayloadSchema,
  linking: z2.object({ projectId: z2.string().min(1) }),
  reoptimize: z2.object({ projectId: z2.string().min(1), articleId: z2.string().min(1) })
};
var DEFAULT_BUFFER_DAYS = 3;
var DEFAULT_DAILY_ARTICLES = 1;
var DEFAULT_CRAWL_BUDGET = 200;
var AppFeatureFlagSchema = z2.enum([
  "seo-provider-metrics",
  "seo-autopublish-policy",
  "seo-buffer-days",
  "seo-crawl-budget",
  "seo-playwright-headless",
  "seo-publication-allowed"
]);
var FeatureConfigSchema = z2.object({
  metricsProvider: MetricsProviderSchema.default("dataforseo"),
  autoPublishPolicy: AutoPublishPolicySchema.default("buffered"),
  bufferDays: z2.number().int().min(0).default(DEFAULT_BUFFER_DAYS),
  crawlBudget: z2.number().int().positive().default(DEFAULT_CRAWL_BUDGET),
  playwrightHeadless: z2.boolean().default(true),
  publicationAllowed: z2.array(IntegrationTypeSchema).default(["webhook"])
});
var SchedulePolicySchema = z2.object({
  policy: AutoPublishPolicySchema,
  bufferDays: z2.number().int().min(0)
});
var CreateOrgInputSchema = z2.object({
  name: z2.string().min(1),
  plan: z2.string().min(1),
  entitlements: EntitlementSchema
});
var CreateProjectInputSchema = z2.object({
  orgId: z2.string().min(1),
  name: z2.string().min(1),
  siteUrl: z2.string().url(),
  defaultLocale: z2.string().min(2),
  branding: BrandingSchema.optional()
});
var CreateIntegrationInputSchema = z2.object({
  projectId: z2.string().min(1),
  type: IntegrationTypeSchema,
  config: z2.record(z2.string(), z2.unknown()),
  status: IntegrationStatusSchema.default("paused")
});
var UpdateIntegrationInputSchema = z2.object({
  config: z2.record(z2.string(), z2.unknown()).optional(),
  status: IntegrationStatusSchema.optional()
});
var UpdateProjectInputSchema = z2.object({
  defaultLocale: z2.string().min(2).optional(),
  branding: BrandingSchema.optional(),
  autoPublishPolicy: AutoPublishPolicySchema.optional(),
  bufferDays: z2.number().int().min(0).optional()
});
var ScheduleRunRequestSchema = z2.object({
  projectId: z2.string().min(1).optional(),
  policyOverride: SchedulePolicySchema.optional()
});
var ScheduleRunResponseSchema = z2.object({
  status: z2.literal("ok"),
  result: ScheduleRunResultSchema
});
var CreatePlanRequestSchema = z2.object({
  projectId: z2.string().min(1),
  keywordIds: z2.array(z2.string().min(1)).optional(),
  days: z2.number().int().positive().max(90).default(30),
  startDate: z2.string().date().optional()
});
var UpdatePlanItemSchema = z2.object({
  plannedDate: z2.string().date().optional(),
  status: PlanItemStatusSchema.optional(),
  title: z2.string().min(1).optional(),
  outlineJson: PlanItemSchema.shape.outlineJson.optional()
}).refine(
  (data) => data.plannedDate !== void 0 || data.status !== void 0 || data.title !== void 0 || data.outlineJson !== void 0,
  {
    message: "Must provide at least one field to update"
  }
);
var MeResponseSchema = z2.object({
  user: UserSchema.nullable(),
  orgs: z2.array(OrgSchema).default([]),
  activeOrg: OrgSchema.nullable(),
  entitlements: EntitlementSchema.nullable().optional()
});
var HealthResponseSchema = z2.object({
  ok: z2.literal(true),
  service: z2.string().min(1),
  version: z2.string().min(1),
  timestamp: z2.string().datetime({ offset: true })
});
var ApiErrorSchema = z2.object({
  message: z2.string(),
  code: z2.string().optional(),
  details: z2.any().optional()
});
var PaginatedResponseSchema = (item) => z2.object({
  items: z2.array(item),
  nextCursor: z2.string().optional()
});
export {
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
};

import { z } from 'zod'

const isoDate = () => z.string().datetime({ offset: true })

export const OrgMemberRoleSchema = z.enum(['owner', 'admin', 'member'])
export type OrgMemberRole = z.infer<typeof OrgMemberRoleSchema>

const OrgInviteStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired'])
export { OrgInviteStatusSchema }
export type OrgInviteStatus = z.infer<typeof OrgInviteStatusSchema>

export const IntegrationTypeSchema = z.enum([
  'webhook',
  'webflow',
  'wordpress',
  'framer',
  'shopify',
  'wix'
])
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>

export const IntegrationStatusSchema = z.enum(['connected', 'error', 'paused'])
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>

export const PlanItemStatusSchema = z.enum(['planned', 'skipped', 'consumed'])
export type PlanItemStatus = z.infer<typeof PlanItemStatusSchema>

export const ArticleStatusSchema = z.enum(['draft', 'published', 'failed'])
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>

export const KeywordStatusSchema = z.enum(['recommended', 'planned', 'generated'])
export type KeywordStatus = z.infer<typeof KeywordStatusSchema>

export const KeywordSourceSchema = z.enum(['crawl', 'llm', 'manual'])
export type KeywordSource = z.infer<typeof KeywordSourceSchema>

export const JobTypeSchema = z.enum([
  'crawl',
  'discovery',
  'plan',
  'generate',
  'publish',
  'linking',
  'reoptimize'
])
export type JobType = z.infer<typeof JobTypeSchema>

export const JobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled'
])
export type JobStatus = z.infer<typeof JobStatusSchema>

export const ProviderSchema = z.enum(['crawl', 'llm', 'dataforseo'])
export type Provider = z.infer<typeof ProviderSchema>

export const MetricsProviderSchema = z.enum(['dataforseo'])
export type MetricsProvider = z.infer<typeof MetricsProviderSchema>

export const MetricSourceSchema = z.enum(['crawl', 'llm', 'manual', 'provider'])
export type MetricSource = z.infer<typeof MetricSourceSchema>

export const MetricCacheProviderSchema = z.enum(['dataforseo'])
export type MetricCacheProvider = z.infer<typeof MetricCacheProviderSchema>

export const AutoPublishPolicySchema = z.enum(['buffered', 'immediate', 'manual'])
export type AutoPublishPolicy = z.infer<typeof AutoPublishPolicySchema>

export const EntitlementSchema = z.object({
  projectQuota: z.number().int().nonnegative(),
  crawlPages: z.number().int().nonnegative(),
  dailyArticles: z.number().int().nonnegative(),
  autoPublishPolicy: AutoPublishPolicySchema,
  bufferDays: z.number().int().min(0).default(3)
})
export type Entitlement = z.infer<typeof EntitlementSchema>

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  imageUrl: z.string().url().optional(),
  emailVerified: z.boolean().optional(),
  createdAt: isoDate(),
  updatedAt: isoDate().optional()
})
export type User = z.infer<typeof UserSchema>

export const OrgSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plan: z.string().min(1),
  entitlementsJson: EntitlementSchema,
  createdAt: isoDate()
})
export type Org = z.infer<typeof OrgSchema>

export const OrgMemberSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  role: OrgMemberRoleSchema
})
export type OrgMember = z.infer<typeof OrgMemberSchema>

const OrgInviteSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  email: z.string().email(),
  role: OrgMemberRoleSchema,
  token: z.string().min(1),
  status: OrgInviteStatusSchema,
  createdAt: isoDate(),
  expiresAt: isoDate(),
  acceptedAt: isoDate().optional(),
  createdBy: z.string().min(1).optional()
})
export { OrgInviteSchema }
export type OrgInvite = z.infer<typeof OrgInviteSchema>

const CreateOrgInviteInputSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: OrgMemberRoleSchema.default('member'),
  expiresInHours: z.number().int().positive().max(168).default(72)
})
export { CreateOrgInviteInputSchema }
export type CreateOrgInviteInput = z.infer<typeof CreateOrgInviteInputSchema>

const AcceptOrgInviteInputSchema = z.object({
  token: z.string().min(1),
  userId: z.string().min(1).optional()
})
export { AcceptOrgInviteInputSchema }
export type AcceptOrgInviteInput = z.infer<typeof AcceptOrgInviteInputSchema>

const OrgInviteLinkResponseSchema = z.object({
  inviteUrl: z.string().url()
})
export { OrgInviteLinkResponseSchema }
export type OrgInviteLinkResponse = z.infer<typeof OrgInviteLinkResponseSchema>

const BillingCheckoutRequestSchema = z.object({
  orgId: z.string().min(1),
  plan: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
})
export { BillingCheckoutRequestSchema }
export type BillingCheckoutRequest = z.infer<typeof BillingCheckoutRequestSchema>

const BillingPortalRequestSchema = z.object({
  orgId: z.string().min(1),
  returnUrl: z.string().url().optional()
})
export { BillingPortalRequestSchema }
export type BillingPortalRequest = z.infer<typeof BillingPortalRequestSchema>

const BillingLinkResponseSchema = z.object({
  url: z.string().url()
})
export { BillingLinkResponseSchema }
export type BillingLinkResponse = z.infer<typeof BillingLinkResponseSchema>

const PolarWebhookEventSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    orgId: z.string().min(1),
    plan: z.string().min(1),
    entitlements: EntitlementSchema.optional()
  })
})
export { PolarWebhookEventSchema }
export type PolarWebhookEvent = z.infer<typeof PolarWebhookEventSchema>

export const BrandingSchema = z.object({
  tone: z.string().optional(),
  voice: z.string().optional(),
  palette: z.array(z.string()).optional(),
  brandPillars: z.array(z.string()).optional()
})

export const ProjectSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  name: z.string().min(1),
  siteUrl: z.string().url(),
  defaultLocale: z.string().min(2),
  brandingJson: BrandingSchema.optional(),
  autoPublishPolicy: AutoPublishPolicySchema.optional(),
  bufferDays: z.number().int().min(0).optional(),
  createdAt: isoDate()
})
export type Project = z.infer<typeof ProjectSchema>

export const CreateProjectResponseSchema = z.object({
  project: ProjectSchema,
  crawlJobId: z.string().min(1).optional()
})
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>

export const IntegrationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: IntegrationTypeSchema,
  configJson: z.record(z.string(), z.unknown()),
  status: IntegrationStatusSchema,
  createdAt: isoDate().optional(),
  updatedAt: isoDate().optional()
})
export type Integration = z.infer<typeof IntegrationSchema>

export const WebhookIntegrationConfigSchema = z.object({
  targetUrl: z.string().url(),
  secret: z.string().min(1)
})
export type WebhookIntegrationConfig = z.infer<typeof WebhookIntegrationConfigSchema>

export const WebflowFieldMappingSchema = z.object({
  name: z.string().min(1).default('name'),
  slug: z.string().min(1).default('slug'),
  body: z.string().min(1),
  excerpt: z.string().min(1).optional(),
  seoTitle: z.string().min(1).optional(),
  seoDescription: z.string().min(1).optional(),
  tags: z.string().min(1).optional(),
  mainImage: z.string().min(1).optional()
})
export type WebflowFieldMapping = z.infer<typeof WebflowFieldMappingSchema>

export const WebflowIntegrationConfigSchema = z.object({
  accessToken: z.string().min(1),
  siteId: z.string().min(1).optional(),
  collectionId: z.string().min(1),
  fieldMapping: WebflowFieldMappingSchema,
  publishMode: z.enum(['draft', 'live']).default('draft'),
  cmsLocaleId: z.string().min(1).optional()
})
export type WebflowIntegrationConfig = z.infer<typeof WebflowIntegrationConfigSchema>

export const CrawlPageSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  url: z.string().url(),
  httpStatus: z.number().int().min(100).max(599),
  contentHash: z.string().min(1),
  extractedAt: isoDate(),
  metaJson: z.object({
    title: z.string().optional(),
    description: z.string().optional()
  }),
  headingsJson: z.array(
    z.object({
      tag: z.string(),
      content: z.string()
    })
  ),
  linksJson: z.array(
    z.object({
      href: z.string(),
      text: z.string().optional()
    })
  ),
  contentBlobUrl: z.string().url()
})
export type CrawlPage = z.infer<typeof CrawlPageSchema>

export const DiscoverySummarySchema = z.object({
  businessSummary: z.string(),
  audience: z.array(z.string()),
  products: z.array(z.string()).optional(),
  topicClusters: z.array(z.string())
})

export const DiscoveryRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  providersUsed: z.array(ProviderSchema),
  startedAt: isoDate(),
  finishedAt: isoDate().nullable(),
  status: JobStatusSchema,
  costMeterJson: z
    .object({
      creditsConsumed: z.number().nonnegative(),
      currency: z.string().default('usd')
    })
    .optional(),
  summaryJson: DiscoverySummarySchema
})
export type DiscoveryRun = z.infer<typeof DiscoveryRunSchema>

export const KeywordMetricsSchema = z.object({
  searchVolume: z.number().nonnegative().nullable(),
  cpc: z.number().nonnegative().nullable(),
  competition: z.number().nonnegative().nullable(),
  trend12mo: z.array(z.number().nullable()).max(24).optional(),
  difficulty: z.number().nonnegative().nullable(),
  intent: z.string().min(1).nullable().optional(),
  sourceProvider: MetricsProviderSchema.optional(),
  provider: z.string().min(1).optional(),
  fetchedAt: isoDate().optional(),
  asOf: isoDate().optional()
})

const KeywordMetricsUpdateSchema = KeywordMetricsSchema.partial()

export const KeywordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  phrase: z.string().min(1),
  locale: z.string().min(2),
  primaryTopic: z.string().optional(),
  source: KeywordSourceSchema,
  metricsJson: KeywordMetricsSchema.optional(),
  status: KeywordStatusSchema,
  isStarred: z.boolean().optional(),
  opportunityScore: z.number().min(0).max(100).optional(),
  createdAt: isoDate().optional(),
  updatedAt: isoDate().optional()
})
export type Keyword = z.infer<typeof KeywordSchema>

export const UpdateKeywordInputSchema = z
  .object({
    phrase: z.string().min(1).optional(),
    primaryTopic: z.string().nullable().optional(),
    status: KeywordStatusSchema.optional(),
    metricsJson: KeywordMetricsUpdateSchema.optional(),
    isStarred: z.boolean().optional(),
    opportunityScore: z.number().min(0).max(100).optional()
  })
  .refine(
    (value) =>
      value.phrase !== undefined ||
      value.primaryTopic !== undefined ||
      value.status !== undefined ||
      value.metricsJson !== undefined ||
      value.isStarred !== undefined ||
      value.opportunityScore !== undefined,
    { message: 'Provide at least one field to update' }
  )
export type UpdateKeywordInput = z.infer<typeof UpdateKeywordInputSchema>

export const CreateKeywordInputSchema = z.object({
  projectId: z.string().min(1),
  phrase: z.string().min(1),
  locale: z.string().min(2).default('en-US'),
  primaryTopic: z.string().optional(),
  metricsJson: KeywordMetricsSchema.optional(),
  status: KeywordStatusSchema.default('recommended'),
  isStarred: z.boolean().default(false),
  opportunityScore: z.number().min(0).max(100).optional()
})
export type CreateKeywordInput = z.infer<typeof CreateKeywordInputSchema>

export const GenerateKeywordsRequestSchema = z.object({
  projectId: z.string().min(1),
  locale: z.string().min(2).default('en-US'),
  location: z.string().min(2).optional(),
  maxKeywords: z.number().int().positive().max(2000).optional(),
  includeGAds: z.boolean().optional()
})
export type GenerateKeywordsRequest = z.infer<typeof GenerateKeywordsRequestSchema>

export const PlanItemSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  keywordId: z.string().min(1),
  plannedDate: z.string().date(),
  title: z.string().min(1),
  outlineJson: z.array(
    z.object({
      heading: z.string(),
      subpoints: z.array(z.string()).default([])
    })
  ),
  status: PlanItemStatusSchema,
  createdAt: isoDate(),
  updatedAt: isoDate()
})
export type PlanItem = z.infer<typeof PlanItemSchema>

export const ArticleSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  keywordId: z.string().min(1),
  planItemId: z.string().optional(),
  title: z.string().min(1),
  outlineJson: PlanItemSchema.shape.outlineJson.optional(),
  bodyHtml: z.string(),
  language: z.string().min(2),
  tone: z.string().optional(),
  mediaJson: z.array(
    z.object({
      kind: z.enum(['image', 'video', 'embed']),
      src: z.string(),
      alt: z.string().optional()
    })
  ).optional(),
  seoScore: z.number().min(0).max(100).nullable().optional(),
  status: ArticleStatusSchema,
  cmsExternalId: z.string().optional(),
  url: z.string().url().optional(),
  generationDate: isoDate().optional(),
  publicationDate: isoDate().optional(),
  createdAt: isoDate(),
  updatedAt: isoDate()
})
export type Article = z.infer<typeof ArticleSchema>

export const UpdateArticleInputSchema = z
  .object({
    title: z.string().min(1).optional(),
    outlineJson: PlanItemSchema.shape.outlineJson.optional(),
    bodyHtml: z.string().min(1).optional(),
    language: z.string().min(2).optional(),
    tone: z.string().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update'
  })
export type UpdateArticleInput = z.infer<typeof UpdateArticleInputSchema>

export const JobLogSchema = z.object({
  message: z.string(),
  level: z.enum(['info', 'warn', 'error']).default('info'),
  timestamp: isoDate()
})

export const JobSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: JobTypeSchema,
  payloadJson: z.record(z.string(), z.unknown()),
  status: JobStatusSchema,
  progressPct: z.number().min(0).max(100).optional(),
  retries: z.number().int().nonnegative().default(0),
  startedAt: isoDate().nullable(),
  finishedAt: isoDate().nullable(),
  logs: z.array(JobLogSchema).default([])
})
export type Job = z.infer<typeof JobSchema>

export const MetricCacheSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  provider: MetricCacheProviderSchema,
  hash: z.string().min(1),
  metricsJson: KeywordMetricsSchema,
  fetchedAt: isoDate(),
  ttl: z.number().int().nonnegative()
})
export type MetricCache = z.infer<typeof MetricCacheSchema>

export const PortableArticleOutlineSectionSchema = z.object({
  heading: z.string(),
  level: z.number().int().min(2).max(6).optional(),
  subpoints: z.array(z.string()).optional()
})
export type PortableArticleOutlineSection = z.infer<typeof PortableArticleOutlineSectionSchema>

export const PortableArticleMediaImageSchema = z.object({
  src: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional()
})
export type PortableArticleMediaImage = z.infer<typeof PortableArticleMediaImageSchema>

export const PortableArticleSchema = z.object({
  title: z.string(),
  excerpt: z.string().optional(),
  bodyHtml: z.string(),
  outline: z.array(PortableArticleOutlineSectionSchema).optional(),
  media: z
    .object({
      images: z.array(PortableArticleMediaImageSchema).optional()
    })
    .partial()
    .optional(),
  tags: z.array(z.string()).optional(),
  locale: z.string().optional(),
  slug: z.string().optional(),
  seo: z
    .object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      canonicalUrl: z.string().url().optional()
    })
    .optional()
})
export type PortableArticle = z.infer<typeof PortableArticleSchema>

export const QueueJobDefinitionSchema = z.object({
  type: JobTypeSchema,
  payload: z.any(),
  priority: z.number().int().default(0),
  runAt: isoDate().optional()
})
export type QueueJobDefinition = z.infer<typeof QueueJobDefinitionSchema>

export const ScheduleRunResultSchema = z.object({
  generatedDrafts: z.number().int().nonnegative(),
  enqueuedJobs: z.number().int().nonnegative(),
  publishedArticles: z.number().int().nonnegative()
})
export type ScheduleRunResult = z.infer<typeof ScheduleRunResultSchema>

export const ProjectScopedJobSchema = QueueJobDefinitionSchema.extend({
  projectId: z.string().min(1)
})
export type ProjectScopedJob = z.infer<typeof ProjectScopedJobSchema>

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20)
})
export type Pagination = z.infer<typeof PaginationSchema>

export const ProjectSnapshotSchema = z.object({
  project: ProjectSchema,
  integrations: z.array(IntegrationSchema),
  latestDiscovery: DiscoveryRunSchema.optional(),
  planItems: z.array(PlanItemSchema),
  queueDepth: z.number().int().nonnegative()
})
export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>

export const CrawlBudgetSchema = z.object({
  maxPages: z.number().int().positive(),
  respectRobots: z.boolean().default(true),
  includeSitemaps: z.boolean().default(true)
})

export const CrawlJobPayloadSchema = z.object({
  projectId: z.string().min(1),
  siteUrl: z.string().url(),
  crawlBudget: CrawlBudgetSchema
})

export const DiscoveryJobPayloadSchema = z.object({
  projectId: z.string().min(1),
  pageIds: z.array(z.string().min(1)),
  locale: z.string().min(2),
  location: z.string().min(2).optional(),
  maxKeywords: z.number().int().positive().max(2000).default(500),
  includeGAds: z.boolean().default(false),
  costEstimate: z
    .object({
      currency: z.string().default('usd'),
      labsSubtotal: z.number().nonnegative(),
      gadsSubtotal: z.number().nonnegative().optional(),
      total: z.number().nonnegative()
    })
    .optional()
})

export const PlanJobPayloadSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  locale: z.string().min(2),
  keywordIds: z.array(z.string().min(1)).optional(),
  startDate: z.string().date().optional(),
  days: z.number().int().positive().max(90).optional()
})

export const GenerateJobPayloadSchema = z.object({
  projectId: z.string().min(1),
  planItemId: z.string().min(1)
})

export const PublishJobPayloadSchema = z.object({
  projectId: z.string().min(1),
  articleId: z.string().min(1),
  integrationId: z.string().min(1)
})

export const QueuePayloadSchemas = {
  crawl: CrawlJobPayloadSchema,
  discovery: DiscoveryJobPayloadSchema,
  plan: PlanJobPayloadSchema,
  generate: GenerateJobPayloadSchema,
  publish: PublishJobPayloadSchema,
  linking: z.object({ projectId: z.string().min(1) }),
  reoptimize: z.object({ projectId: z.string().min(1), articleId: z.string().min(1) })
} satisfies Record<JobType, z.ZodTypeAny>

export type QueuePayloadSchemasMap = typeof QueuePayloadSchemas

export type QueuePayloadFor<T extends JobType> = z.infer<(typeof QueuePayloadSchemas)[T]>

export type AnyQueuePayload = {
  [K in JobType]: { type: K; payload: QueuePayloadFor<K> }
}[JobType]

export const DEFAULT_BUFFER_DAYS = 3
export const DEFAULT_DAILY_ARTICLES = 1
export const DEFAULT_CRAWL_BUDGET = 200

export const AppFeatureFlagSchema = z.enum([
  'seo-provider-metrics',
  'seo-autopublish-policy',
  'seo-buffer-days',
  'seo-crawl-budget',
  'seo-playwright-headless',
  'seo-publication-allowed'
])
export type AppFeatureFlag = z.infer<typeof AppFeatureFlagSchema>

export const FeatureConfigSchema = z.object({
  metricsProvider: MetricsProviderSchema.default('dataforseo'),
  autoPublishPolicy: AutoPublishPolicySchema.default('buffered'),
  bufferDays: z.number().int().min(0).default(DEFAULT_BUFFER_DAYS),
  crawlBudget: z.number().int().positive().default(DEFAULT_CRAWL_BUDGET),
  playwrightHeadless: z.boolean().default(true),
  publicationAllowed: z.array(IntegrationTypeSchema).default(['webhook'])
})
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>

export const SchedulePolicySchema = z.object({
  policy: AutoPublishPolicySchema,
  bufferDays: z.number().int().min(0)
})

export type SchedulePolicy = z.infer<typeof SchedulePolicySchema>

export const CreateOrgInputSchema = z.object({
  name: z.string().min(1),
  plan: z.string().min(1),
  entitlements: EntitlementSchema
})

export const CreateProjectInputSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  siteUrl: z.string().url(),
  defaultLocale: z.string().min(2),
  branding: BrandingSchema.optional()
})

export const CreateIntegrationInputSchema = z.object({
  projectId: z.string().min(1),
  type: IntegrationTypeSchema,
  config: z.record(z.string(), z.unknown()),
  status: IntegrationStatusSchema.default('paused')
})

export const UpdateIntegrationInputSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  status: IntegrationStatusSchema.optional()
})

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>
export type CreateIntegrationInput = z.infer<typeof CreateIntegrationInputSchema>
export type UpdateIntegrationInput = z.infer<typeof UpdateIntegrationInputSchema>
export type CreateOrgInput = z.infer<typeof CreateOrgInputSchema>

export const UpdateProjectInputSchema = z.object({
  defaultLocale: z.string().min(2).optional(),
  branding: BrandingSchema.optional(),
  autoPublishPolicy: AutoPublishPolicySchema.optional(),
  bufferDays: z.number().int().min(0).optional()
})
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>

export const ScheduleRunRequestSchema = z.object({
  projectId: z.string().min(1).optional(),
  policyOverride: SchedulePolicySchema.optional()
})

export const ScheduleRunResponseSchema = z.object({
  status: z.literal('ok'),
  result: ScheduleRunResultSchema
})

export const CreatePlanRequestSchema = z.object({
  projectId: z.string().min(1),
  keywordIds: z.array(z.string().min(1)).optional(),
  days: z.number().int().positive().max(90).default(30),
  startDate: z.string().date().optional()
})
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>

export const UpdatePlanItemSchema = z
  .object({
    plannedDate: z.string().date().optional(),
    status: PlanItemStatusSchema.optional(),
    title: z.string().min(1).optional(),
    outlineJson: PlanItemSchema.shape.outlineJson.optional()
  })
  .refine(
    (data) =>
      data.plannedDate !== undefined ||
      data.status !== undefined ||
      data.title !== undefined ||
      data.outlineJson !== undefined,
    {
      message: 'Must provide at least one field to update'
    }
  )
export type UpdatePlanItemInput = z.infer<typeof UpdatePlanItemSchema>

export const MeResponseSchema = z.object({
  user: UserSchema.nullable(),
  orgs: z.array(OrgSchema).default([]),
  activeOrg: OrgSchema.nullable(),
  entitlements: EntitlementSchema.nullable().optional()
})
export type MeResponse = z.infer<typeof MeResponseSchema>

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.string().datetime({ offset: true })
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>

export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.any().optional()
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().optional()
  })

export type PaginatedResponse<T> = {
  items: T[]
  nextCursor?: string
}

export * from './portable-article'

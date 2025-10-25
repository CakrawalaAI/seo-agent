import {
  ApiErrorSchema,
  ArticleSchema,
  HealthResponseSchema,
  MeResponseSchema,
  CreateIntegrationInputSchema,
  UpdateIntegrationInputSchema,
  CreateOrgInputSchema,
  CreateProjectInputSchema,
  CreateProjectResponseSchema,
  CrawlPageSchema,
  JobSchema,
  IntegrationSchema,
  KeywordSchema,
  CreateKeywordInputSchema,
  OrgMemberRoleSchema,
  OrgSchema,
  PaginatedResponseSchema,
  PlanItemSchema,
  ProjectSchema,
  ProjectSnapshotSchema,
  ScheduleRunRequestSchema,
  ScheduleRunResponseSchema,
  UpdateArticleInputSchema,
  UpdateKeywordInputSchema,
  CreatePlanRequestSchema,
  UpdatePlanItemSchema,
  GenerateKeywordsRequestSchema,
  type ApiError,
  type Article,
  type CreateIntegrationInput,
  type UpdateIntegrationInput,
  type CreateOrgInput,
  type CreateProjectInput,
  UpdateProjectInputSchema,
  type MeResponse,
  type Job,
  type CrawlPage,
  type Integration,
  type Keyword,
  type CreateKeywordInput,
  type Org,
  type HealthResponse,
  type CreateProjectResponse,
  type PaginatedResponse,
  type PlanItem,
  type PlanItemStatus,
  type Project,
  type ProjectSnapshot,
  type UpdateProjectInput,
  type UpdateArticleInput,
  type UpdateKeywordInput,
  type SchedulePolicy,
  type CreatePlanRequest,
  type UpdatePlanItemInput,
  type GenerateKeywordsRequest
} from '@seo-agent/domain'
import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'
import { z } from 'zod'

const StartJobResponseSchema = z.object({
  jobId: z.string(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  reused: z.boolean().optional(),
  skipped: z.boolean().optional(),
  costEstimate: z
    .object({
      currency: z.string(),
      labsSubtotal: z.number(),
      gadsSubtotal: z.number().optional(),
      total: z.number()
    })
    .optional()
})

const CrawlStatusSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  processedPages: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().nonnegative().optional(),
  updatedAt: z.string().datetime({ offset: true })
})

const CreateOrgInviteInputSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: OrgMemberRoleSchema.default('member'),
  expiresInHours: z.number().int().positive().max(168).default(72)
})
type CreateOrgInviteInput = z.infer<typeof CreateOrgInviteInputSchema>

const OrgInviteLinkResponseSchema = z.object({
  inviteUrl: z.string().url()
})
type OrgInviteLinkResponse = z.infer<typeof OrgInviteLinkResponseSchema>

const BillingCheckoutRequestSchema = z.object({
  orgId: z.string().min(1),
  plan: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
})
type BillingCheckoutRequest = z.infer<typeof BillingCheckoutRequestSchema>

const BillingPortalRequestSchema = z.object({
  orgId: z.string().min(1),
  returnUrl: z.string().url().optional()
})
type BillingPortalRequest = z.infer<typeof BillingPortalRequestSchema>

const BillingLinkResponseSchema = z.object({
  url: z.string().url()
})
type BillingLinkResponse = z.infer<typeof BillingLinkResponseSchema>

const AcceptInviteResponseSchema = z.object({
  status: z.string(),
  orgId: z.string()
})

const PublishArticleRequestSchema = z.object({
  integrationId: z.string().min(1)
})

const IntegrationTestResponseSchema = z.object({
  status: z.literal('ok'),
  message: z.string().optional()
})

const DeleteResponseSchema = z.object({
  status: z.string(),
  projectId: z.string().optional(),
  integrationId: z.string().optional(),
  keywordId: z.string().optional(),
  id: z.string().optional()
})

export type FetchRequestInit = RequestInit | UndiciRequestInit

export type Fetcher = (input: RequestInfo | URL, init?: FetchRequestInit) => Promise<Response>

export type SeoAgentClientOptions = {
  baseUrl: string
  fetch?: Fetcher
  defaultHeaders?: HeadersInit
}

const defaultFetch: Fetcher =
  typeof fetch === 'function'
    ? (fetch.bind(globalThis) as unknown as Fetcher)
    : (undiciFetch.bind(globalThis) as unknown as Fetcher)

export class SeoAgentClient {
  private readonly fetcher: Fetcher
  private readonly baseUrl: string
  private readonly defaultHeaders: HeadersInit

  constructor(options: SeoAgentClientOptions) {
    if (!options.baseUrl) {
      throw new Error('SeoAgentClient requires baseUrl')
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetcher = options.fetch ?? defaultFetch
    this.defaultHeaders = options.defaultHeaders ?? { 'content-type': 'application/json' }
  }

  private buildUrl(path: string, params?: URLSearchParams | Record<string, string | number | null | undefined>) {
    const url = new URL(path, this.baseUrl)
    if (params) {
      const sp = params instanceof URLSearchParams ? params : new URLSearchParams()
      if (!(params instanceof URLSearchParams)) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            sp.set(key, String(value))
          }
        }
      }
      url.search = sp.toString()
    }
    return url
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    schema?: z.ZodTypeAny,
    params?: URLSearchParams | Record<string, string | number | null | undefined>
  ): Promise<T> {
    const url = this.buildUrl(path, params)
    const response = await this.fetcher(url, {
      method,
      headers: this.defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    })

    if (!response.ok) {
      const json = await response.json().catch(() => null)
      const apiError = json ? ApiErrorSchema.safeParse(json) : null
      const error: ApiError = apiError?.success
        ? apiError.data
        : { message: response.statusText, code: String(response.status) }
      throw Object.assign(new Error(error.message), {
        status: response.status,
        details: error.details,
        code: error.code
      })
    }

    if (!schema) {
      return undefined as T
    }

    const json = await response.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      throw new Error(`Unexpected response from ${method} ${path}: ${parsed.error.message}`)
    }
    return parsed.data as T
  }

  async ping(): Promise<HealthResponse> {
    return this.request('GET', '/api/health', undefined, HealthResponseSchema)
  }

  async createOrg(input: CreateOrgInput): Promise<Org> {
    const payload = CreateOrgInputSchema.parse(input)
    return this.request('POST', '/api/orgs', payload, OrgSchema)
  }

  async createOrgInvite(input: CreateOrgInviteInput): Promise<OrgInviteLinkResponse> {
    const payload = CreateOrgInviteInputSchema.parse(input)
    return this.request(
      'POST',
      `/api/orgs/${payload.orgId}/invites`,
      payload,
      OrgInviteLinkResponseSchema
    )
  }

  async acceptOrgInvite(token: string) {
    const params = z.object({ token: z.string().min(1) }).parse({ token })
    return this.request('POST', `/api/orgs/invites/${params.token}/accept`, undefined, AcceptInviteResponseSchema)
  }

  async createProject(input: CreateProjectInput): Promise<CreateProjectResponse> {
    const payload = CreateProjectInputSchema.parse(input)
    return this.request('POST', '/api/projects', payload, CreateProjectResponseSchema)
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    const payload = UpdateProjectInputSchema.parse(input)
    return this.request('PATCH', `/api/projects/${projectId}`, payload, ProjectSchema)
  }

  async deleteProject(projectId: string) {
    return this.request<{ status: string; projectId?: string }>(
      'DELETE',
      `/api/projects/${projectId}`,
      undefined,
      DeleteResponseSchema
    )
  }

  async listProjects(filters?: { orgId?: string; cursor?: string; limit?: number }) {
    const params = new URLSearchParams()
    if (filters?.orgId) params.set('orgId', filters.orgId)
    if (filters?.cursor) params.set('cursor', filters.cursor)
    if (filters?.limit) params.set('limit', String(filters.limit))

    const schema = PaginatedResponseSchema(ProjectSchema) as z.ZodType<PaginatedResponse<Project>>
    return this.request<PaginatedResponse<Project>>('GET', '/api/projects', undefined, schema, params)
  }

  async createIntegration(input: CreateIntegrationInput): Promise<Integration> {
    const payload = CreateIntegrationInputSchema.parse(input)
    return this.request('POST', '/api/integrations', payload, IntegrationSchema)
  }

  async updateIntegration(integrationId: string, input: UpdateIntegrationInput): Promise<Integration> {
    const payload = UpdateIntegrationInputSchema.parse(input)
    return this.request('PATCH', `/api/integrations/${integrationId}`, payload, IntegrationSchema)
  }

  async deleteIntegration(integrationId: string): Promise<string> {
    const response = await this.request<{ status: string; integrationId?: string }>(
      'DELETE',
      `/api/integrations/${integrationId}`,
      undefined,
      DeleteResponseSchema
    )
    return response.status
  }

  async createBillingCheckout(input: BillingCheckoutRequest): Promise<BillingLinkResponse> {
    const payload = BillingCheckoutRequestSchema.parse(input)
    return this.request('POST', '/api/billing/checkout', payload, BillingLinkResponseSchema)
  }

  async getBillingPortalLink(input: BillingPortalRequest): Promise<BillingLinkResponse> {
    const payload = BillingPortalRequestSchema.parse(input)
    const params = new URLSearchParams()
    params.set('orgId', payload.orgId)
    if (payload.returnUrl) {
      params.set('returnUrl', payload.returnUrl)
    }
    return this.request('GET', '/api/billing/portal', undefined, BillingLinkResponseSchema, params)
  }

  async startCrawl(
    projectId: string,
    options?: {
      crawlBudget?: {
        maxPages?: number
        respectRobots?: boolean
        includeSitemaps?: boolean
      }
    }
  ) {
    const payload: Record<string, unknown> = { projectId }
    if (options?.crawlBudget) {
      payload.crawlBudget = options.crawlBudget
    }
    return this.request('POST', '/api/crawl/run', payload, StartJobResponseSchema)
  }

  async getCrawlStatus(jobId: string) {
    return this.request('GET', `/api/crawl/${jobId}/status`, undefined, CrawlStatusSchema)
  }

  async listCrawlRuns(filters?: { projectId?: string; cursor?: string; limit?: number }) {
    const params = new URLSearchParams()
    if (filters?.projectId) params.set('projectId', filters.projectId)
    if (filters?.cursor) params.set('cursor', filters.cursor)
    if (filters?.limit) params.set('limit', String(filters.limit))

    const schema = PaginatedResponseSchema(JobSchema) as z.ZodType<PaginatedResponse<Job>>
    return this.request<PaginatedResponse<Job>>(
      'GET',
      '/api/crawl/runs',
      undefined,
      schema,
      params
    )
  }

  async startDiscovery(projectId: string) {
    return this.request(
      'POST',
      '/api/discovery/start',
      { projectId },
      StartJobResponseSchema
    )
  }

  async listKeywords(
    projectId: string,
    pagination?: { cursor?: string; limit?: number; status?: string }
  ) {
    const params = new URLSearchParams()
    if (pagination?.cursor) params.set('cursor', pagination.cursor)
    if (pagination?.limit) params.set('limit', String(pagination.limit))
    if (pagination?.status) params.set('status', pagination.status)

    const schema = PaginatedResponseSchema(KeywordSchema) as z.ZodType<PaginatedResponse<Keyword>>
    return this.request<PaginatedResponse<Keyword>>(
      'GET',
      `/api/projects/${projectId}/keywords`,
      undefined,
      schema,
      params
    )
  }

  async createKeyword(input: CreateKeywordInput): Promise<Keyword> {
    const payload = CreateKeywordInputSchema.parse(input)
    return this.request('POST', '/api/keywords', payload, KeywordSchema)
  }

  async deleteKeyword(keywordId: string): Promise<string> {
    const response = await this.request<{ status: string; keywordId?: string }>(
      'DELETE',
      `/api/keywords/${keywordId}`,
      undefined,
      DeleteResponseSchema
    )
    return response.status
  }

  async updateKeyword(keywordId: string, input: UpdateKeywordInput): Promise<Keyword> {
    const payload = UpdateKeywordInputSchema.parse(input)
    return this.request('PATCH', `/api/keywords/${keywordId}`, payload, KeywordSchema)
  }

  async listPlanItems(
    projectId: string,
    pagination?: { cursor?: string; limit?: number; status?: PlanItemStatus; from?: string; to?: string }
  ) {
    const params = new URLSearchParams()
    params.set('projectId', projectId)
    if (pagination?.cursor) params.set('cursor', pagination.cursor)
    if (pagination?.limit) params.set('limit', String(pagination.limit))
    if (pagination?.status) params.set('status', pagination.status)
    if (pagination?.from) params.set('from', pagination.from)
    if (pagination?.to) params.set('to', pagination.to)

    const schema = PaginatedResponseSchema(PlanItemSchema) as z.ZodType<PaginatedResponse<PlanItem>>
    return this.request<PaginatedResponse<PlanItem>>('GET', '/api/plan-items', undefined, schema, params)
  }

  async createPlan(input: CreatePlanRequest) {
    const payload = CreatePlanRequestSchema.parse(input)
    return this.request('POST', '/api/plan-items', payload, StartJobResponseSchema)
  }

  async updatePlanItem(planItemId: string, input: UpdatePlanItemInput): Promise<PlanItem> {
    const payload = UpdatePlanItemSchema.parse(input)
    return this.request('PUT', `/api/plan-items/${planItemId}`, payload, PlanItemSchema)
  }

  async getProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
    return this.request('GET', `/api/projects/${projectId}/snapshot`, undefined, ProjectSnapshotSchema)
  }

  async runSchedule(input: { projectId?: string; policy?: SchedulePolicy }) {
    const payload = ScheduleRunRequestSchema.parse({
      projectId: input.projectId,
      policyOverride: input.policy
    })
    return this.request('POST', '/api/schedules/run', payload, ScheduleRunResponseSchema)
  }

  async listArticles(projectId: string, pagination?: { cursor?: string; limit?: number; status?: string }) {
    const params = new URLSearchParams()
    if (pagination?.cursor) params.set('cursor', pagination.cursor)
    if (pagination?.limit) params.set('limit', String(pagination.limit))
    if (pagination?.status) params.set('status', pagination.status)

    const schema = PaginatedResponseSchema(ArticleSchema) as z.ZodType<PaginatedResponse<Article>>
    return this.request<PaginatedResponse<Article>>(
      'GET',
      `/api/projects/${projectId}/articles`,
      undefined,
      schema,
      params
    )
  }

  async getArticle(articleId: string): Promise<Article> {
    return this.request('GET', `/api/articles/${articleId}`, undefined, ArticleSchema)
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request('GET', `/api/projects/${projectId}`, undefined, ProjectSchema)
  }

  async generateArticle(planItemId: string) {
    const payload = z.object({ planItemId: z.string().min(1) }).parse({ planItemId })
    return this.request('POST', '/api/articles/generate', payload, StartJobResponseSchema)
  }

  async publishArticle(articleId: string, integrationId: string) {
    const payload = PublishArticleRequestSchema.parse({ integrationId })
    return this.request('POST', `/api/articles/${articleId}/publish`, payload, StartJobResponseSchema)
  }

  async updateArticle(articleId: string, input: UpdateArticleInput): Promise<Article> {
    const payload = UpdateArticleInputSchema.parse(input)
    return this.request('PATCH', `/api/articles/${articleId}`, payload, ArticleSchema)
  }

  async testIntegration(integrationId: string) {
    return this.request('POST', `/api/integrations/${integrationId}/test`, undefined, IntegrationTestResponseSchema)
  }

  async validateIntegration(input: { type: string; config: Record<string, unknown> }) {
    const payload = z
      .object({ type: z.string().min(1), config: z.record(z.string(), z.unknown()) })
      .parse(input)
    const schema = z.object({ status: z.literal('ok'), config: z.record(z.string(), z.unknown()) })
    return this.request('POST', '/api/integrations/validate', payload, schema)
  }

  async getCurrentUser(): Promise<MeResponse> {
    return this.request('GET', '/api/me', undefined, MeResponseSchema)
  }

  async getJob(jobId: string): Promise<Job> {
    return this.request('GET', `/api/jobs/${jobId}`, undefined, JobSchema)
  }

  async listProjectJobs(projectId: string, filters?: { type?: string; status?: string; limit?: number }) {
    const params = new URLSearchParams()
    params.set('projectId', projectId)
    if (filters?.type) params.set('type', filters.type)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.limit) params.set('limit', String(filters.limit))

    const schema = z.object({ items: z.array(JobSchema) }) as z.ZodType<{
      items: Job[]
    }>
    const response = await this.request<{ items: Job[] }>(
      'GET',
      `/api/projects/${projectId}/jobs`,
      undefined,
      schema,
      params
    )
    return response.items
  }

  async generateKeywords(
    projectId: string,
    options?:
      | string
      | {
          locale?: string
          location?: string
          max?: number
          includeGAds?: boolean
        }
  ) {
    const payload = GenerateKeywordsRequestSchema.parse({
      projectId,
      locale: typeof options === 'string' ? options : options?.locale,
      location: typeof options === 'object' ? options.location : undefined,
      maxKeywords: typeof options === 'object' ? options.max : undefined,
      includeGAds: typeof options === 'object' ? options.includeGAds : undefined
    } as Partial<GenerateKeywordsRequest>)
    return this.request('POST', '/api/keywords/generate', payload, StartJobResponseSchema)
  }

  async listCrawlPages(projectId: string, pagination?: { cursor?: string; limit?: number }) {
    const params = new URLSearchParams()
    params.set('projectId', projectId)
    if (pagination?.cursor) params.set('cursor', pagination.cursor)
    if (pagination?.limit) params.set('limit', String(pagination.limit))

    const schema = PaginatedResponseSchema(CrawlPageSchema) as z.ZodType<PaginatedResponse<CrawlPage>>
    return this.request<PaginatedResponse<CrawlPage>>(
      'GET',
      '/api/crawl/pages',
      undefined,
      schema,
      params
    )
  }
}


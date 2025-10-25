// src/client.ts
import {
  ApiErrorSchema,
  ArticleSchema,
  HealthResponseSchema,
  MeResponseSchema,
  CreateIntegrationInputSchema,
  UpdateIntegrationInputSchema,
  UpdateProjectInputSchema,
  CreateOrgInputSchema,
  CreateProjectInputSchema,
  CreateProjectResponseSchema,
  CrawlPageSchema,
  JobSchema,
  IntegrationSchema,
  KeywordSchema,
  OrgMemberRoleSchema,
  OrgSchema,
  PaginatedResponseSchema,
  PlanItemSchema,
  ProjectSchema,
  ProjectSnapshotSchema,
  ScheduleRunRequestSchema,
  ScheduleRunResponseSchema
} from "@seo-agent/domain";
import { fetch as undiciFetch } from "undici";
import { z } from "zod";
var StartJobResponseSchema = z.object({
  jobId: z.string(),
  projectId: z.string().optional(),
  status: z.string().optional()
});
var CrawlStatusSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  processedPages: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().nonnegative().optional(),
  updatedAt: z.string().datetime({ offset: true })
});
var CreateOrgInviteInputSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: OrgMemberRoleSchema.default("member"),
  expiresInHours: z.number().int().positive().max(168).default(72)
});
var OrgInviteLinkResponseSchema = z.object({
  inviteUrl: z.string().url()
});
var BillingCheckoutRequestSchema = z.object({
  orgId: z.string().min(1),
  plan: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});
var BillingPortalRequestSchema = z.object({
  orgId: z.string().min(1),
  returnUrl: z.string().url().optional()
});
var BillingLinkResponseSchema = z.object({
  url: z.string().url()
});
var AcceptInviteResponseSchema = z.object({
  status: z.string(),
  orgId: z.string()
});
var PublishArticleRequestSchema = z.object({
  integrationId: z.string().min(1)
});
var IntegrationTestResponseSchema = z.object({
  status: z.literal("ok"),
  message: z.string().optional()
});
var PlanCreateSchema = z.object({
  projectId: z.string().min(1),
  keywordIds: z.array(z.string().min(1)).optional(),
  days: z.number().int().positive().max(90).optional(),
  startDate: z.string().min(10).max(10).optional()
});
var PlanUpdateSchema = z.object({
  plannedDate: z.string().min(10).max(10).optional(),
  status: z.enum(["planned", "skipped", "consumed"]).optional()
}).refine((value) => value.plannedDate || value.status, { message: "Must provide plannedDate or status" });
var defaultFetch = typeof fetch === "function" ? fetch.bind(globalThis) : undiciFetch.bind(globalThis);
var DeleteResponseSchema = z.object({ status: z.string() });
var SeoAgentClient = class {
  constructor(options) {
    if (!options.baseUrl) {
      throw new Error("SeoAgentClient requires baseUrl");
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetcher = options.fetch ?? defaultFetch;
    this.defaultHeaders = options.defaultHeaders ?? { "content-type": "application/json" };
  }
  buildUrl(path, params) {
    const url = new URL(path, this.baseUrl);
    if (params) {
      const sp = params instanceof URLSearchParams ? params : new URLSearchParams();
      if (!(params instanceof URLSearchParams)) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== void 0 && value !== null) {
            sp.set(key, String(value));
          }
        }
      }
      url.search = sp.toString();
    }
    return url;
  }
  async request(method, path, body, schema, params) {
    const url = this.buildUrl(path, params);
    const response = await this.fetcher(url, {
      method,
      headers: this.defaultHeaders,
      body: body ? JSON.stringify(body) : void 0,
      credentials: "include"
    });
    if (!response.ok) {
      const json2 = await response.json().catch(() => null);
      const apiError = json2 ? ApiErrorSchema.safeParse(json2) : null;
      const error = apiError?.success ? apiError.data : { message: response.statusText, code: String(response.status) };
      throw Object.assign(new Error(error.message), {
        status: response.status,
        details: error.details,
        code: error.code
      });
    }
    if (!schema) {
      return void 0;
    }
    const json = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Unexpected response from ${method} ${path}: ${parsed.error.message}`);
    }
    return parsed.data;
  }
  async ping() {
    return this.request("GET", "/api/health", void 0, HealthResponseSchema);
  }
  async createOrg(input) {
    const payload = CreateOrgInputSchema.parse(input);
    return this.request("POST", "/api/orgs", payload, OrgSchema);
  }
  async createOrgInvite(input) {
    const payload = CreateOrgInviteInputSchema.parse(input);
    return this.request(
      "POST",
      `/api/orgs/${payload.orgId}/invites`,
      payload,
      OrgInviteLinkResponseSchema
    );
  }
  async acceptOrgInvite(token) {
    const params = z.object({ token: z.string().min(1) }).parse({ token });
    return this.request("POST", `/api/orgs/invites/${params.token}/accept`, void 0, AcceptInviteResponseSchema);
  }
  async createProject(input) {
    const payload = CreateProjectInputSchema.parse(input);
    return this.request("POST", "/api/projects", payload, CreateProjectResponseSchema);
  }
  async updateProject(projectId, input) {
    const payload = UpdateProjectInputSchema.parse(input);
    return this.request("PATCH", `/api/projects/${projectId}`, payload, ProjectSchema);
  }
  async listProjects(filters) {
    const params = new URLSearchParams();
    if (filters?.orgId) params.set("orgId", filters.orgId);
    if (filters?.cursor) params.set("cursor", filters.cursor);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const schema = PaginatedResponseSchema(ProjectSchema);
    return this.request("GET", "/api/projects", void 0, schema, params);
  }
  async createIntegration(input) {
    const payload = CreateIntegrationInputSchema.parse(input);
    return this.request("POST", "/api/integrations", payload, IntegrationSchema);
  }
  async updateIntegration(integrationId, input) {
    const payload = UpdateIntegrationInputSchema.parse(input);
    return this.request("PATCH", `/api/integrations/${integrationId}`, payload, IntegrationSchema);
  }
  async deleteIntegration(integrationId) {
    const response = await this.request("DELETE", `/api/integrations/${integrationId}`, void 0, DeleteResponseSchema);
    return response.status;
  }
  async createBillingCheckout(input) {
    const payload = BillingCheckoutRequestSchema.parse(input);
    return this.request("POST", "/api/billing/checkout", payload, BillingLinkResponseSchema);
  }
  async getBillingPortalLink(input) {
    const payload = BillingPortalRequestSchema.parse(input);
    const params = new URLSearchParams();
    params.set("orgId", payload.orgId);
    if (payload.returnUrl) {
      params.set("returnUrl", payload.returnUrl);
    }
    return this.request("GET", "/api/billing/portal", void 0, BillingLinkResponseSchema, params);
  }
  async startCrawl(projectId) {
    return this.request(
      "POST",
      "/api/crawl/start",
      { projectId },
      StartJobResponseSchema
    );
  }
  async getCrawlStatus(jobId) {
    return this.request("GET", `/api/crawl/${jobId}/status`, void 0, CrawlStatusSchema);
  }
  async startDiscovery(projectId) {
    return this.request(
      "POST",
      "/api/discovery/start",
      { projectId },
      StartJobResponseSchema
    );
  }
  async listKeywords(projectId, pagination) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (pagination?.cursor) params.set("cursor", pagination.cursor);
    if (pagination?.limit) params.set("limit", String(pagination.limit));
    const schema = PaginatedResponseSchema(KeywordSchema);
    return this.request("GET", "/api/keywords", void 0, schema, params);
  }
  async listPlanItems(projectId, pagination) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (pagination?.cursor) params.set("cursor", pagination.cursor);
    if (pagination?.limit) params.set("limit", String(pagination.limit));
    if (pagination?.status) params.set("status", pagination.status);
    const schema = PaginatedResponseSchema(PlanItemSchema);
    return this.request(
      "GET",
      "/api/plan-items",
      void 0,
      schema,
      params
    );
  }
  async createPlan(input) {
    const payload = PlanCreateSchema.parse(input);
    return this.request("POST", "/api/plan/create", payload, StartJobResponseSchema);
  }
  async updatePlanItem(planItemId, input) {
    const payload = PlanUpdateSchema.parse(input);
    return this.request("PATCH", `/api/plan/${planItemId}`, payload, PlanItemSchema);
  }
  async getProjectSnapshot(projectId) {
    return this.request("GET", `/api/projects/${projectId}/snapshot`, void 0, ProjectSnapshotSchema);
  }
  async runSchedule(input) {
    const payload = ScheduleRunRequestSchema.parse({
      projectId: input.projectId,
      policyOverride: input.policy
    });
    return this.request("POST", "/api/schedules/run", payload, ScheduleRunResponseSchema);
  }
  async listArticles(projectId, pagination) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (pagination?.cursor) params.set("cursor", pagination.cursor);
    if (pagination?.limit) params.set("limit", String(pagination.limit));
    if (pagination?.status) params.set("status", pagination.status);
    const schema = PaginatedResponseSchema(ArticleSchema);
    return this.request(
      "GET",
      "/api/articles",
      void 0,
      schema,
      params
    );
  }
  async getArticle(articleId) {
    return this.request("GET", `/api/articles/${articleId}`, void 0, ArticleSchema);
  }
  async getProject(projectId) {
    return this.request("GET", `/api/projects/${projectId}`, void 0, ProjectSchema);
  }
  async publishArticle(articleId, integrationId) {
    const payload = PublishArticleRequestSchema.parse({ integrationId });
    return this.request("POST", `/api/articles/${articleId}/publish`, payload, StartJobResponseSchema);
  }
  async testIntegration(integrationId) {
    return this.request("POST", `/api/integrations/${integrationId}/test`, void 0, IntegrationTestResponseSchema);
  }
  async getCurrentUser() {
    return this.request("GET", "/api/me", void 0, MeResponseSchema);
  }
  async getJob(jobId) {
    return this.request("GET", `/api/jobs/${jobId}`, void 0, JobSchema);
  }
  async listProjectJobs(projectId, filters) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const schema = z.object({ items: z.array(JobSchema) });
    const response = await this.request(
      "GET",
      `/api/projects/${projectId}/jobs`,
      void 0,
      schema,
      params
    );
    return response.items;
  }
  async generateKeywords(projectId, locale) {
    const payload = keywordGeneratePayload.parse({ projectId, locale });
    return this.request("POST", "/api/keywords/generate", payload, StartJobResponseSchema);
  }
  async listCrawlPages(projectId, pagination) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (pagination?.cursor) params.set("cursor", pagination.cursor);
    if (pagination?.limit) params.set("limit", String(pagination.limit));
    const schema = PaginatedResponseSchema(CrawlPageSchema);
    return this.request(
      "GET",
      "/api/crawl/pages",
      void 0,
      schema,
      params
    );
  }
};
var keywordGeneratePayload = z.object({
  projectId: z.string().min(1),
  locale: z.string().min(2).default("en-US")
});
export {
  SeoAgentClient
};

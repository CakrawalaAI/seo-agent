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

// src/client.ts
var client_exports = {};
__export(client_exports, {
  SeoAgentClient: () => SeoAgentClient
});
module.exports = __toCommonJS(client_exports);
var import_domain = require("@seo-agent/domain");
var import_undici = require("undici");
var import_zod = require("zod");
var StartJobResponseSchema = import_zod.z.object({
  jobId: import_zod.z.string(),
  projectId: import_zod.z.string().optional(),
  status: import_zod.z.string().optional()
});
var CrawlStatusSchema = import_zod.z.object({
  jobId: import_zod.z.string(),
  status: import_zod.z.string(),
  processedPages: import_zod.z.number().int().nonnegative().optional(),
  totalPages: import_zod.z.number().int().nonnegative().optional(),
  updatedAt: import_zod.z.string().datetime({ offset: true })
});
var CreateOrgInviteInputSchema = import_zod.z.object({
  orgId: import_zod.z.string().min(1),
  email: import_zod.z.string().email(),
  role: import_domain.OrgMemberRoleSchema.default("member"),
  expiresInHours: import_zod.z.number().int().positive().max(168).default(72)
});
var OrgInviteLinkResponseSchema = import_zod.z.object({
  inviteUrl: import_zod.z.string().url()
});
var BillingCheckoutRequestSchema = import_zod.z.object({
  orgId: import_zod.z.string().min(1),
  plan: import_zod.z.string().min(1),
  successUrl: import_zod.z.string().url(),
  cancelUrl: import_zod.z.string().url()
});
var BillingPortalRequestSchema = import_zod.z.object({
  orgId: import_zod.z.string().min(1),
  returnUrl: import_zod.z.string().url().optional()
});
var BillingLinkResponseSchema = import_zod.z.object({
  url: import_zod.z.string().url()
});
var AcceptInviteResponseSchema = import_zod.z.object({
  status: import_zod.z.string(),
  orgId: import_zod.z.string()
});
var PublishArticleRequestSchema = import_zod.z.object({
  integrationId: import_zod.z.string().min(1)
});
var IntegrationTestResponseSchema = import_zod.z.object({
  status: import_zod.z.literal("ok"),
  message: import_zod.z.string().optional()
});
var PlanCreateSchema = import_zod.z.object({
  projectId: import_zod.z.string().min(1),
  keywordIds: import_zod.z.array(import_zod.z.string().min(1)).optional(),
  days: import_zod.z.number().int().positive().max(90).optional(),
  startDate: import_zod.z.string().min(10).max(10).optional()
});
var PlanUpdateSchema = import_zod.z.object({
  plannedDate: import_zod.z.string().min(10).max(10).optional(),
  status: import_zod.z.enum(["planned", "skipped", "consumed"]).optional()
}).refine((value) => value.plannedDate || value.status, { message: "Must provide plannedDate or status" });
var defaultFetch = typeof fetch === "function" ? fetch.bind(globalThis) : import_undici.fetch.bind(globalThis);
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
      const apiError = json2 ? import_domain.ApiErrorSchema.safeParse(json2) : null;
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
    return this.request("GET", "/api/health", void 0, import_domain.HealthResponseSchema);
  }
  async createOrg(input) {
    const payload = import_domain.CreateOrgInputSchema.parse(input);
    return this.request("POST", "/api/orgs", payload, import_domain.OrgSchema);
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
    const params = import_zod.z.object({ token: import_zod.z.string().min(1) }).parse({ token });
    return this.request("POST", `/api/orgs/invites/${params.token}/accept`, void 0, AcceptInviteResponseSchema);
  }
  async createProject(input) {
    const payload = import_domain.CreateProjectInputSchema.parse(input);
    return this.request("POST", "/api/projects", payload, import_domain.CreateProjectResponseSchema);
  }
  async createIntegration(input) {
    const payload = import_domain.CreateIntegrationInputSchema.parse(input);
    return this.request("POST", "/api/integrations", payload, import_domain.IntegrationSchema);
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
    const schema = (0, import_domain.PaginatedResponseSchema)(import_domain.KeywordSchema);
    return this.request("GET", "/api/keywords", void 0, schema, params);
  }
  async listPlanItems(projectId, pagination) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (pagination?.cursor) params.set("cursor", pagination.cursor);
    if (pagination?.limit) params.set("limit", String(pagination.limit));
    if (pagination?.status) params.set("status", pagination.status);
    const schema = (0, import_domain.PaginatedResponseSchema)(import_domain.PlanItemSchema);
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
    return this.request("PATCH", `/api/plan/${planItemId}`, payload, import_domain.PlanItemSchema);
  }
  async getProjectSnapshot(projectId) {
    return this.request("GET", `/api/projects/${projectId}/snapshot`, void 0, import_domain.ProjectSnapshotSchema);
  }
  async runSchedule(input) {
    const payload = import_domain.ScheduleRunRequestSchema.parse({
      projectId: input.projectId,
      policyOverride: input.policy
    });
    return this.request("POST", "/api/schedules/run", payload, import_domain.ScheduleRunResponseSchema);
  }
  async listArticles(projectId, pagination) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (pagination?.cursor) params.set("cursor", pagination.cursor);
    if (pagination?.limit) params.set("limit", String(pagination.limit));
    if (pagination?.status) params.set("status", pagination.status);
    const schema = (0, import_domain.PaginatedResponseSchema)(import_domain.ArticleSchema);
    return this.request(
      "GET",
      "/api/articles",
      void 0,
      schema,
      params
    );
  }
  async getArticle(articleId) {
    return this.request("GET", `/api/articles/${articleId}`, void 0, import_domain.ArticleSchema);
  }
  async publishArticle(articleId, integrationId) {
    const payload = PublishArticleRequestSchema.parse({ integrationId });
    return this.request("POST", `/api/articles/${articleId}/publish`, payload, StartJobResponseSchema);
  }
  async testIntegration(integrationId) {
    return this.request("POST", `/api/integrations/${integrationId}/test`, void 0, IntegrationTestResponseSchema);
  }
  async getCurrentUser() {
    return this.request("GET", "/api/me", void 0, import_domain.MeResponseSchema);
  }
  async getJob(jobId) {
    return this.request("GET", `/api/jobs/${jobId}`, void 0, import_domain.JobSchema);
  }
  async listProjectJobs(projectId, filters) {
    const params = new URLSearchParams();
    params.set("projectId", projectId);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const schema = import_zod.z.object({ items: import_zod.z.array(import_domain.JobSchema) });
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
    const schema = (0, import_domain.PaginatedResponseSchema)(import_domain.CrawlPageSchema);
    return this.request(
      "GET",
      "/api/crawl/pages",
      void 0,
      schema,
      params
    );
  }
};
var keywordGeneratePayload = import_zod.z.object({
  projectId: import_zod.z.string().min(1),
  locale: import_zod.z.string().min(2).default("en-US")
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SeoAgentClient
});

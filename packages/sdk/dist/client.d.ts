import { HealthResponse, CreateOrgInput, Org, CreateProjectInput, CreateProjectResponse, CreateIntegrationInput, UpdateIntegrationInput, UpdateProjectInput, Integration, PaginatedResponse, PlanItemStatus, PlanItem, Project, ProjectSnapshot, SchedulePolicy, Article, MeResponse, Job } from '@seo-agent/domain';
import { RequestInit as RequestInit$1 } from 'undici';
import { z } from 'zod';

declare const CreateOrgInviteInputSchema: z.ZodObject<{
    orgId: z.ZodString;
    email: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["owner", "admin", "member"]>>;
    expiresInHours: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    email: string;
    role: "owner" | "admin" | "member";
    expiresInHours: number;
}, {
    orgId: string;
    email: string;
    role?: "owner" | "admin" | "member" | undefined;
    expiresInHours?: number | undefined;
}>;
type CreateOrgInviteInput = z.infer<typeof CreateOrgInviteInputSchema>;
declare const OrgInviteLinkResponseSchema: z.ZodObject<{
    inviteUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    inviteUrl: string;
}, {
    inviteUrl: string;
}>;
type OrgInviteLinkResponse = z.infer<typeof OrgInviteLinkResponseSchema>;
declare const BillingCheckoutRequestSchema: z.ZodObject<{
    orgId: z.ZodString;
    plan: z.ZodString;
    successUrl: z.ZodString;
    cancelUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    plan: string;
    successUrl: string;
    cancelUrl: string;
}, {
    orgId: string;
    plan: string;
    successUrl: string;
    cancelUrl: string;
}>;
type BillingCheckoutRequest = z.infer<typeof BillingCheckoutRequestSchema>;
declare const BillingPortalRequestSchema: z.ZodObject<{
    orgId: z.ZodString;
    returnUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    returnUrl?: string | undefined;
}, {
    orgId: string;
    returnUrl?: string | undefined;
}>;
type BillingPortalRequest = z.infer<typeof BillingPortalRequestSchema>;
declare const BillingLinkResponseSchema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
type BillingLinkResponse = z.infer<typeof BillingLinkResponseSchema>;
declare const PlanCreateSchema: z.ZodObject<{
    projectId: z.ZodString;
    keywordIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    days: z.ZodOptional<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    keywordIds?: string[] | undefined;
    days?: number | undefined;
    startDate?: string | undefined;
}, {
    projectId: string;
    keywordIds?: string[] | undefined;
    days?: number | undefined;
    startDate?: string | undefined;
}>;
declare const PlanUpdateSchema: z.ZodEffects<z.ZodObject<{
    plannedDate: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["planned", "skipped", "consumed"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "planned" | "skipped" | "consumed" | undefined;
    plannedDate?: string | undefined;
}, {
    status?: "planned" | "skipped" | "consumed" | undefined;
    plannedDate?: string | undefined;
}>, {
    status?: "planned" | "skipped" | "consumed" | undefined;
    plannedDate?: string | undefined;
}, {
    status?: "planned" | "skipped" | "consumed" | undefined;
    plannedDate?: string | undefined;
}>;
type PlanCreateInput = z.infer<typeof PlanCreateSchema>;
type PlanUpdateInput = z.infer<typeof PlanUpdateSchema>;
type FetchRequestInit = RequestInit | RequestInit$1;
type Fetcher = (input: RequestInfo | URL, init?: FetchRequestInit) => Promise<Response>;
type SeoAgentClientOptions = {
    baseUrl: string;
    fetch?: Fetcher;
    defaultHeaders?: HeadersInit;
};
declare class SeoAgentClient {
    private readonly fetcher;
    private readonly baseUrl;
    private readonly defaultHeaders;
    constructor(options: SeoAgentClientOptions);
    private buildUrl;
    private request;
    ping(): Promise<HealthResponse>;
    createOrg(input: CreateOrgInput): Promise<Org>;
    createOrgInvite(input: CreateOrgInviteInput): Promise<OrgInviteLinkResponse>;
    acceptOrgInvite(token: string): Promise<unknown>;
    createProject(input: CreateProjectInput): Promise<CreateProjectResponse>;
    updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>;
    createIntegration(input: CreateIntegrationInput): Promise<Integration>;
    updateIntegration(integrationId: string, input: UpdateIntegrationInput): Promise<Integration>;
    deleteIntegration(integrationId: string): Promise<string>;
    createBillingCheckout(input: BillingCheckoutRequest): Promise<BillingLinkResponse>;
    getBillingPortalLink(input: BillingPortalRequest): Promise<BillingLinkResponse>;
    startCrawl(projectId: string): Promise<unknown>;
    getCrawlStatus(jobId: string): Promise<unknown>;
    startDiscovery(projectId: string): Promise<unknown>;
    listKeywords(projectId: string, pagination?: {
        cursor?: string;
        limit?: number;
    }): Promise<PaginatedResponse<{
        status: "planned" | "recommended" | "generated";
        locale: string;
        id: string;
        projectId: string;
        phrase: string;
        source: "crawl" | "llm" | "manual";
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
        primaryTopic?: string | undefined;
        metricsJson?: {
            searchVolume: number | null;
            cpc: number | null;
            competition: number | null;
            difficulty: number | null;
            sourceProvider?: "dataforseo" | undefined;
            asOf?: string | undefined;
        } | undefined;
    }>>;
    listPlanItems(projectId: string, pagination?: {
        cursor?: string;
        limit?: number;
        status?: PlanItemStatus;
    }): Promise<PaginatedResponse<{
        status: "planned" | "skipped" | "consumed";
        title: string;
        id: string;
        createdAt: string;
        updatedAt: string;
        projectId: string;
        keywordId: string;
        plannedDate: string;
        outlineJson: {
            heading: string;
            subpoints: string[];
        }[];
    }>>;
    createPlan(input: PlanCreateInput): Promise<unknown>;
    updatePlanItem(planItemId: string, input: PlanUpdateInput): Promise<PlanItem>;
    getProjectSnapshot(projectId: string): Promise<ProjectSnapshot>;
    runSchedule(input: {
        projectId?: string;
        policy?: SchedulePolicy;
    }): Promise<unknown>;
    listArticles(projectId: string, pagination?: {
        cursor?: string;
        limit?: number;
        status?: string;
    }): Promise<PaginatedResponse<{
        status: "draft" | "published" | "failed";
        title: string;
        id: string;
        createdAt: string;
        updatedAt: string;
        projectId: string;
        keywordId: string;
        bodyHtml: string;
        language: string;
        url?: string | undefined;
        tone?: string | undefined;
        outlineJson?: {
            heading: string;
            subpoints: string[];
        }[] | undefined;
        planItemId?: string | undefined;
        mediaJson?: {
            kind: "image" | "embed" | "video";
            src: string;
            alt?: string | undefined;
        }[] | undefined;
        seoScore?: number | null | undefined;
        cmsExternalId?: string | undefined;
        generationDate?: string | undefined;
        publicationDate?: string | undefined;
    }>>;
    getArticle(articleId: string): Promise<Article>;
    getProject(projectId: string): Promise<Project>;
    publishArticle(articleId: string, integrationId: string): Promise<unknown>;
    testIntegration(integrationId: string): Promise<{
        status: "ok";
        message?: string | undefined;
    }>;
    getCurrentUser(): Promise<MeResponse>;
    getJob(jobId: string): Promise<Job>;
    listProjectJobs(projectId: string, filters?: {
        type?: string;
        status?: string;
        limit?: number;
    }): Promise<{
        type: "crawl" | "discovery" | "plan" | "generate" | "publish" | "linking" | "reoptimize";
        status: "failed" | "queued" | "running" | "succeeded" | "canceled";
        id: string;
        projectId: string;
        startedAt: string | null;
        finishedAt: string | null;
        payloadJson: Record<string, unknown>;
        retries: number;
        logs: {
            message: string;
            level: "error" | "info" | "warn";
            timestamp: string;
        }[];
        progressPct?: number | undefined;
    }[]>;
    generateKeywords(projectId: string, locale?: string): Promise<unknown>;
    listCrawlPages(projectId: string, pagination?: {
        cursor?: string;
        limit?: number;
    }): Promise<PaginatedResponse<{
        url: string;
        id: string;
        projectId: string;
        httpStatus: number;
        contentHash: string;
        extractedAt: string;
        metaJson: {
            title?: string | undefined;
            description?: string | undefined;
        };
        headingsJson: {
            content: string;
            tag: string;
        }[];
        linksJson: {
            href: string;
            text?: string | undefined;
        }[];
        contentBlobUrl: string;
    }>>;
}

export { type FetchRequestInit, type Fetcher, SeoAgentClient, type SeoAgentClientOptions };

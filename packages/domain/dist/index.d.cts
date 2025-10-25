import { z } from 'zod';
export { PortableArticleBlock, PortableArticleBlockSchema, PortableArticleDocument, PortableArticleDocumentSchema } from './portable-article.cjs';

declare const OrgMemberRoleSchema: z.ZodEnum<["owner", "admin", "member"]>;
type OrgMemberRole = z.infer<typeof OrgMemberRoleSchema>;
declare const IntegrationTypeSchema: z.ZodEnum<["webhook", "webflow", "wordpress", "framer", "shopify", "wix"]>;
type IntegrationType = z.infer<typeof IntegrationTypeSchema>;
declare const IntegrationStatusSchema: z.ZodEnum<["connected", "error", "paused"]>;
type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
declare const PlanItemStatusSchema: z.ZodEnum<["planned", "skipped", "consumed"]>;
type PlanItemStatus = z.infer<typeof PlanItemStatusSchema>;
declare const ArticleStatusSchema: z.ZodEnum<["draft", "published", "failed"]>;
type ArticleStatus = z.infer<typeof ArticleStatusSchema>;
declare const KeywordStatusSchema: z.ZodEnum<["recommended", "planned", "generated"]>;
type KeywordStatus = z.infer<typeof KeywordStatusSchema>;
declare const KeywordSourceSchema: z.ZodEnum<["crawl", "llm", "manual"]>;
type KeywordSource = z.infer<typeof KeywordSourceSchema>;
declare const JobTypeSchema: z.ZodEnum<["crawl", "discovery", "plan", "generate", "publish", "linking", "reoptimize"]>;
type JobType = z.infer<typeof JobTypeSchema>;
declare const JobStatusSchema: z.ZodEnum<["queued", "running", "succeeded", "failed", "canceled"]>;
type JobStatus = z.infer<typeof JobStatusSchema>;
declare const ProviderSchema: z.ZodEnum<["crawl", "llm", "dataforseo"]>;
type Provider = z.infer<typeof ProviderSchema>;
declare const MetricsProviderSchema: z.ZodEnum<["dataforseo"]>;
type MetricsProvider = z.infer<typeof MetricsProviderSchema>;
declare const MetricSourceSchema: z.ZodEnum<["crawl", "llm", "manual", "provider"]>;
type MetricSource = z.infer<typeof MetricSourceSchema>;
declare const MetricCacheProviderSchema: z.ZodEnum<["dataforseo"]>;
type MetricCacheProvider = z.infer<typeof MetricCacheProviderSchema>;
declare const AutoPublishPolicySchema: z.ZodEnum<["buffered", "immediate", "manual"]>;
type AutoPublishPolicy = z.infer<typeof AutoPublishPolicySchema>;
declare const EntitlementSchema: z.ZodObject<{
    projectQuota: z.ZodNumber;
    crawlPages: z.ZodNumber;
    dailyArticles: z.ZodNumber;
    autoPublishPolicy: z.ZodEnum<["buffered", "immediate", "manual"]>;
    bufferDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    projectQuota: number;
    crawlPages: number;
    dailyArticles: number;
    autoPublishPolicy: "manual" | "buffered" | "immediate";
    bufferDays: number;
}, {
    projectQuota: number;
    crawlPages: number;
    dailyArticles: number;
    autoPublishPolicy: "manual" | "buffered" | "immediate";
    bufferDays?: number | undefined;
}>;
type Entitlement = z.infer<typeof EntitlementSchema>;
declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    imageUrl: z.ZodOptional<z.ZodString>;
    emailVerified: z.ZodOptional<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    imageUrl?: string | undefined;
    emailVerified?: boolean | undefined;
    updatedAt?: string | undefined;
}, {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    imageUrl?: string | undefined;
    emailVerified?: boolean | undefined;
    updatedAt?: string | undefined;
}>;
type User = z.infer<typeof UserSchema>;
declare const OrgSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    plan: z.ZodString;
    entitlementsJson: z.ZodObject<{
        projectQuota: z.ZodNumber;
        crawlPages: z.ZodNumber;
        dailyArticles: z.ZodNumber;
        autoPublishPolicy: z.ZodEnum<["buffered", "immediate", "manual"]>;
        bufferDays: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    }, {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays?: number | undefined;
    }>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    plan: string;
    id: string;
    name: string;
    createdAt: string;
    entitlementsJson: {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    };
}, {
    plan: string;
    id: string;
    name: string;
    createdAt: string;
    entitlementsJson: {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays?: number | undefined;
    };
}>;
type Org = z.infer<typeof OrgSchema>;
declare const OrgMemberSchema: z.ZodObject<{
    orgId: z.ZodString;
    userId: z.ZodString;
    role: z.ZodEnum<["owner", "admin", "member"]>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    userId: string;
    role: "owner" | "admin" | "member";
}, {
    orgId: string;
    userId: string;
    role: "owner" | "admin" | "member";
}>;
type OrgMember = z.infer<typeof OrgMemberSchema>;
declare const BrandingSchema: z.ZodObject<{
    tone: z.ZodOptional<z.ZodString>;
    voice: z.ZodOptional<z.ZodString>;
    palette: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    brandPillars: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    tone?: string | undefined;
    voice?: string | undefined;
    palette?: string[] | undefined;
    brandPillars?: string[] | undefined;
}, {
    tone?: string | undefined;
    voice?: string | undefined;
    palette?: string[] | undefined;
    brandPillars?: string[] | undefined;
}>;
declare const ProjectSchema: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    name: z.ZodString;
    siteUrl: z.ZodString;
    defaultLocale: z.ZodString;
    brandingJson: z.ZodOptional<z.ZodObject<{
        tone: z.ZodOptional<z.ZodString>;
        voice: z.ZodOptional<z.ZodString>;
        palette: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        brandPillars: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    }, {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    }>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    orgId: string;
    siteUrl: string;
    defaultLocale: string;
    brandingJson?: {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    } | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    orgId: string;
    siteUrl: string;
    defaultLocale: string;
    brandingJson?: {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    } | undefined;
}>;
type Project = z.infer<typeof ProjectSchema>;
declare const CreateProjectResponseSchema: z.ZodObject<{
    project: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodString;
        orgId: z.ZodString;
        siteUrl: z.ZodString;
        defaultLocale: z.ZodString;
        brandingJson: z.ZodOptional<z.ZodObject<{
            tone: z.ZodOptional<z.ZodString>;
            voice: z.ZodOptional<z.ZodString>;
            palette: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            brandPillars: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        }, {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    }, {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    }>;
    crawlJobId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    project: {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    };
    crawlJobId?: string | undefined;
}, {
    project: {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    };
    crawlJobId?: string | undefined;
}>;
type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;
declare const IntegrationSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    type: z.ZodEnum<["webhook", "webflow", "wordpress", "framer", "shopify", "wix"]>;
    configJson: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    status: z.ZodEnum<["connected", "error", "paused"]>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
    status: "connected" | "error" | "paused";
    id: string;
    projectId: string;
    configJson: Record<string, unknown>;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}, {
    type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
    status: "connected" | "error" | "paused";
    id: string;
    projectId: string;
    configJson: Record<string, unknown>;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}>;
type Integration = z.infer<typeof IntegrationSchema>;
declare const WebhookIntegrationConfigSchema: z.ZodObject<{
    targetUrl: z.ZodString;
    secret: z.ZodString;
}, "strip", z.ZodTypeAny, {
    targetUrl: string;
    secret: string;
}, {
    targetUrl: string;
    secret: string;
}>;
type WebhookIntegrationConfig = z.infer<typeof WebhookIntegrationConfigSchema>;
declare const WebflowFieldMappingSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    slug: z.ZodDefault<z.ZodString>;
    body: z.ZodString;
    excerpt: z.ZodOptional<z.ZodString>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodString>;
    mainImage: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    body: string;
    excerpt?: string | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    tags?: string | undefined;
    mainImage?: string | undefined;
}, {
    name: string;
    slug: string;
    body: string;
    excerpt?: string | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    tags?: string | undefined;
    mainImage?: string | undefined;
}>;
type WebflowFieldMapping = z.infer<typeof WebflowFieldMappingSchema>;
declare const WebflowIntegrationConfigSchema: z.ZodObject<{
    accessToken: z.ZodString;
    siteId: z.ZodOptional<z.ZodString>;
    collectionId: z.ZodString;
    fieldMapping: z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        slug: z.ZodDefault<z.ZodString>;
        body: z.ZodString;
        excerpt: z.ZodOptional<z.ZodString>;
        seoTitle: z.ZodOptional<z.ZodString>;
        seoDescription: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodString>;
        mainImage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        slug: string;
        body: string;
        excerpt?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        tags?: string | undefined;
        mainImage?: string | undefined;
    }, {
        name: string;
        slug: string;
        body: string;
        excerpt?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        tags?: string | undefined;
        mainImage?: string | undefined;
    }>;
    publishMode: z.ZodDefault<z.ZodEnum<["draft", "live"]>>;
    cmsLocaleId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    collectionId: string;
    fieldMapping: {
        name: string;
        slug: string;
        body: string;
        excerpt?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        tags?: string | undefined;
        mainImage?: string | undefined;
    };
    publishMode: "draft" | "live";
    siteId?: string | undefined;
    cmsLocaleId?: string | undefined;
}, {
    accessToken: string;
    collectionId: string;
    fieldMapping: {
        name: string;
        slug: string;
        body: string;
        excerpt?: string | undefined;
        seoTitle?: string | undefined;
        seoDescription?: string | undefined;
        tags?: string | undefined;
        mainImage?: string | undefined;
    };
    publishMode: "draft" | "live";
    siteId?: string | undefined;
    cmsLocaleId?: string | undefined;
}>;
type WebflowIntegrationConfig = z.infer<typeof WebflowIntegrationConfigSchema>;
declare const CrawlPageSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    url: z.ZodString;
    httpStatus: z.ZodNumber;
    contentHash: z.ZodString;
    extractedAt: z.ZodString;
    metaJson: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title?: string | undefined;
        description?: string | undefined;
    }, {
        title?: string | undefined;
        description?: string | undefined;
    }>;
    headingsJson: z.ZodArray<z.ZodObject<{
        tag: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        tag: string;
    }, {
        content: string;
        tag: string;
    }>, "many">;
    linksJson: z.ZodArray<z.ZodObject<{
        href: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        href: string;
        text?: string | undefined;
    }, {
        href: string;
        text?: string | undefined;
    }>, "many">;
    contentBlobUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
type CrawlPage = z.infer<typeof CrawlPageSchema>;
declare const DiscoverySummarySchema: z.ZodObject<{
    businessSummary: z.ZodString;
    audience: z.ZodArray<z.ZodString, "many">;
    products: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    topicClusters: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    businessSummary: string;
    audience: string[];
    topicClusters: string[];
    products?: string[] | undefined;
}, {
    businessSummary: string;
    audience: string[];
    topicClusters: string[];
    products?: string[] | undefined;
}>;
declare const DiscoveryRunSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    providersUsed: z.ZodArray<z.ZodEnum<["crawl", "llm", "dataforseo"]>, "many">;
    startedAt: z.ZodString;
    finishedAt: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["queued", "running", "succeeded", "failed", "canceled"]>;
    costMeterJson: z.ZodOptional<z.ZodObject<{
        creditsConsumed: z.ZodNumber;
        currency: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        creditsConsumed: number;
        currency: string;
    }, {
        creditsConsumed: number;
        currency?: string | undefined;
    }>>;
    summaryJson: z.ZodObject<{
        businessSummary: z.ZodString;
        audience: z.ZodArray<z.ZodString, "many">;
        products: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        topicClusters: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        businessSummary: string;
        audience: string[];
        topicClusters: string[];
        products?: string[] | undefined;
    }, {
        businessSummary: string;
        audience: string[];
        topicClusters: string[];
        products?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "queued" | "running" | "succeeded" | "canceled";
    id: string;
    projectId: string;
    providersUsed: ("crawl" | "llm" | "dataforseo")[];
    startedAt: string;
    finishedAt: string | null;
    summaryJson: {
        businessSummary: string;
        audience: string[];
        topicClusters: string[];
        products?: string[] | undefined;
    };
    costMeterJson?: {
        creditsConsumed: number;
        currency: string;
    } | undefined;
}, {
    status: "failed" | "queued" | "running" | "succeeded" | "canceled";
    id: string;
    projectId: string;
    providersUsed: ("crawl" | "llm" | "dataforseo")[];
    startedAt: string;
    finishedAt: string | null;
    summaryJson: {
        businessSummary: string;
        audience: string[];
        topicClusters: string[];
        products?: string[] | undefined;
    };
    costMeterJson?: {
        creditsConsumed: number;
        currency?: string | undefined;
    } | undefined;
}>;
type DiscoveryRun = z.infer<typeof DiscoveryRunSchema>;
declare const KeywordMetricsSchema: z.ZodObject<{
    searchVolume: z.ZodNullable<z.ZodNumber>;
    cpc: z.ZodNullable<z.ZodNumber>;
    competition: z.ZodNullable<z.ZodNumber>;
    difficulty: z.ZodNullable<z.ZodNumber>;
    sourceProvider: z.ZodOptional<z.ZodEnum<["dataforseo"]>>;
    asOf: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    searchVolume: number | null;
    cpc: number | null;
    competition: number | null;
    difficulty: number | null;
    sourceProvider?: "dataforseo" | undefined;
    asOf?: string | undefined;
}, {
    searchVolume: number | null;
    cpc: number | null;
    competition: number | null;
    difficulty: number | null;
    sourceProvider?: "dataforseo" | undefined;
    asOf?: string | undefined;
}>;
declare const KeywordSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    phrase: z.ZodString;
    locale: z.ZodString;
    primaryTopic: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<["crawl", "llm", "manual"]>;
    metricsJson: z.ZodOptional<z.ZodObject<{
        searchVolume: z.ZodNullable<z.ZodNumber>;
        cpc: z.ZodNullable<z.ZodNumber>;
        competition: z.ZodNullable<z.ZodNumber>;
        difficulty: z.ZodNullable<z.ZodNumber>;
        sourceProvider: z.ZodOptional<z.ZodEnum<["dataforseo"]>>;
        asOf: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        searchVolume: number | null;
        cpc: number | null;
        competition: number | null;
        difficulty: number | null;
        sourceProvider?: "dataforseo" | undefined;
        asOf?: string | undefined;
    }, {
        searchVolume: number | null;
        cpc: number | null;
        competition: number | null;
        difficulty: number | null;
        sourceProvider?: "dataforseo" | undefined;
        asOf?: string | undefined;
    }>>;
    status: z.ZodEnum<["recommended", "planned", "generated"]>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
type Keyword = z.infer<typeof KeywordSchema>;
declare const PlanItemSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    keywordId: z.ZodString;
    plannedDate: z.ZodString;
    title: z.ZodString;
    outlineJson: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        subpoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        subpoints: string[];
    }, {
        heading: string;
        subpoints?: string[] | undefined;
    }>, "many">;
    status: z.ZodEnum<["planned", "skipped", "consumed"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "planned" | "skipped" | "consumed";
    title: string;
    id: string;
    createdAt: string;
    projectId: string;
    updatedAt: string;
    keywordId: string;
    plannedDate: string;
    outlineJson: {
        heading: string;
        subpoints: string[];
    }[];
}, {
    status: "planned" | "skipped" | "consumed";
    title: string;
    id: string;
    createdAt: string;
    projectId: string;
    updatedAt: string;
    keywordId: string;
    plannedDate: string;
    outlineJson: {
        heading: string;
        subpoints?: string[] | undefined;
    }[];
}>;
type PlanItem = z.infer<typeof PlanItemSchema>;
declare const ArticleSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    keywordId: z.ZodString;
    planItemId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    outlineJson: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        subpoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        subpoints: string[];
    }, {
        heading: string;
        subpoints?: string[] | undefined;
    }>, "many">>;
    bodyHtml: z.ZodString;
    language: z.ZodString;
    tone: z.ZodOptional<z.ZodString>;
    mediaJson: z.ZodOptional<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["image", "video", "embed"]>;
        src: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "image" | "embed" | "video";
        src: string;
        alt?: string | undefined;
    }, {
        kind: "image" | "embed" | "video";
        src: string;
        alt?: string | undefined;
    }>, "many">>;
    seoScore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodEnum<["draft", "published", "failed"]>;
    cmsExternalId: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    generationDate: z.ZodOptional<z.ZodString>;
    publicationDate: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "published" | "failed";
    title: string;
    id: string;
    createdAt: string;
    projectId: string;
    updatedAt: string;
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
}, {
    status: "draft" | "published" | "failed";
    title: string;
    id: string;
    createdAt: string;
    projectId: string;
    updatedAt: string;
    keywordId: string;
    bodyHtml: string;
    language: string;
    url?: string | undefined;
    tone?: string | undefined;
    outlineJson?: {
        heading: string;
        subpoints?: string[] | undefined;
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
}>;
type Article = z.infer<typeof ArticleSchema>;
declare const JobLogSchema: z.ZodObject<{
    message: z.ZodString;
    level: z.ZodDefault<z.ZodEnum<["info", "warn", "error"]>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    level: "error" | "info" | "warn";
    timestamp: string;
}, {
    message: string;
    timestamp: string;
    level?: "error" | "info" | "warn" | undefined;
}>;
declare const JobSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    type: z.ZodEnum<["crawl", "discovery", "plan", "generate", "publish", "linking", "reoptimize"]>;
    payloadJson: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    status: z.ZodEnum<["queued", "running", "succeeded", "failed", "canceled"]>;
    progressPct: z.ZodOptional<z.ZodNumber>;
    retries: z.ZodDefault<z.ZodNumber>;
    startedAt: z.ZodNullable<z.ZodString>;
    finishedAt: z.ZodNullable<z.ZodString>;
    logs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        message: z.ZodString;
        level: z.ZodDefault<z.ZodEnum<["info", "warn", "error"]>>;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        level: "error" | "info" | "warn";
        timestamp: string;
    }, {
        message: string;
        timestamp: string;
        level?: "error" | "info" | "warn" | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
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
}, {
    type: "crawl" | "discovery" | "plan" | "generate" | "publish" | "linking" | "reoptimize";
    status: "failed" | "queued" | "running" | "succeeded" | "canceled";
    id: string;
    projectId: string;
    startedAt: string | null;
    finishedAt: string | null;
    payloadJson: Record<string, unknown>;
    progressPct?: number | undefined;
    retries?: number | undefined;
    logs?: {
        message: string;
        timestamp: string;
        level?: "error" | "info" | "warn" | undefined;
    }[] | undefined;
}>;
type Job = z.infer<typeof JobSchema>;
declare const MetricCacheSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    provider: z.ZodEnum<["dataforseo"]>;
    hash: z.ZodString;
    metricsJson: z.ZodObject<{
        searchVolume: z.ZodNullable<z.ZodNumber>;
        cpc: z.ZodNullable<z.ZodNumber>;
        competition: z.ZodNullable<z.ZodNumber>;
        difficulty: z.ZodNullable<z.ZodNumber>;
        sourceProvider: z.ZodOptional<z.ZodEnum<["dataforseo"]>>;
        asOf: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        searchVolume: number | null;
        cpc: number | null;
        competition: number | null;
        difficulty: number | null;
        sourceProvider?: "dataforseo" | undefined;
        asOf?: string | undefined;
    }, {
        searchVolume: number | null;
        cpc: number | null;
        competition: number | null;
        difficulty: number | null;
        sourceProvider?: "dataforseo" | undefined;
        asOf?: string | undefined;
    }>;
    fetchedAt: z.ZodString;
    ttl: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    provider: "dataforseo";
    id: string;
    projectId: string;
    metricsJson: {
        searchVolume: number | null;
        cpc: number | null;
        competition: number | null;
        difficulty: number | null;
        sourceProvider?: "dataforseo" | undefined;
        asOf?: string | undefined;
    };
    hash: string;
    fetchedAt: string;
    ttl: number;
}, {
    provider: "dataforseo";
    id: string;
    projectId: string;
    metricsJson: {
        searchVolume: number | null;
        cpc: number | null;
        competition: number | null;
        difficulty: number | null;
        sourceProvider?: "dataforseo" | undefined;
        asOf?: string | undefined;
    };
    hash: string;
    fetchedAt: string;
    ttl: number;
}>;
type MetricCache = z.infer<typeof MetricCacheSchema>;
declare const PortableArticleSchema: z.ZodObject<{
    title: z.ZodString;
    bodyHtml: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    seo: z.ZodOptional<z.ZodObject<{
        metaTitle: z.ZodOptional<z.ZodString>;
        metaDescription: z.ZodOptional<z.ZodString>;
        canonicalUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        canonicalUrl?: string | undefined;
        metaTitle?: string | undefined;
        metaDescription?: string | undefined;
    }, {
        canonicalUrl?: string | undefined;
        metaTitle?: string | undefined;
        metaDescription?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    bodyHtml: string;
    tags?: string[] | undefined;
    summary?: string | undefined;
    seo?: {
        canonicalUrl?: string | undefined;
        metaTitle?: string | undefined;
        metaDescription?: string | undefined;
    } | undefined;
}, {
    title: string;
    bodyHtml: string;
    tags?: string[] | undefined;
    summary?: string | undefined;
    seo?: {
        canonicalUrl?: string | undefined;
        metaTitle?: string | undefined;
        metaDescription?: string | undefined;
    } | undefined;
}>;
type PortableArticle = z.infer<typeof PortableArticleSchema>;
declare const QueueJobDefinitionSchema: z.ZodObject<{
    type: z.ZodEnum<["crawl", "discovery", "plan", "generate", "publish", "linking", "reoptimize"]>;
    payload: z.ZodAny;
    priority: z.ZodDefault<z.ZodNumber>;
    runAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "crawl" | "discovery" | "plan" | "generate" | "publish" | "linking" | "reoptimize";
    priority: number;
    payload?: any;
    runAt?: string | undefined;
}, {
    type: "crawl" | "discovery" | "plan" | "generate" | "publish" | "linking" | "reoptimize";
    payload?: any;
    priority?: number | undefined;
    runAt?: string | undefined;
}>;
type QueueJobDefinition = z.infer<typeof QueueJobDefinitionSchema>;
declare const ScheduleRunResultSchema: z.ZodObject<{
    generatedDrafts: z.ZodNumber;
    enqueuedJobs: z.ZodNumber;
    publishedArticles: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    generatedDrafts: number;
    enqueuedJobs: number;
    publishedArticles: number;
}, {
    generatedDrafts: number;
    enqueuedJobs: number;
    publishedArticles: number;
}>;
type ScheduleRunResult = z.infer<typeof ScheduleRunResultSchema>;
declare const ProjectScopedJobSchema: z.ZodObject<{
    type: z.ZodEnum<["crawl", "discovery", "plan", "generate", "publish", "linking", "reoptimize"]>;
    payload: z.ZodAny;
    priority: z.ZodDefault<z.ZodNumber>;
    runAt: z.ZodOptional<z.ZodString>;
} & {
    projectId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "crawl" | "discovery" | "plan" | "generate" | "publish" | "linking" | "reoptimize";
    projectId: string;
    priority: number;
    payload?: any;
    runAt?: string | undefined;
}, {
    type: "crawl" | "discovery" | "plan" | "generate" | "publish" | "linking" | "reoptimize";
    projectId: string;
    payload?: any;
    priority?: number | undefined;
    runAt?: string | undefined;
}>;
type ProjectScopedJob = z.infer<typeof ProjectScopedJobSchema>;
declare const PaginationSchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
type Pagination = z.infer<typeof PaginationSchema>;
declare const ProjectSnapshotSchema: z.ZodObject<{
    project: z.ZodObject<{
        id: z.ZodString;
        orgId: z.ZodString;
        name: z.ZodString;
        siteUrl: z.ZodString;
        defaultLocale: z.ZodString;
        brandingJson: z.ZodOptional<z.ZodObject<{
            tone: z.ZodOptional<z.ZodString>;
            voice: z.ZodOptional<z.ZodString>;
            palette: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            brandPillars: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        }, {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        }>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    }, {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    }>;
    integrations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        type: z.ZodEnum<["webhook", "webflow", "wordpress", "framer", "shopify", "wix"]>;
        configJson: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        status: z.ZodEnum<["connected", "error", "paused"]>;
        createdAt: z.ZodOptional<z.ZodString>;
        updatedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
        status: "connected" | "error" | "paused";
        id: string;
        projectId: string;
        configJson: Record<string, unknown>;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }, {
        type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
        status: "connected" | "error" | "paused";
        id: string;
        projectId: string;
        configJson: Record<string, unknown>;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }>, "many">;
    latestDiscovery: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        providersUsed: z.ZodArray<z.ZodEnum<["crawl", "llm", "dataforseo"]>, "many">;
        startedAt: z.ZodString;
        finishedAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["queued", "running", "succeeded", "failed", "canceled"]>;
        costMeterJson: z.ZodOptional<z.ZodObject<{
            creditsConsumed: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            creditsConsumed: number;
            currency: string;
        }, {
            creditsConsumed: number;
            currency?: string | undefined;
        }>>;
        summaryJson: z.ZodObject<{
            businessSummary: z.ZodString;
            audience: z.ZodArray<z.ZodString, "many">;
            products: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            topicClusters: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            businessSummary: string;
            audience: string[];
            topicClusters: string[];
            products?: string[] | undefined;
        }, {
            businessSummary: string;
            audience: string[];
            topicClusters: string[];
            products?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "failed" | "queued" | "running" | "succeeded" | "canceled";
        id: string;
        projectId: string;
        providersUsed: ("crawl" | "llm" | "dataforseo")[];
        startedAt: string;
        finishedAt: string | null;
        summaryJson: {
            businessSummary: string;
            audience: string[];
            topicClusters: string[];
            products?: string[] | undefined;
        };
        costMeterJson?: {
            creditsConsumed: number;
            currency: string;
        } | undefined;
    }, {
        status: "failed" | "queued" | "running" | "succeeded" | "canceled";
        id: string;
        projectId: string;
        providersUsed: ("crawl" | "llm" | "dataforseo")[];
        startedAt: string;
        finishedAt: string | null;
        summaryJson: {
            businessSummary: string;
            audience: string[];
            topicClusters: string[];
            products?: string[] | undefined;
        };
        costMeterJson?: {
            creditsConsumed: number;
            currency?: string | undefined;
        } | undefined;
    }>>;
    planItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        keywordId: z.ZodString;
        plannedDate: z.ZodString;
        title: z.ZodString;
        outlineJson: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            subpoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            heading: string;
            subpoints: string[];
        }, {
            heading: string;
            subpoints?: string[] | undefined;
        }>, "many">;
        status: z.ZodEnum<["planned", "skipped", "consumed"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "planned" | "skipped" | "consumed";
        title: string;
        id: string;
        createdAt: string;
        projectId: string;
        updatedAt: string;
        keywordId: string;
        plannedDate: string;
        outlineJson: {
            heading: string;
            subpoints: string[];
        }[];
    }, {
        status: "planned" | "skipped" | "consumed";
        title: string;
        id: string;
        createdAt: string;
        projectId: string;
        updatedAt: string;
        keywordId: string;
        plannedDate: string;
        outlineJson: {
            heading: string;
            subpoints?: string[] | undefined;
        }[];
    }>, "many">;
    queueDepth: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    project: {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    };
    integrations: {
        type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
        status: "connected" | "error" | "paused";
        id: string;
        projectId: string;
        configJson: Record<string, unknown>;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }[];
    planItems: {
        status: "planned" | "skipped" | "consumed";
        title: string;
        id: string;
        createdAt: string;
        projectId: string;
        updatedAt: string;
        keywordId: string;
        plannedDate: string;
        outlineJson: {
            heading: string;
            subpoints: string[];
        }[];
    }[];
    queueDepth: number;
    latestDiscovery?: {
        status: "failed" | "queued" | "running" | "succeeded" | "canceled";
        id: string;
        projectId: string;
        providersUsed: ("crawl" | "llm" | "dataforseo")[];
        startedAt: string;
        finishedAt: string | null;
        summaryJson: {
            businessSummary: string;
            audience: string[];
            topicClusters: string[];
            products?: string[] | undefined;
        };
        costMeterJson?: {
            creditsConsumed: number;
            currency: string;
        } | undefined;
    } | undefined;
}, {
    project: {
        id: string;
        name: string;
        createdAt: string;
        orgId: string;
        siteUrl: string;
        defaultLocale: string;
        brandingJson?: {
            tone?: string | undefined;
            voice?: string | undefined;
            palette?: string[] | undefined;
            brandPillars?: string[] | undefined;
        } | undefined;
    };
    integrations: {
        type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
        status: "connected" | "error" | "paused";
        id: string;
        projectId: string;
        configJson: Record<string, unknown>;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
    }[];
    planItems: {
        status: "planned" | "skipped" | "consumed";
        title: string;
        id: string;
        createdAt: string;
        projectId: string;
        updatedAt: string;
        keywordId: string;
        plannedDate: string;
        outlineJson: {
            heading: string;
            subpoints?: string[] | undefined;
        }[];
    }[];
    queueDepth: number;
    latestDiscovery?: {
        status: "failed" | "queued" | "running" | "succeeded" | "canceled";
        id: string;
        projectId: string;
        providersUsed: ("crawl" | "llm" | "dataforseo")[];
        startedAt: string;
        finishedAt: string | null;
        summaryJson: {
            businessSummary: string;
            audience: string[];
            topicClusters: string[];
            products?: string[] | undefined;
        };
        costMeterJson?: {
            creditsConsumed: number;
            currency?: string | undefined;
        } | undefined;
    } | undefined;
}>;
type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>;
declare const CrawlBudgetSchema: z.ZodObject<{
    maxPages: z.ZodNumber;
    respectRobots: z.ZodDefault<z.ZodBoolean>;
    includeSitemaps: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxPages: number;
    respectRobots: boolean;
    includeSitemaps: boolean;
}, {
    maxPages: number;
    respectRobots?: boolean | undefined;
    includeSitemaps?: boolean | undefined;
}>;
declare const CrawlJobPayloadSchema: z.ZodObject<{
    projectId: z.ZodString;
    siteUrl: z.ZodString;
    crawlBudget: z.ZodObject<{
        maxPages: z.ZodNumber;
        respectRobots: z.ZodDefault<z.ZodBoolean>;
        includeSitemaps: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maxPages: number;
        respectRobots: boolean;
        includeSitemaps: boolean;
    }, {
        maxPages: number;
        respectRobots?: boolean | undefined;
        includeSitemaps?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    siteUrl: string;
    projectId: string;
    crawlBudget: {
        maxPages: number;
        respectRobots: boolean;
        includeSitemaps: boolean;
    };
}, {
    siteUrl: string;
    projectId: string;
    crawlBudget: {
        maxPages: number;
        respectRobots?: boolean | undefined;
        includeSitemaps?: boolean | undefined;
    };
}>;
declare const DiscoveryJobPayloadSchema: z.ZodObject<{
    projectId: z.ZodString;
    pageIds: z.ZodArray<z.ZodString, "many">;
    locale: z.ZodString;
}, "strip", z.ZodTypeAny, {
    locale: string;
    projectId: string;
    pageIds: string[];
}, {
    locale: string;
    projectId: string;
    pageIds: string[];
}>;
declare const PlanJobPayloadSchema: z.ZodObject<{
    projectId: z.ZodString;
    keywords: z.ZodArray<z.ZodString, "many">;
    locale: z.ZodString;
}, "strip", z.ZodTypeAny, {
    locale: string;
    projectId: string;
    keywords: string[];
}, {
    locale: string;
    projectId: string;
    keywords: string[];
}>;
declare const GenerateJobPayloadSchema: z.ZodObject<{
    projectId: z.ZodString;
    planItemId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    planItemId: string;
}, {
    projectId: string;
    planItemId: string;
}>;
declare const PublishJobPayloadSchema: z.ZodObject<{
    projectId: z.ZodString;
    articleId: z.ZodString;
    integrationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    articleId: string;
    integrationId: string;
}, {
    projectId: string;
    articleId: string;
    integrationId: string;
}>;
declare const QueuePayloadSchemas: {
    crawl: z.ZodObject<{
        projectId: z.ZodString;
        siteUrl: z.ZodString;
        crawlBudget: z.ZodObject<{
            maxPages: z.ZodNumber;
            respectRobots: z.ZodDefault<z.ZodBoolean>;
            includeSitemaps: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            maxPages: number;
            respectRobots: boolean;
            includeSitemaps: boolean;
        }, {
            maxPages: number;
            respectRobots?: boolean | undefined;
            includeSitemaps?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        siteUrl: string;
        projectId: string;
        crawlBudget: {
            maxPages: number;
            respectRobots: boolean;
            includeSitemaps: boolean;
        };
    }, {
        siteUrl: string;
        projectId: string;
        crawlBudget: {
            maxPages: number;
            respectRobots?: boolean | undefined;
            includeSitemaps?: boolean | undefined;
        };
    }>;
    discovery: z.ZodObject<{
        projectId: z.ZodString;
        pageIds: z.ZodArray<z.ZodString, "many">;
        locale: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        locale: string;
        projectId: string;
        pageIds: string[];
    }, {
        locale: string;
        projectId: string;
        pageIds: string[];
    }>;
    plan: z.ZodObject<{
        projectId: z.ZodString;
        keywords: z.ZodArray<z.ZodString, "many">;
        locale: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        locale: string;
        projectId: string;
        keywords: string[];
    }, {
        locale: string;
        projectId: string;
        keywords: string[];
    }>;
    generate: z.ZodObject<{
        projectId: z.ZodString;
        planItemId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        projectId: string;
        planItemId: string;
    }, {
        projectId: string;
        planItemId: string;
    }>;
    publish: z.ZodObject<{
        projectId: z.ZodString;
        articleId: z.ZodString;
        integrationId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        projectId: string;
        articleId: string;
        integrationId: string;
    }, {
        projectId: string;
        articleId: string;
        integrationId: string;
    }>;
    linking: z.ZodObject<{
        projectId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        projectId: string;
    }, {
        projectId: string;
    }>;
    reoptimize: z.ZodObject<{
        projectId: z.ZodString;
        articleId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        projectId: string;
        articleId: string;
    }, {
        projectId: string;
        articleId: string;
    }>;
};
type QueuePayloadSchemasMap = typeof QueuePayloadSchemas;
type QueuePayloadFor<T extends JobType> = z.infer<(typeof QueuePayloadSchemas)[T]>;
type AnyQueuePayload = {
    [K in JobType]: {
        type: K;
        payload: QueuePayloadFor<K>;
    };
}[JobType];
declare const DEFAULT_BUFFER_DAYS = 3;
declare const DEFAULT_DAILY_ARTICLES = 1;
declare const DEFAULT_CRAWL_BUDGET = 200;
declare const AppFeatureFlagSchema: z.ZodEnum<["seo-provider-metrics", "seo-autopublish-policy", "seo-buffer-days", "seo-crawl-budget", "seo-playwright-headless", "seo-publication-allowed"]>;
type AppFeatureFlag = z.infer<typeof AppFeatureFlagSchema>;
declare const FeatureConfigSchema: z.ZodObject<{
    metricsProvider: z.ZodDefault<z.ZodEnum<["dataforseo"]>>;
    autoPublishPolicy: z.ZodDefault<z.ZodEnum<["buffered", "immediate", "manual"]>>;
    bufferDays: z.ZodDefault<z.ZodNumber>;
    crawlBudget: z.ZodDefault<z.ZodNumber>;
    playwrightHeadless: z.ZodDefault<z.ZodBoolean>;
    publicationAllowed: z.ZodDefault<z.ZodArray<z.ZodEnum<["webhook", "webflow", "wordpress", "framer", "shopify", "wix"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    autoPublishPolicy: "manual" | "buffered" | "immediate";
    bufferDays: number;
    crawlBudget: number;
    metricsProvider: "dataforseo";
    playwrightHeadless: boolean;
    publicationAllowed: ("webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix")[];
}, {
    autoPublishPolicy?: "manual" | "buffered" | "immediate" | undefined;
    bufferDays?: number | undefined;
    crawlBudget?: number | undefined;
    metricsProvider?: "dataforseo" | undefined;
    playwrightHeadless?: boolean | undefined;
    publicationAllowed?: ("webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix")[] | undefined;
}>;
type FeatureConfig = z.infer<typeof FeatureConfigSchema>;
declare const SchedulePolicySchema: z.ZodObject<{
    policy: z.ZodEnum<["buffered", "immediate", "manual"]>;
    bufferDays: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    bufferDays: number;
    policy: "manual" | "buffered" | "immediate";
}, {
    bufferDays: number;
    policy: "manual" | "buffered" | "immediate";
}>;
type SchedulePolicy = z.infer<typeof SchedulePolicySchema>;
declare const CreateOrgInputSchema: z.ZodObject<{
    name: z.ZodString;
    plan: z.ZodString;
    entitlements: z.ZodObject<{
        projectQuota: z.ZodNumber;
        crawlPages: z.ZodNumber;
        dailyArticles: z.ZodNumber;
        autoPublishPolicy: z.ZodEnum<["buffered", "immediate", "manual"]>;
        bufferDays: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    }, {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    plan: string;
    name: string;
    entitlements: {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    };
}, {
    plan: string;
    name: string;
    entitlements: {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays?: number | undefined;
    };
}>;
declare const CreateProjectInputSchema: z.ZodObject<{
    orgId: z.ZodString;
    name: z.ZodString;
    siteUrl: z.ZodString;
    defaultLocale: z.ZodString;
    branding: z.ZodOptional<z.ZodObject<{
        tone: z.ZodOptional<z.ZodString>;
        voice: z.ZodOptional<z.ZodString>;
        palette: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        brandPillars: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    }, {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    orgId: string;
    siteUrl: string;
    defaultLocale: string;
    branding?: {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    } | undefined;
}, {
    name: string;
    orgId: string;
    siteUrl: string;
    defaultLocale: string;
    branding?: {
        tone?: string | undefined;
        voice?: string | undefined;
        palette?: string[] | undefined;
        brandPillars?: string[] | undefined;
    } | undefined;
}>;
declare const CreateIntegrationInputSchema: z.ZodObject<{
    projectId: z.ZodString;
    type: z.ZodEnum<["webhook", "webflow", "wordpress", "framer", "shopify", "wix"]>;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    status: z.ZodDefault<z.ZodEnum<["connected", "error", "paused"]>>;
}, "strip", z.ZodTypeAny, {
    type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
    status: "connected" | "error" | "paused";
    projectId: string;
    config: Record<string, unknown>;
}, {
    type: "webhook" | "webflow" | "wordpress" | "framer" | "shopify" | "wix";
    projectId: string;
    config: Record<string, unknown>;
    status?: "connected" | "error" | "paused" | undefined;
}>;
type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
type CreateIntegrationInput = z.infer<typeof CreateIntegrationInputSchema>;
type CreateOrgInput = z.infer<typeof CreateOrgInputSchema>;
declare const ScheduleRunRequestSchema: z.ZodObject<{
    projectId: z.ZodOptional<z.ZodString>;
    policyOverride: z.ZodOptional<z.ZodObject<{
        policy: z.ZodEnum<["buffered", "immediate", "manual"]>;
        bufferDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        bufferDays: number;
        policy: "manual" | "buffered" | "immediate";
    }, {
        bufferDays: number;
        policy: "manual" | "buffered" | "immediate";
    }>>;
}, "strip", z.ZodTypeAny, {
    projectId?: string | undefined;
    policyOverride?: {
        bufferDays: number;
        policy: "manual" | "buffered" | "immediate";
    } | undefined;
}, {
    projectId?: string | undefined;
    policyOverride?: {
        bufferDays: number;
        policy: "manual" | "buffered" | "immediate";
    } | undefined;
}>;
declare const ScheduleRunResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
    result: z.ZodObject<{
        generatedDrafts: z.ZodNumber;
        enqueuedJobs: z.ZodNumber;
        publishedArticles: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        generatedDrafts: number;
        enqueuedJobs: number;
        publishedArticles: number;
    }, {
        generatedDrafts: number;
        enqueuedJobs: number;
        publishedArticles: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "ok";
    result: {
        generatedDrafts: number;
        enqueuedJobs: number;
        publishedArticles: number;
    };
}, {
    status: "ok";
    result: {
        generatedDrafts: number;
        enqueuedJobs: number;
        publishedArticles: number;
    };
}>;
declare const MeResponseSchema: z.ZodObject<{
    user: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        name: z.ZodString;
        imageUrl: z.ZodOptional<z.ZodString>;
        emailVerified: z.ZodOptional<z.ZodBoolean>;
        createdAt: z.ZodString;
        updatedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        name: string;
        createdAt: string;
        imageUrl?: string | undefined;
        emailVerified?: boolean | undefined;
        updatedAt?: string | undefined;
    }, {
        id: string;
        email: string;
        name: string;
        createdAt: string;
        imageUrl?: string | undefined;
        emailVerified?: boolean | undefined;
        updatedAt?: string | undefined;
    }>>;
    orgs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        plan: z.ZodString;
        entitlementsJson: z.ZodObject<{
            projectQuota: z.ZodNumber;
            crawlPages: z.ZodNumber;
            dailyArticles: z.ZodNumber;
            autoPublishPolicy: z.ZodEnum<["buffered", "immediate", "manual"]>;
            bufferDays: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        }, {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays?: number | undefined;
        }>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        };
    }, {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays?: number | undefined;
        };
    }>, "many">>;
    activeOrg: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        plan: z.ZodString;
        entitlementsJson: z.ZodObject<{
            projectQuota: z.ZodNumber;
            crawlPages: z.ZodNumber;
            dailyArticles: z.ZodNumber;
            autoPublishPolicy: z.ZodEnum<["buffered", "immediate", "manual"]>;
            bufferDays: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        }, {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays?: number | undefined;
        }>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        };
    }, {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays?: number | undefined;
        };
    }>>;
    entitlements: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        projectQuota: z.ZodNumber;
        crawlPages: z.ZodNumber;
        dailyArticles: z.ZodNumber;
        autoPublishPolicy: z.ZodEnum<["buffered", "immediate", "manual"]>;
        bufferDays: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    }, {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays?: number | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        email: string;
        name: string;
        createdAt: string;
        imageUrl?: string | undefined;
        emailVerified?: boolean | undefined;
        updatedAt?: string | undefined;
    } | null;
    orgs: {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        };
    }[];
    activeOrg: {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        };
    } | null;
    entitlements?: {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    } | null | undefined;
}, {
    user: {
        id: string;
        email: string;
        name: string;
        createdAt: string;
        imageUrl?: string | undefined;
        emailVerified?: boolean | undefined;
        updatedAt?: string | undefined;
    } | null;
    orgs?: {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        };
    }[] | undefined;
    activeOrg: {
        plan: string;
        id: string;
        name: string;
        createdAt: string;
        entitlementsJson: {
            projectQuota: number;
            crawlPages: number;
            dailyArticles: number;
            autoPublishPolicy: "manual" | "buffered" | "immediate";
            bufferDays: number;
        };
    } | null;
    entitlements?: {
        projectQuota: number;
        crawlPages: number;
        dailyArticles: number;
        autoPublishPolicy: "manual" | "buffered" | "immediate";
        bufferDays: number;
    } | null | undefined;
}>;
type MeResponse = z.infer<typeof MeResponseSchema>;
declare const HealthResponseSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    service: z.ZodString;
    version: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ok: true;
    service: string;
    version: string;
    timestamp: string;
}, {
    ok: true;
    service: string;
    version: string;
    timestamp: string;
}>;
type HealthResponse = z.infer<typeof HealthResponseSchema>;
declare const ApiErrorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    message: string;
    code?: string | undefined;
    details?: any;
}, {
    message: string;
    code?: string | undefined;
    details?: any;
}>;
type ApiError = z.infer<typeof ApiErrorSchema>;
declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(item: T) => z.ZodObject<{
    items: z.ZodArray<T, "many">;
    nextCursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: T["_output"][];
    nextCursor?: string | undefined;
}, {
    items: T["_input"][];
    nextCursor?: string | undefined;
}>;
type PaginatedResponse<T> = {
    items: T[];
    nextCursor?: string;
};

export { type AnyQueuePayload, type ApiError, ApiErrorSchema, type AppFeatureFlag, AppFeatureFlagSchema, type Article, ArticleSchema, type ArticleStatus, ArticleStatusSchema, type AutoPublishPolicy, AutoPublishPolicySchema, BrandingSchema, CrawlBudgetSchema, CrawlJobPayloadSchema, type CrawlPage, CrawlPageSchema, type CreateIntegrationInput, CreateIntegrationInputSchema, type CreateOrgInput, CreateOrgInputSchema, type CreateProjectInput, CreateProjectInputSchema, type CreateProjectResponse, CreateProjectResponseSchema, DEFAULT_BUFFER_DAYS, DEFAULT_CRAWL_BUDGET, DEFAULT_DAILY_ARTICLES, DiscoveryJobPayloadSchema, type DiscoveryRun, DiscoveryRunSchema, DiscoverySummarySchema, type Entitlement, EntitlementSchema, type FeatureConfig, FeatureConfigSchema, GenerateJobPayloadSchema, type HealthResponse, HealthResponseSchema, type Integration, IntegrationSchema, type IntegrationStatus, IntegrationStatusSchema, type IntegrationType, IntegrationTypeSchema, type Job, JobLogSchema, JobSchema, type JobStatus, JobStatusSchema, type JobType, JobTypeSchema, type Keyword, KeywordMetricsSchema, KeywordSchema, type KeywordSource, KeywordSourceSchema, type KeywordStatus, KeywordStatusSchema, type MeResponse, MeResponseSchema, type MetricCache, type MetricCacheProvider, MetricCacheProviderSchema, MetricCacheSchema, type MetricSource, MetricSourceSchema, type MetricsProvider, MetricsProviderSchema, type Org, type OrgMember, type OrgMemberRole, OrgMemberRoleSchema, OrgMemberSchema, OrgSchema, type PaginatedResponse, PaginatedResponseSchema, type Pagination, PaginationSchema, type PlanItem, PlanItemSchema, type PlanItemStatus, PlanItemStatusSchema, PlanJobPayloadSchema, type PortableArticle, PortableArticleSchema, type Project, ProjectSchema, type ProjectScopedJob, ProjectScopedJobSchema, type ProjectSnapshot, ProjectSnapshotSchema, type Provider, ProviderSchema, PublishJobPayloadSchema, type QueueJobDefinition, QueueJobDefinitionSchema, type QueuePayloadFor, QueuePayloadSchemas, type QueuePayloadSchemasMap, type SchedulePolicy, SchedulePolicySchema, ScheduleRunRequestSchema, ScheduleRunResponseSchema, type ScheduleRunResult, ScheduleRunResultSchema, type User, UserSchema, type WebflowFieldMapping, WebflowFieldMappingSchema, type WebflowIntegrationConfig, WebflowIntegrationConfigSchema, type WebhookIntegrationConfig, WebhookIntegrationConfigSchema };

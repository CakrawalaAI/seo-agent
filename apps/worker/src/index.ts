// @ts-nocheck
import { createHash, randomUUID } from 'node:crypto'
import { and, eq, gte, inArray } from 'drizzle-orm'
import {
  CrawlJobPayloadSchema,
  DiscoveryJobPayloadSchema,
  GenerateJobPayloadSchema,
  PlanJobPayloadSchema,
  PublishJobPayloadSchema,
  WebflowIntegrationConfigSchema,
  type JobType,
  type PortableArticle
} from '@seo-agent/domain'
import pRetry from 'p-retry'
import { getJobQueue, appConfig, getDb, schema } from '@seo-agent/platform'
import { deliverWebhookPublish, publishArticleToWebflow } from '@seo-agent/cms'
import {
  createLLMProvider,
  DataForSEOClient,
  getFeatureFlag,
  type LLMProvider,
  type DraftTitleOutlineResult
} from '@seo-agent/integrations'
import { crawlSite, hashContent as crawlerHashContent, encodeContent } from './crawler.js'

const POLL_INTERVAL_MS = appConfig.worker.pollIntervalMs
const MAX_ATTEMPTS = appConfig.worker.maxAttempts

const db = getDb()
const queue = getJobQueue()
const llmProvider: LLMProvider = createLLMProvider()
const metricsClient = new DataForSEOClient({
  login: process.env.DATAFORSEO_LOGIN,
  password: process.env.DATAFORSEO_PASSWORD
})

const METRIC_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7

const decodeContentBlob = (blobUrl: string | null | undefined): string => {
  if (!blobUrl) return ''
  if (!blobUrl.startsWith('data:')) return ''
  const commaIndex = blobUrl.indexOf(',')
  if (commaIndex === -1) return ''
  const encoded = blobUrl.slice(commaIndex + 1)
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  } catch (error) {
    return ''
  }
}

const computeMetricHash = (keyword: string, locale: string, location?: string | null) => {
  const normalized = `${keyword.toLowerCase()}|${locale.toLowerCase()}|${(location ?? '').toLowerCase()}`
  return createHash('sha256').update(normalized).digest('hex')
}

const computeOpportunityScore = (metrics: {
  searchVolume?: number | null
  difficulty?: number | null
  competition?: number | null
} | undefined): number | null => {
  if (!metrics) return null
  const volume = typeof metrics.searchVolume === 'number' ? metrics.searchVolume : null
  if (!volume || volume <= 0) return null
  const difficulty =
    typeof metrics.difficulty === 'number'
      ? metrics.difficulty
      : typeof metrics.competition === 'number'
        ? metrics.competition * 100
        : null
  const difficultyScore = typeof difficulty === 'number' ? difficulty : 50
  const raw = Math.max(0, Math.min(100, Math.log(volume + 1) * 15 - difficultyScore * 0.5 + 40))
  return Number(raw.toFixed(2))
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

const jobHandlers: Record<JobType, (job: JobRecord) => Promise<void>> = {
  crawl: handleCrawlJob,
  discovery: handleDiscoveryJob,
  plan: handlePlanJob,
  generate: handleGenerateJob,
  publish: handlePublishJob,
  linking: async (job) => {
    await log(job, 'Linking placeholder execution')
  },
  reoptimize: async (job) => {
    await log(job, 'Reoptimize placeholder execution')
  }
}

type JobRecord = typeof schema.jobs.$inferSelect

type ReservedJob = JobRecord & { payload: Record<string, unknown> }

type ArticleRecord = typeof schema.articles.$inferSelect
type IntegrationRecord = typeof schema.integrations.$inferSelect

let shutdown = false

process.on('SIGTERM', handleShutdown)
process.on('SIGINT', handleShutdown)

async function main() {
  console.log('[worker] SEO Agent worker booting')
  await queue.ready.catch((error) => {
    console.error('[worker] job queue connection failed', error)
  })

  while (!shutdown) {
    let reservation
    try {
      reservation = await queue.reserveNext()
    } catch (error) {
      console.error('[worker] failed to reserve job from queue', error)
      await sleep(POLL_INTERVAL_MS)
      continue
    }

    if (!reservation) {
      await sleep(POLL_INTERVAL_MS)
      continue
    }

    const { job, complete, fail } = reservation
    const jobRecord = await loadJobRecord(job.id)
    if (!jobRecord) {
      await fail(new Error(`Job ${job.id} missing from database`))
      console.warn(`[worker] job ${job.id} missing from database`)
      continue
    }

    const runningJob = await startJob(jobRecord)
    const reservedJob: ReservedJob = {
      ...runningJob,
      payload: job.payload as Record<string, unknown>
    }

    try {
      await processJob(reservedJob)
      await complete()
    } catch (error) {
      await fail(error)
    }
  }

  await db.$client.end?.()
  console.log('[worker] shutdown complete')
}

async function processJob(job: ReservedJob) {
  const handler = jobHandlers[job.type]
  if (!handler) {
    console.warn(`[worker] no handler for job ${job.id} (${job.type})`)
    await markJobFailed(job.id, 'No handler implemented')
    throw new Error(`No handler implemented for job type ${job.type}`)
  }

  try {
    await pRetry(() => handler(job), {
      retries: Math.max(0, MAX_ATTEMPTS - 1),
      onFailedAttempt: async (error) => {
        await appendLog(job.id, `Attempt ${error.attemptNumber} failed: ${error.message}`, 'warn')
      }
    })

    await markJobSucceeded(job.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await appendLog(job.id, message, 'error')
    await markJobFailed(job.id, message)
    throw error instanceof Error ? error : new Error(message)
  }
}

async function loadJobRecord(id: string): Promise<JobRecord | null> {
  const job = await db.query.jobs.findFirst({
    where: (jobs, { eq }) => eq(jobs.id, id)
  })
  return job ?? null
}

async function startJob(job: JobRecord): Promise<JobRecord> {
  const attempts = (job.retries ?? 0) + 1
  const timestamp = new Date()
  await db
    .update(schema.jobs)
    .set({
      status: 'running',
      startedAt: timestamp,
      updatedAt: timestamp,
      retries: attempts
    })
    .where(eq(schema.jobs.id, job.id))

  return {
    ...job,
    status: 'running',
    startedAt: timestamp,
    updatedAt: timestamp,
    retries: attempts
  }
}

async function markJobSucceeded(id: string) {
  await db
    .update(schema.jobs)
    .set({
      status: 'succeeded',
      finishedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(schema.jobs.id, id))
}

async function markJobFailed(id: string, message: string) {
  await db
    .update(schema.jobs)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      updatedAt: new Date(),
      logs: buildLogArray([{ message, level: 'error', timestamp: new Date().toISOString() }])
    })
    .where(eq(schema.jobs.id, id))
}

async function appendLog(id: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString()
  const [job] = await db
    .select({ logs: schema.jobs.logs })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id))

  const logs = buildLogArray([
    ...(Array.isArray((job?.logs as any) ?? []) ? (job?.logs as any) : []),
    { message, level, timestamp }
  ])

  await db
    .update(schema.jobs)
    .set({ logs })
    .where(eq(schema.jobs.id, id))
}

function buildLogArray(entries: Array<{ message: string; level: 'info' | 'warn' | 'error'; timestamp: string }>) {
  return entries as any
}

async function log(job: ReservedJob, message: string) {
  console.log(`[worker] ${job.type}#${job.id} - ${message}`)
  await appendLog(job.id, message, 'info')
}

const stripHtml = (html: string) =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildExcerpt = (html: string, length = 200) => {
  if (!html) return ''
  const text = stripHtml(html)
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}…`
}

const extractSlug = (url: string | null | undefined) => {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    return segments.pop() ?? undefined
  } catch (error) {
    return undefined
  }
}

const normalizeOutline = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((section: any) => {
      const heading = typeof section?.heading === 'string' ? section.heading : ''
      if (!heading) return null
      const subpoints = Array.isArray(section?.subpoints)
        ? section.subpoints.filter((point: unknown) => typeof point === 'string')
        : undefined
      const level = Number.isFinite(section?.level) ? Number(section.level) : undefined
      return {
        heading,
        level,
        subpoints
      }
    })
    .filter(Boolean)
}

const normalizeImages = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((image: any) => {
      const src = typeof image?.src === 'string' ? image.src : null
      if (!src) return null
      return {
        src,
        alt: typeof image?.alt === 'string' ? image.alt : undefined,
        caption: typeof image?.caption === 'string' ? image.caption : undefined
      }
    })
    .filter(Boolean)
}

const buildPortableArticle = (article: ArticleRecord): PortableArticle => {
  const outline = normalizeOutline(article.outline)
  const images = normalizeImages(article.media)
  const excerpt = buildExcerpt(article.bodyHtml ?? '')

  const portable: PortableArticle = {
    title: article.title,
    excerpt: excerpt || undefined,
    bodyHtml: article.bodyHtml ?? '',
    outline: outline.length > 0 ? outline : undefined,
    media: images.length > 0 ? { images } : undefined,
    locale: article.language ?? undefined,
    slug: extractSlug(article.url),
    seo: {
      metaTitle: article.title,
      metaDescription: excerpt || undefined,
      canonicalUrl: article.url ?? undefined
    }
  }

  return portable
}

const resolveWebhookConfig = (integration: IntegrationRecord) => {
  const config = (integration?.config as Record<string, unknown>) ?? {}
  const targetUrl = typeof config.targetUrl === 'string' ? config.targetUrl : null
  const secret = typeof config.secret === 'string' ? config.secret : null
  if (!targetUrl || !secret) {
    throw new Error(`Webhook integration ${integration.id} missing targetUrl or secret`)
  }
  return { targetUrl, secret }
}

const resolveWebflowConfig = (integration: IntegrationRecord) => {
  const config = (integration?.config as Record<string, unknown>) ?? {}
  return WebflowIntegrationConfigSchema.parse(config)
}

async function handleCrawlJob(job: JobRecord) {
  const payload = CrawlJobPayloadSchema.parse(job.payload)
  await appendLog(job.id, `Starting crawl for ${payload.siteUrl}`, 'info')
  const headless = await getFeatureFlag(db, 'seo-playwright-headless', true)

  const pages = await crawlSite(payload.siteUrl, payload.crawlBudget, headless)
  if (pages.length === 0) {
    await appendLog(job.id, 'No pages discovered during crawl', 'warn')
    await updateJobProgress(job.id, 100)
    return
  }

  let processed = 0
  for (const page of pages) {
    const timestamp = new Date()
    const contentHash = crawlerHashContent(page.html)
    const blobUrl = encodeContent(page.html)
    const meta = {
      title: page.title ?? undefined,
      description: page.description ?? undefined
    }

    const existing = await db.query.crawlPages.findFirst({
      where: (crawlPages, { and: andFn, eq: eqFn }) =>
        andFn(eqFn(crawlPages.projectId, payload.projectId), eqFn(crawlPages.url, page.url))
    })

    if (existing) {
      await db
        .update(schema.crawlPages)
        .set({
          httpStatus: page.status,
          contentHash,
          extractedAt: timestamp,
          meta,
          headings: page.headings,
          links: page.links,
          contentBlobUrl: blobUrl
        })
        .where(eq(schema.crawlPages.id, existing.id))
    } else {
      await db.insert(schema.crawlPages).values({
        id: randomUUID(),
        projectId: payload.projectId,
        url: page.url,
        httpStatus: page.status,
        contentHash,
        extractedAt: timestamp,
        meta,
        headings: page.headings,
        links: page.links,
        contentBlobUrl: blobUrl
      })
    }

    processed += 1
    await updateJobProgress(job.id, Math.round((processed / pages.length) * 100))
  }

  await appendLog(job.id, `Crawled and persisted ${pages.length} pages`, 'info')
  await updateJobProgress(job.id, 100)
}

async function handleDiscoveryJob(job: JobRecord) {
  const payload = DiscoveryJobPayloadSchema.parse(job.payload)
  const startedAt = new Date()
  const maxKeywords = Math.min(payload.maxKeywords ?? 50, 200)

  const crawlPages = await db
    .select()
    .from(schema.crawlPages)
    .where(inArray(schema.crawlPages.id, payload.pageIds))

  if (crawlPages.length === 0) {
    throw new Error(`No crawl pages found for discovery job ${job.id}`)
  }

  const llmPages = crawlPages.map((page) => {
    const meta = (page.meta as Record<string, unknown>) ?? {}
    return {
      url: page.url,
      title: typeof meta?.title === 'string' ? (meta.title as string) : null,
      description: typeof meta?.description === 'string' ? (meta.description as string) : null,
      content: decodeContentBlob(page.contentBlobUrl as string)
    }
  })

  await appendLog(job.id, `Loaded ${llmPages.length} crawl pages for summarization`, 'info')
  await updateJobProgress(job.id, 10)

  const summary = await llmProvider.summarizeSite({
    projectId: payload.projectId,
    locale: payload.locale,
    pages: llmPages
  })
  await appendLog(job.id, 'Generated site summary via LLM provider', 'info')
  await updateJobProgress(job.id, 25)

  const seeds = await llmProvider.expandSeedKeywords({
    projectId: payload.projectId,
    locale: payload.locale,
    topicClusters: summary.topicClusters ?? [],
    maxKeywords
  })

  if (seeds.length === 0) {
    throw new Error('LLM provider returned no keyword seeds')
  }

  await appendLog(job.id, `LLM produced ${seeds.length} keyword seeds`, 'info')
  await updateJobProgress(job.id, 35)

  const normalizedSeeds = seeds.map((seed, index) => ({
    keyword: seed.keyword.toLowerCase(),
    original: seed.keyword,
    topic: seed.topic,
    index
  }))

  const hashToSeed = new Map<string, (typeof normalizedSeeds)[number]>()
  const hashes: string[] = []
  for (const seed of normalizedSeeds) {
    const hash = computeMetricHash(seed.keyword, payload.locale, payload.location)
    hashToSeed.set(hash, seed)
    hashes.push(hash)
  }

  const existingCaches = hashes.length
    ? await db
        .select()
        .from(schema.metricCaches)
        .where(
          and(
            eq(schema.metricCaches.projectId, payload.projectId),
            eq(schema.metricCaches.provider, 'dataforseo'),
            inArray(schema.metricCaches.hash, hashes)
          )
        )
    : []

  const metricsMap = new Map<string, any>()
  const now = new Date()

  for (const cache of existingCaches) {
    const seed = hashToSeed.get(cache.hash)
    if (!seed) continue
    const fetchedAt =
      cache.fetchedAt instanceof Date ? cache.fetchedAt : new Date(cache.fetchedAt as string)
    const expires = new Date(fetchedAt.getTime() + cache.ttl * 1000)
    if (expires <= now) continue
    const cachedMetrics = (cache.metrics as Record<string, unknown>) ?? {}
    metricsMap.set(seed.keyword, {
      searchVolume: toNumber(cachedMetrics.searchVolume),
      cpc: toNumber(cachedMetrics.cpc),
      competition: toNumber(cachedMetrics.competition),
      difficulty: toNumber(cachedMetrics.difficulty),
      trend12mo: Array.isArray(cachedMetrics.trend12mo) ? cachedMetrics.trend12mo : undefined,
      sourceProvider: 'dataforseo',
      provider:
        typeof cachedMetrics.provider === 'string' ? (cachedMetrics.provider as string) : 'dataforseo',
      fetchedAt: fetchedAt.toISOString()
    })
  }

  const missingSeeds = normalizedSeeds.filter((seed) => !metricsMap.has(seed.keyword))

  const metricsFlag = await getFeatureFlag(db, 'seo-provider-metrics', false)
  const useLiveMetrics = metricsFlag && metricsClient.isConfigured()

  if (useLiveMetrics && missingSeeds.length > 0) {
    const liveResults = await metricsClient.fetchKeywordMetrics(
      missingSeeds.map((seed) => seed.keyword),
      payload.locale,
      payload.location
    )
    for (const seed of missingSeeds) {
      const live = liveResults.get(seed.keyword)
      if (!live) continue
      const metricsPayload = {
        searchVolume: live.searchVolume ?? null,
        cpc: live.cpc ?? null,
        competition: live.competition ?? null,
        difficulty: live.difficulty ?? null,
        trend12mo: live.trend12mo,
        sourceProvider: 'dataforseo',
        provider: 'dataforseo',
        fetchedAt: now.toISOString()
      }
      metricsMap.set(seed.keyword, metricsPayload)
      const hash = computeMetricHash(seed.keyword, payload.locale, payload.location)
      await db
        .insert(schema.metricCaches)
        .values({
          id: randomUUID(),
          projectId: payload.projectId,
          provider: 'dataforseo',
          hash,
          metrics: metricsPayload,
          fetchedAt: now,
          ttl: METRIC_CACHE_TTL_SECONDS
        })
        .onConflictDoUpdate({
          target: [schema.metricCaches.projectId, schema.metricCaches.hash],
          set: {
            metrics: metricsPayload,
            fetchedAt: now,
            ttl: METRIC_CACHE_TTL_SECONDS
          }
        })
    }
    await appendLog(job.id, `Fetched live metrics for ${metricsMap.size} keywords`, 'info')
  }

  if (!useLiveMetrics) {
    for (const seed of missingSeeds) {
      const fallback = {
        searchVolume: Math.max(40, 400 - seed.index * 7),
        cpc: Number((1.05 + seed.index * 0.03).toFixed(2)),
        competition: Number((0.25 + (seed.index % 5) * 0.08).toFixed(2)),
        difficulty: Math.min(90, 30 + seed.index * 1.5),
        trend12mo: undefined,
        sourceProvider: 'dataforseo',
        provider: 'mock',
        fetchedAt: now.toISOString()
      }
      metricsMap.set(seed.keyword, fallback)
    }
    if (missingSeeds.length > 0) {
      await appendLog(job.id, 'Used fallback metrics for keyword enrichment', 'warn')
    }
  }

  await updateJobProgress(job.id, 60)

  const existingKeywords = await db
    .select({ id: schema.keywords.id, phrase: schema.keywords.phrase })
    .from(schema.keywords)
    .where(
      and(
        eq(schema.keywords.projectId, payload.projectId),
        eq(schema.keywords.locale, payload.locale),
        inArray(
          schema.keywords.phrase,
          normalizedSeeds.map((seed) => seed.keyword)
        )
      )
    )

  const existingMap = new Map(existingKeywords.map((row) => [row.phrase, row.id]))
  const keywordIds: string[] = []
  const keywordPhrases: string[] = []

  for (const seed of normalizedSeeds) {
    const metrics = metricsMap.get(seed.keyword)
    const keywordId = existingMap.get(seed.keyword) ?? randomUUID()
    const opportunityScore = computeOpportunityScore(metrics)
    const updateData = {
      primaryTopic: seed.topic,
      metrics: metrics ?? null,
      status: 'recommended' as const,
      opportunityScore,
      updatedAt: now
    }
    if (existingMap.has(seed.keyword)) {
      await db
        .update(schema.keywords)
        .set(updateData)
        .where(eq(schema.keywords.id, keywordId))
    } else {
      await db.insert(schema.keywords).values({
        id: keywordId,
        projectId: payload.projectId,
        phrase: seed.keyword,
        locale: payload.locale,
        primaryTopic: seed.topic,
        source: 'crawl',
        metrics: metrics ?? null,
        status: 'recommended',
        opportunityScore,
        createdAt: now,
        updatedAt: now
      })
    }
    keywordIds.push(keywordId)
    keywordPhrases.push(seed.original)
  }

  await appendLog(job.id, `Persisted ${keywordIds.length} keyword recommendations`, 'info')
  await updateJobProgress(job.id, 80)

  const planJobId = randomUUID()
  await db.insert(schema.jobs).values({
    id: planJobId,
    projectId: payload.projectId,
    type: 'plan',
    status: 'queued',
    payload: {
      projectId: payload.projectId,
      keywords: keywordPhrases,
      keywordIds,
      locale: payload.locale
    },
    retries: 0,
    createdAt: now,
    updatedAt: now,
    logs: [],
    priority: 0,
    progressPct: 0
  })
  await appendLog(job.id, 'Queued plan job with LLM outlines', 'info')
  await updateJobProgress(job.id, 90)

  await db.insert(schema.discoveryRuns).values({
    id: job.id,
    projectId: payload.projectId,
    providersUsed: useLiveMetrics ? ['crawl', 'llm', 'dataforseo'] : ['crawl', 'llm'],
    startedAt,
    finishedAt: new Date(),
    status: 'succeeded',
    costMeter: {
      creditsConsumed: useLiveMetrics ? keywordIds.length : 0,
      currency: payload.costEstimate?.currency ?? 'usd',
      estimatedSpend: payload.costEstimate?.total
    },
    summary: {
      businessSummary: summary.businessSummary ?? 'Summary unavailable',
      audience: summary.audience ?? [],
      topicClusters: summary.topicClusters ?? [],
      products: summary.products
    }
  })

  await appendLog(job.id, 'Discovery run persisted', 'info')
  await updateJobProgress(job.id, 100)
}

async function handlePlanJob(job: JobRecord) {
  const payload = PlanJobPayloadSchema.parse(job.payload)
  const now = new Date()
  const startDate = payload.startDate ? new Date(`${payload.startDate}T00:00:00Z`) : now
  const baseDate = Number.isNaN(startDate.getTime()) ? new Date(now) : startDate
  baseDate.setUTCHours(0, 0, 0, 0)
  const planningHorizonDays = payload.days ?? 30

  const keywordIds = Array.isArray(payload.keywordIds) ? payload.keywordIds : []

  let keywordRecords: Array<typeof schema.keywords.$inferSelect> = []

  if (keywordIds.length > 0) {
    keywordRecords = await db
      .select()
      .from(schema.keywords)
      .where(
        and(
          eq(schema.keywords.projectId, payload.projectId),
          inArray(schema.keywords.id, keywordIds)
        )
      )
  } else if (payload.keywords.length > 0) {
    keywordRecords = await db
      .select()
      .from(schema.keywords)
      .where(
        and(
          eq(schema.keywords.projectId, payload.projectId),
          inArray(schema.keywords.phrase, payload.keywords.map((keyword) => keyword.toLowerCase()))
        )
      )
  }

  if (keywordRecords.length === 0) {
    await appendLog(job.id, 'No keywords available to schedule plan items', 'warn')
    await updateJobProgress(job.id, 100)
    return
  }

  await appendLog(job.id, 'Generating LLM outlines for plan items', 'info')
  await updateJobProgress(job.id, 20)

  const uniqueKeywords = new Map<string, typeof schema.keywords.$inferSelect>()
  for (const record of keywordRecords) {
    uniqueKeywords.set(record.id, record)
  }

  const outlineMap = new Map<string, DraftTitleOutlineResult>()
  for (const [keywordId, record] of uniqueKeywords) {
    const outline = await llmProvider.draftTitleOutline({
      keyword: record.phrase,
      locale: payload.locale
    })
    outlineMap.set(keywordId, outline)
  }

  await appendLog(job.id, `Prepared outlines for ${outlineMap.size} keywords`, 'info')
  await updateJobProgress(job.id, 50)

  const horizonStart = baseDate.toISOString().slice(0, 10)
  await db
    .delete(schema.planItems)
    .where(
      and(
        eq(schema.planItems.projectId, payload.projectId),
        gte(schema.planItems.plannedDate, horizonStart)
      )
    )

  const planItems = Array.from({ length: planningHorizonDays }, (_, index) => {
    const keyword = keywordRecords[index % keywordRecords.length]
    const outline = outlineMap.get(keyword.id)
    const plannedDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000)
    const isoDate = plannedDate.toISOString().slice(0, 10)
    const outlineSections = outline?.outline ?? []
    const title = outline?.title ?? `Plan for ${keyword.phrase}`

    return {
      id: randomUUID(),
      projectId: payload.projectId,
      keywordId: keyword.id,
      plannedDate: isoDate,
      title,
      outline: outlineSections,
      status: 'planned' as const,
      createdAt: now,
      updatedAt: now
    }
  })

  await db.insert(schema.planItems).values(planItems)

  await appendLog(job.id, `Created ${planItems.length} plan items`, 'info')
  await updateJobProgress(job.id, 100)
}

async function handleGenerateJob(job: JobRecord) {
  const payload = GenerateJobPayloadSchema.parse(job.payload)
  const planItem = await db.query.planItems.findFirst({
    where: (planItems, { eq }) => eq(planItems.id, payload.planItemId)
  })

  if (!planItem) {
    throw new Error(`Plan item ${payload.planItemId} not found`)
  }

  const existingArticle = await db.query.articles.findFirst({
    where: (articles, { eq }) => eq(articles.planItemId, planItem.id)
  })

  if (existingArticle) {
    await appendLog(job.id, `Article already exists for plan item ${planItem.id}`, 'warn')
    await updateJobProgress(job.id, 100)
    return
  }

  const keyword = await db.query.keywords.findFirst({
    where: (keywords, { eq }) => eq(keywords.id, planItem.keywordId)
  })

  const outlineSections = Array.isArray(planItem.outline)
    ? (planItem.outline as DraftTitleOutlineResult['outline'])
    : []
  const locale = keyword?.locale ?? 'en'
  const keywordPhrase = keyword?.phrase ?? planItem.title

  await appendLog(job.id, 'Generating article body via LLM provider', 'info')
  await updateJobProgress(job.id, 40)

  const generated = await llmProvider.generateArticle({
    title: planItem.title,
    outline: outlineSections,
    keyword: keywordPhrase,
    locale,
    tone: keyword?.primaryTopic ?? undefined
  })

  const now = new Date()

  await db.insert(schema.articles).values({
    id: job.id,
    projectId: planItem.projectId,
    keywordId: planItem.keywordId,
    planItemId: planItem.id,
    title: planItem.title,
    outline: outlineSections,
    bodyHtml: generated.bodyHtml || `<p>${planItem.title}</p>`,
    language: locale,
    tone: keyword?.primaryTopic ?? 'informative',
    media: generated.media ?? [],
    status: 'draft',
    generationDate: now,
    createdAt: now,
    updatedAt: now
  })

  await db
    .update(schema.planItems)
    .set({
      status: 'consumed',
      updatedAt: now
    })
    .where(eq(schema.planItems.id, planItem.id))

  await updateJobProgress(job.id, 100)
  await appendLog(job.id, 'Article draft generated', 'info')
}

async function handlePublishJob(job: JobRecord) {
  const payload = PublishJobPayloadSchema.parse(job.payload)
  const [article] = await db
    .select()
    .from(schema.articles)
    .where(eq(schema.articles.id, payload.articleId))
    .limit(1)

  if (!article) {
    throw new Error(`Article ${payload.articleId} not found`)
  }

  if (article.status === 'published') {
    await appendLog(job.id, `Article ${payload.articleId} already published`, 'info')
    await updateJobProgress(job.id, 100)
    return
  }

  const [integration] = await db
    .select()
    .from(schema.integrations)
    .where(eq(schema.integrations.id, payload.integrationId))
    .limit(1)

  if (!integration) {
    throw new Error(`Integration ${payload.integrationId} not found`)
  }

  await appendLog(job.id, `Publishing article ${payload.articleId} via ${integration.type}`, 'info')

  const portable = buildPortableArticle(article as ArticleRecord)
  const idempotencyKey = `publish:${payload.articleId}:${job.id}`

  switch (integration.type) {
    case 'webhook': {
      const { targetUrl, secret } = resolveWebhookConfig(integration as IntegrationRecord)
      const result = await deliverWebhookPublish({
        targetUrl,
        secret,
        article: portable,
        articleId: payload.articleId,
        integrationId: integration.id,
        projectId: payload.projectId,
        idempotencyKey
      })

      const now = new Date()
      await db
        .update(schema.articles)
        .set({
          status: 'published',
          updatedAt: now,
          publicationDate: now,
          cmsExternalId: result.externalId ?? article.cmsExternalId,
          url: result.url ?? article.url
        })
        .where(eq(schema.articles.id, payload.articleId))

      await updateJobProgress(job.id, 100)
      await appendLog(
        job.id,
        `Article ${payload.articleId} published via webhook (${integration.id})`,
        'info'
      )
      if (result.externalId) {
        await appendLog(job.id, `Webhook externalId=${result.externalId}`, 'info')
      }
      if (result.url) {
        await appendLog(job.id, `Webhook url=${result.url}`, 'info')
      }
      return
    }
    case 'webflow': {
      const config = resolveWebflowConfig(integration as IntegrationRecord)
      const result = await publishArticleToWebflow(config, portable)
      const now = new Date()
      const isLive = config.publishMode === 'live'
      await db
        .update(schema.articles)
        .set({
          status: 'published',
          updatedAt: now,
          publicationDate: isLive ? now : article.publicationDate,
          cmsExternalId: result.itemId ?? article.cmsExternalId,
          url: result.url ?? article.url
        })
        .where(eq(schema.articles.id, payload.articleId))

      await updateJobProgress(job.id, 100)
      const details: string[] = [
        `Article ${payload.articleId} published via Webflow (${integration.id})`
      ]
      if (!isLive) {
        details.push('Item created as draft')
      }
      await appendLog(job.id, details.join(' — '), 'info')
      if (result.itemId) {
        await appendLog(job.id, `Webflow itemId=${result.itemId}`, 'info')
      }
      if (result.slug) {
        await appendLog(job.id, `Webflow slug=${result.slug}`, 'info')
      }
      if (result.url) {
        await appendLog(job.id, `Webflow url=${result.url}`, 'info')
      }
      return
    }
    default: {
      throw new Error(`Integration type ${integration.type} not supported for publishing`)
    }
  }
}

async function updateJobProgress(id: string, progress: number) {
  await db
    .update(schema.jobs)
    .set({
      progressPct: progress,
      updatedAt: new Date()
    })
    .where(eq(schema.jobs.id, id))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function handleShutdown() {
  shutdown = true
  console.log('[worker] shutdown signal received')
}

main().catch((error) => {
  console.error('[worker] fatal error', error)
  process.exitCode = 1
})

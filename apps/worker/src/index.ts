// @ts-nocheck
import { randomUUID } from 'node:crypto'
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

const POLL_INTERVAL_MS = appConfig.worker.pollIntervalMs
const MAX_ATTEMPTS = appConfig.worker.maxAttempts

const db = getDb()
const queue = getJobQueue()

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
  const now = new Date()
  const pageId = randomUUID()
  await db.insert(schema.crawlPages).values({
    id: pageId,
    projectId: payload.projectId,
    url: payload.siteUrl,
    httpStatus: 200,
    contentHash: randomUUID(),
    extractedAt: now,
    meta: {
      title: `Landing page for ${payload.siteUrl}`,
      description: `Auto-crawled summary for ${payload.siteUrl}`
    },
    headings: [{ level: 'h1', text: `Welcome to ${payload.siteUrl}` }],
    links: [],
    contentBlobUrl: `https://storage.fake/${pageId}`
  })

  await updateJobProgress(job.id, 100)
  await appendLog(job.id, 'Crawl job completed', 'info')
}

async function handleDiscoveryJob(job: JobRecord) {
  const payload = DiscoveryJobPayloadSchema.parse(job.payload)
  const now = new Date()
  const totalKeywords = Math.min(payload.maxKeywords ?? 30, 200)
  const basePages = Math.max(payload.pageIds.length, 1)

  await updateJobProgress(job.id, 20)
  await appendLog(job.id, `Starting discovery for ${totalKeywords} candidates`, 'info')

  const keywords = Array.from({ length: totalKeywords }, (_, index) => {
    const seedPageId = payload.pageIds[index % basePages] ?? 'page'
    const order = index + 1
    const searchVolume = 120 + order * 8
    const difficulty = Math.min(100, 25 + order * 1.8)
    const competition = Number((0.2 + (order % 7) * 0.07).toFixed(2))
    const cpc = Number((0.8 + order * 0.04).toFixed(2))
    const trend12mo = Array.from({ length: 12 }, (_, monthIndex) =>
      Number((searchVolume * (0.8 + monthIndex * 0.02)).toFixed(2))
    )
    const intent = order % 3 === 0 ? 'transactional' : order % 2 === 0 ? 'commercial' : 'informational'
    const opportunity = Math.max(
      0,
      Math.min(
        100,
        Number((Math.log(searchVolume + 1) * 18 - difficulty * 0.45 + (intent === 'transactional' ? 12 : 6)).toFixed(2))
      )
    )

    return {
      id: randomUUID(),
      projectId: payload.projectId,
      phrase: `keyword idea ${order} for ${seedPageId}`.toLowerCase(),
      locale: payload.locale,
      primaryTopic: `Topic Cluster ${Math.floor(order / 5) + 1}`,
      source: 'crawl' as const,
      metrics: {
        searchVolume,
        cpc,
        competition,
        difficulty,
        trend12mo,
        intent,
        sourceProvider: 'dataforseo',
        provider: 'dfseo',
        fetchedAt: now.toISOString()
      },
      opportunityScore: opportunity,
      status: 'recommended' as const,
      createdAt: now,
      updatedAt: now
    }
  })

  await updateJobProgress(job.id, 50)
  await appendLog(job.id, 'Keyword metrics enriched with mock provider data', 'info')

  await db
    .insert(schema.keywords)
    .values(
      keywords.map((keyword) => ({
        id: keyword.id,
        projectId: keyword.projectId,
        phrase: keyword.phrase,
        locale: keyword.locale,
        primaryTopic: keyword.primaryTopic,
        source: keyword.source,
        metrics: keyword.metrics,
        status: keyword.status,
        opportunityScore: keyword.opportunityScore,
        createdAt: keyword.createdAt,
        updatedAt: keyword.updatedAt
      }))
    )
    .onConflictDoNothing()
  await appendLog(job.id, `Seeded ${keywords.length} keywords`, 'info')

  await updateJobProgress(job.id, 70)
  await appendLog(job.id, 'Scored opportunities and persisted records', 'info')

  const planJobId = randomUUID()
  await db.insert(schema.jobs).values({
    id: planJobId,
    projectId: payload.projectId,
    type: 'plan',
    status: 'queued',
    payload: {
      projectId: payload.projectId,
      keywords: keywords.map((k) => k.phrase),
      keywordIds: keywords.map((k) => k.id),
      locale: payload.locale
    },
    retries: 0,
    createdAt: now,
    updatedAt: now,
    logs: [],
    priority: 0,
    progressPct: 0
  })
  await appendLog(job.id, 'Queued plan job', 'info')

  await updateJobProgress(job.id, 90)
  await appendLog(job.id, 'Queued downstream planning job', 'info')

  await db.insert(schema.discoveryRuns).values({
    id: job.id,
    projectId: payload.projectId,
    providersUsed: ['crawl', 'dataforseo'],
    startedAt: now,
    finishedAt: now,
    status: 'succeeded',
    costMeter: {
      creditsConsumed: keywords.length,
      currency: payload.costEstimate?.currency ?? 'usd',
      estimatedSpend: payload.costEstimate?.total
    },
    summary: {
      businessSummary: `Generated growth plan for project ${payload.projectId}`,
      audience: ['Prospects researching services', 'Returning customers'],
      topicClusters: [
        'Foundations',
        'Product Education',
        'Success Stories',
        'Competitive Comparisons',
        'Conversions'
      ]
    }
  })

  await updateJobProgress(job.id, 100)
  await appendLog(job.id, 'Discovery job completed', 'info')
}

async function handlePlanJob(job: JobRecord) {
  const payload = PlanJobPayloadSchema.parse(job.payload)
  const now = new Date()
  const startDate = payload.startDate ? new Date(`${payload.startDate}T00:00:00Z`) : now
  const base = Number.isNaN(startDate.getTime()) ? now : startDate
  const baseDate = new Date(base)
  baseDate.setUTCHours(0, 0, 0, 0)
  const planningHorizonDays = payload.days ?? 30
  const horizonStart = baseDate.toISOString().slice(0, 10)

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
          inArray(schema.keywords.phrase, payload.keywords)
        )
      )
  }

  if (keywordRecords.length === 0) {
    await appendLog(job.id, 'No keywords available to schedule plan items', 'warn')
    await updateJobProgress(job.id, 100)
    return
  }

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
    const plannedDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000)
    const isoDate = plannedDate.toISOString().slice(0, 10)
    const title = `How to leverage ${keyword.phrase}`
    const outline = [
      {
        heading: `Why ${keyword.phrase} matters`,
        subpoints: [
          `Pain points ${keyword.phrase} solves`,
          `Customer stories referencing ${keyword.phrase}`
        ]
      },
      {
        heading: `Framework for ${keyword.phrase}`,
        subpoints: [
          `Step-by-step approach`,
          `Tooling and templates`
        ]
      },
      {
        heading: `Next actions`,
        subpoints: [
          `KPI checklist`,
          `Call-to-action for ${keyword.phrase}`
        ]
      }
    ]

    return {
      id: randomUUID(),
      projectId: payload.projectId,
      keywordId: keyword.id,
      plannedDate: isoDate,
      title,
      outline,
      status: 'planned' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  await db
    .insert(schema.planItems)
    .values(planItems)
    .onConflictDoNothing()

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

  const now = new Date()
  await db.insert(schema.articles).values({
    id: job.id,
    projectId: planItem.projectId,
    keywordId: planItem.keywordId,
    planItemId: planItem.id,
    title: planItem.title,
    outline: planItem.outline,
    bodyHtml: `<p>This is an auto-generated article about ${planItem.title}.</p>`,
    language: 'en',
    tone: 'informative',
    media: [],
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

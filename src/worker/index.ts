import { consumeJobs, queueEnabled, cleanupMetricCache, publishJob } from '@common/infra/queue'
import { cleanupOldBlobs } from '@common/blob/store'
import { env } from '@common/infra/env'
import { recordJobCompleted, recordJobFailed, recordJobRunning } from '@common/infra/jobs'
import { processCrawl } from './processors/crawler'
import { processDiscovery } from './processors/discovery'
import { processPlan } from './processors/plan'
import { processScore } from './processors/score'
import { processGenerate } from './processors/generate'
import { processPublish } from './processors/publish'
import { processMetrics } from './processors/metrics'
import { processSerp } from './processors/serp'
import { processCompetitors } from './processors/competitors'
import { processEnrich } from './processors/enrich'
import { processFeedback } from './processors/feedback'

type WorkerOptions = {
  intervalMs?: number
}

export async function runWorker(options: WorkerOptions = {}) {
  if (queueEnabled()) {
    const masked = (process.env.RABBITMQ_URL ? (() => { try { const u = new URL(process.env.RABBITMQ_URL); return `amqp://${u.username || 'user'}:****@${u.hostname}${u.port ? ':'+u.port : ''}${u.pathname || '/'}` } catch { return 'amqp://<invalid>' } })() : 'amqp://<missing>')
    console.info('[seo-agent] worker consuming RabbitMQ jobs', { url: masked })
    // housekeeping even in queue mode
    const cleanupInterval = setInterval(() => {
      cleanupMetricCache().catch(() => {})
      try { cleanupOldBlobs(env.blobTtlDays) } catch {}
    }, 15 * 60 * 1000)
    console.info('[worker] DB available?', { hasDb: Boolean(process.env.DATABASE_URL) })
    const perProjectRunning = new Map<string, number>()
    const projectConcurrency = Math.max(1, Number(process.env.SEOA_PROJECT_CONCURRENCY || '1'))
    const maxRetries = Math.max(0, Number(process.env.SEOA_JOB_MAX_RETRIES || '2'))
    const baseDelayMs = Math.max(500, Number(process.env.SEOA_JOB_RETRY_DELAY_MS || '1000'))
    await consumeJobs(async (msg) => {
      const projectId = String((msg.payload as any).projectId ?? '')
      // simple per-project concurrency: if saturated, requeue with small delay
      if (projectId) {
        const cur = perProjectRunning.get(projectId) ?? 0
        if (cur >= projectConcurrency) {
          console.warn('[worker] project concurrency saturated; requeueing', { projectId, type: msg.type, current: cur, limit: projectConcurrency })
          setTimeout(() => publishJob({ type: msg.type, payload: msg.payload, retries: msg.retries ?? 0 }).catch(() => {}), 300)
          return
        }
        perProjectRunning.set(projectId, cur + 1)
      }
      if (projectId) recordJobRunning(projectId, msg.id)
      console.info('[worker] processing', { id: msg.id, type: msg.type, projectId, retries: msg.retries ?? 0 })
      try {
        try {
          const row = { id: msg.id, type: msg.type, status: 'running', at: new Date().toISOString() }
          const target = projectId || 'global'
          const { appendJsonl } = await import('@common/bundle/store')
          appendJsonl(target, 'logs/jobs.jsonl', row)
        } catch {}
        switch (msg.type) {
          case 'crawl':
            await processCrawl(msg.payload as any)
            break
          case 'discovery':
            await processDiscovery(msg.payload as any)
            break
          case 'score':
            await processScore(msg.payload as any)
            break
          case 'plan':
            await processPlan(msg.payload as any)
            break
          case 'generate':
            await processGenerate(msg.payload as any)
            break
          case 'publish':
            await processPublish(msg.payload as any)
            break
          case 'metrics':
            await processMetrics(msg.payload as any)
            break
          case 'serp':
            await processSerp(msg.payload as any)
            break
          case 'competitors':
            await processCompetitors(msg.payload as any)
            break
          case 'enrich':
            await processEnrich(msg.payload as any)
            break
          case 'feedback':
            await processFeedback(msg.payload as any)
            break
          default:
            break
        }
        if (projectId) recordJobCompleted(projectId, msg.id)
        try {
          const { onJobSuccess } = await import('@common/workflow/manager')
          await onJobSuccess(msg.type, msg.payload)
        } catch {}
        try {
          const row = { id: msg.id, type: msg.type, status: 'completed', at: new Date().toISOString() }
          const target = projectId || 'global'
          const { appendJsonl } = await import('@common/bundle/store')
          appendJsonl(target, 'logs/jobs.jsonl', row)
        } catch {}
        console.info('[worker] completed', { id: msg.id, type: msg.type, projectId })
      } catch (error) {
        const err = error instanceof Error ? { message: error.message } : { message: String(error) }
        if (projectId) recordJobFailed(projectId, msg.id, err)
        try {
          const row = { id: msg.id, type: msg.type, status: 'failed', at: new Date().toISOString(), error: err }
          const target = projectId || 'global'
          const { appendJsonl } = await import('@common/bundle/store')
          appendJsonl(target, 'logs/jobs.jsonl', row)
        } catch {}
        console.error('[worker] failed', { id: msg.id, type: msg.type, projectId, error: err })
        // retry/backoff limited
        const attempt = Number(msg.retries ?? 0)
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          console.warn('[worker] retrying', { id: msg.id, attempt: attempt + 1, delayMs: delay })
          setTimeout(() => publishJob({ type: msg.type, payload: msg.payload, retries: attempt + 1 }).catch(() => {}), delay)
        }
      }
      finally {
        if (projectId) {
          const cur = perProjectRunning.get(projectId) ?? 1
          perProjectRunning.set(projectId, Math.max(0, cur - 1))
        }
      }
    })
    return // keep process alive via consumer
  }

  const interval = Math.max(1000, options.intervalMs ?? 60_000)
  console.info(`[seo-agent] worker started without queue; heartbeat every ${interval}ms`)
  // Heartbeat only (no-op)
  setInterval(() => {
    console.info('[seo-agent] worker heartbeat')
    cleanupMetricCache().catch(() => {})
    try { cleanupOldBlobs(env.blobTtlDays) } catch {}
  }, interval)
}

const workerImportMeta = import.meta as ImportMeta & { main?: boolean }

if (workerImportMeta.main) {
  runWorker().catch((error) => {
    console.error('[seo-agent] worker crashed', error)
    process.exit(1)
  })
}

import '@common/infra/network'
import { consumeJobs, queueEnabled, cleanupMetricCache, publishJob } from '@common/infra/queue'
import { cleanupOldBlobs } from '@common/blob/store'
import { env } from '@common/infra/env'
import { recordJobCompleted, recordJobFailed, recordJobRunning } from '@common/infra/jobs'
import { initConnectors } from '@features/integrations/server/registry'
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
import { log } from '@src/common/logger'
import { getDevFlags } from '@common/dev/flags'
import { getDb, hasDatabase } from '@common/infra/db'
import { sql } from 'drizzle-orm'

type WorkerOptions = {
  intervalMs?: number
}

export async function runWorker(options: WorkerOptions = {}) {
  // Initialize CMS connectors
  initConnectors()
  log.info('[Worker] CMS connectors initialized')
  try {
    const flags = getDevFlags()
    log.info('[discovery] keyword generator mode', { mode: flags.mocks.keywordExpansion ? 'mock' : 'real' })
  } catch {}
  if (queueEnabled()) {
    const masked = (process.env.RABBITMQ_URL ? (() => { try { const u = new URL(process.env.RABBITMQ_URL); return `amqp://${u.username || 'user'}:****@${u.hostname}${u.port ? ':'+u.port : ''}${u.pathname || '/'}` } catch { return 'amqp://<invalid>' } })() : 'amqp://<missing>')
    log.info('[seo-agent] worker consuming RabbitMQ jobs', { url: masked })
    // housekeeping even in queue mode
    const cleanupInterval = setInterval(() => {
      cleanupMetricCache().catch(() => {})
      try { cleanupOldBlobs(env.blobTtlDays) } catch {}
    }, 15 * 60 * 1000)

    // Daily scheduler guarded by Postgres advisory lock
    const DEFAULT_DAILY_MS = 24 * 60 * 60 * 1000
    const SCHEDULE_EVERY_MS = Number(process.env.SEOA_SCHEDULER_INTERVAL_MS || String(DEFAULT_DAILY_MS))
    let isLeader = false
    const tryAcquire = async () => {
      if (!hasDatabase()) return false
      try {
        const db = getDb()
        // @ts-ignore drizzle execute returns driver-specific shape
        const rows = await db.execute(sql`select pg_try_advisory_lock(101, 1) as ok`)
        const ok = Array.isArray(rows) ? Boolean((rows as any)[0]?.ok) : Boolean((rows as any)?.rows?.[0]?.ok)
        if (ok) log.info('[scheduler] acquired advisory lock; acting as leader')
        return ok
      } catch (e) {
        log.warn('[scheduler] advisory lock failed', { error: (e as Error)?.message || String(e) })
        return false
      }
    }
    setInterval(async () => {
      try {
        if (!isLeader) isLeader = await tryAcquire()
        if (!isLeader) return
        const { runDailySchedules } = await import('@common/scheduler/daily')
        await runDailySchedules()
      } catch (err) {
        log.error('[scheduler] run failed', { error: (err as Error)?.message || String(err) })
      }
    }, SCHEDULE_EVERY_MS)
    log.info('[worker] scheduler enabled', { intervalMs: SCHEDULE_EVERY_MS })
    log.info('[worker] DB available?', { hasDb: hasDatabase() })
    const perProjectRunning = new Map<string, number>()
    const projectConcurrency = 1
    const maxRetries = 2
    const baseDelayMs = 1000
    await consumeJobs(async (msg) => {
      const projectId = String((msg.payload as any).projectId ?? '')
      // simple per-project concurrency: if saturated, requeue with small delay
      if (projectId) {
        const cur = perProjectRunning.get(projectId) ?? 0
        if (cur >= projectConcurrency) {
          log.warn('[worker] project concurrency saturated; requeueing', { projectId, type: msg.type, current: cur, limit: projectConcurrency })
          setTimeout(() => publishJob({ type: msg.type, payload: msg.payload, retries: msg.retries ?? 0 }).catch(() => {}), 300)
          return
        }
        perProjectRunning.set(projectId, cur + 1)
      }
      if (projectId) recordJobRunning(projectId, msg.id)
      log.info('[worker] processing', { id: msg.id, type: msg.type, projectId, retries: msg.retries ?? 0 })
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
        log.info('[worker] completed', { id: msg.id, type: msg.type, projectId })
      } catch (error) {
        const isCredit = error instanceof Error && error.message === 'credit_exceeded'
        const err = error instanceof Error ? { message: error.message } : { message: String(error) }
        if (projectId) recordJobFailed(projectId, msg.id, err)
        try {
          const row = { id: msg.id, type: msg.type, status: 'failed', at: new Date().toISOString(), error: err }
          const target = projectId || 'global'
          const { appendJsonl } = await import('@common/bundle/store')
          appendJsonl(target, 'logs/jobs.jsonl', row)
        } catch {}
        log.error('[worker] failed', { id: msg.id, type: msg.type, projectId, error: err })
        // retry/backoff limited
        const attempt = Number(msg.retries ?? 0)
        if (!isCredit && attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          log.warn('[worker] retrying', { id: msg.id, attempt: attempt + 1, delayMs: delay })
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
  log.info(`[seo-agent] worker started without queue; heartbeat every ${interval}ms`)
  // Heartbeat only (no-op)
  setInterval(() => {
    log.info('[seo-agent] worker heartbeat')
    cleanupMetricCache().catch(() => {})
    try { cleanupOldBlobs(env.blobTtlDays) } catch {}
  }, interval)
}

const workerImportMeta = import.meta as ImportMeta & { main?: boolean }

if (workerImportMeta.main) {
  runWorker().catch((error) => {
    log.error('[seo-agent] worker crashed', error)
    process.exit(1)
  })
}

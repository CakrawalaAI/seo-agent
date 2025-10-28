import { consumeJobs, queueEnabled, cleanupMetricCache, publishJob } from '@common/infra/queue'
import { cleanupOldBlobs } from '@common/blob/store'
import { env } from '@common/infra/env'
import { recordJobCompleted, recordJobFailed, recordJobRunning } from '@common/infra/jobs'
import { processCrawl } from './processors/crawler'
import { processDiscovery } from './processors/discovery'
import { processPlan } from './processors/plan'
import { processGenerate } from './processors/generate'
import { processPublish } from './processors/publish'

type WorkerOptions = {
  intervalMs?: number
}

export async function runWorker(options: WorkerOptions = {}) {
  if (queueEnabled()) {
    console.info('[seo-agent] worker consuming RabbitMQ jobs')
    // housekeeping even in queue mode
    const cleanupInterval = setInterval(() => {
      cleanupMetricCache().catch(() => {})
      try { cleanupOldBlobs(env.blobTtlDays) } catch {}
    }, 15 * 60 * 1000)
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
          setTimeout(() => publishJob({ type: msg.type, payload: msg.payload, retries: msg.retries ?? 0 }).catch(() => {}), 300)
          return
        }
        perProjectRunning.set(projectId, cur + 1)
      }
      if (projectId) recordJobRunning(projectId, msg.id)
      try {
        switch (msg.type) {
          case 'crawl':
            await processCrawl(msg.payload as any)
            break
          case 'discovery':
            await processDiscovery(msg.payload as any)
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
          default:
            break
        }
        if (projectId) recordJobCompleted(projectId, msg.id)
      } catch (error) {
        const err = error instanceof Error ? { message: error.message } : { message: String(error) }
        if (projectId) recordJobFailed(projectId, msg.id, err)
        // retry/backoff limited
        const attempt = Number(msg.retries ?? 0)
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
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

// Relax types to avoid amqplib type variance issues across versions
let conn: any = null
let chan: any = null

const PREFIX = process.env.RABBITMQ_QUEUE_PREFIX || ''
// Streamlined defaults: single unified queue/exchange
const BASE_QUEUE = 'seo_jobs'
const QUEUE_NAME = PREFIX ? `${PREFIX}.${BASE_QUEUE}` : BASE_QUEUE
const EXCHANGE_NAME = 'seo.jobs'
const DLX_NAME = 'seo.jobs.dlq'
const DLQ_NAME = PREFIX ? `${PREFIX}.seo_jobs_dlq` : 'seo_jobs_dlq'

export type JobMessage = {
  type:
    | 'crawl'
    | 'discovery'
    | 'score'
    | 'plan'
    | 'generate'
    | 'publish'
    | 'metrics'
    | 'serp'
    | 'competitors'
    | 'enrich'
    | 'feedback'
  payload: Record<string, unknown>
  retries?: number
}

export function queueEnabled() {
  return Boolean(process.env.RABBITMQ_URL)
}

function maskRabbitUrl(raw?: string | null) {
  if (!raw) return 'amqp://<missing>'
  try {
    const u = new URL(raw)
    const user = u.username || 'user'
    const host = u.hostname || 'localhost'
    const port = u.port ? `:${u.port}` : ''
    const vhost = u.pathname || '/'
    return `amqp://${user}:****@${host}${port}${vhost}`
  } catch {
    return 'amqp://<invalid>'
  }
}

export async function getChannel(): Promise<any> {
  if (chan) return chan
  if (!process.env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL not set')
  }
  const amqp = await import('amqplib')
  const masked = maskRabbitUrl(process.env.RABBITMQ_URL)
  const { log } = await import('@src/common/logger')
  log.info(`[queue] connecting`, { url: masked })
  // Ensure heartbeat parameter to avoid idle disconnects
  const HEARTBEAT = Math.max(5, Number(process.env.RABBITMQ_HEARTBEAT || '30'))
  let url = process.env.RABBITMQ_URL as string
  try {
    const u = new URL(url)
    if (!u.searchParams.get('heartbeat')) {
      u.searchParams.set('heartbeat', String(HEARTBEAT))
      url = u.toString()
    }
  } catch {}
  conn = await (amqp as any).connect(url)
  // Defensive: avoid process crashes on heartbeat errors
  try { conn.on('error', (e: any) => { try { log.error('[queue] connection error', { message: e?.message || String(e) }) } catch {} }) } catch {}
  try { conn.on('close', () => { try { log.warn('[queue] connection closed') } catch {}; chan = null; conn = null }) } catch {}
  chan = await conn.createChannel()
  try { chan.on?.('error', (e: any) => { try { log.error('[queue] channel error', { message: e?.message || String(e) }) } catch {} }) } catch {}
  // Topic exchange for routing by type.projectId
  await chan.assertExchange(EXCHANGE_NAME, 'topic', { durable: true })
  await chan.assertExchange(DLX_NAME, 'topic', { durable: true })
  await chan.assertQueue(QUEUE_NAME, { durable: true, arguments: { 'x-dead-letter-exchange': DLX_NAME } })
  // Bind all topics by default; single worker handles all job types
  await chan.bindQueue(QUEUE_NAME, EXCHANGE_NAME, '#')
  await chan.assertQueue(DLQ_NAME, { durable: true })
  await chan.bindQueue(DLQ_NAME, DLX_NAME, '#')
  log.info(`[queue] channel ready`, { exchange: EXCHANGE_NAME, queue: QUEUE_NAME, dlq: DLQ_NAME })
  return chan
}

export async function publishJob(message: JobMessage): Promise<string> {
  try {
    const ch = await getChannel()
    const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const envelope = { id: jobId, retries: 0, ...message }
    const opts: any = { persistent: true }
    const projectId = String((message.payload as any)?.projectId || 'unknown')
    const routingKey = `${message.type}.${projectId}`
    const ok = ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(envelope)), opts)
    const { log } = await import('@src/common/logger')
    log.info(`[queue] published`, { id: jobId, type: message.type, routingKey, persisted: ok })
    return jobId
  } catch (err) {
    // queue disabled or connection failed; generate a local id so callers can proceed
    const { log } = await import('@src/common/logger')
    log.error('[queue] publish failed, returning local id', { error: (err as Error)?.message || String(err) })
    return `job_local_${Date.now().toString(36)}`
  }
}

export async function consumeJobs(
  handler: (msg: JobMessage & { id: string }) => Promise<void>
) {
  const ch = await getChannel()
  const prefetch = Math.max(1, Number(process.env.RABBITMQ_PREFETCH || '1'))
  await ch.prefetch(prefetch)
  const { log } = await import('@src/common/logger')
  log.info('[queue] consumer started', { queue: QUEUE_NAME, prefetch })
  ch.consume(QUEUE_NAME, async (msg: any) => {
    if (!msg) return
    try {
      const parsed = JSON.parse(msg.content.toString()) as JobMessage & { id: string }
      log.info('[queue] message received', { id: parsed.id, type: parsed.type, projectId: (parsed.payload as any)?.projectId })
      await handler(parsed)
      ch.ack(msg)
      log.info('[queue] message acked', { id: parsed.id })
    } catch (err) {
      log.error('[queue] handler error, nacking', { error: (err as Error)?.message || String(err) })
      ch.nack(msg, false, false)
    }
  })
}

export async function closeQueue() {
  try {
    await chan?.close()
    await conn?.close()
  } catch {}
  chan = null
  conn = null
}

// Housekeeping for metric cache (DB)
import { hasDatabase, getDb } from './db'
import { metricCache } from '@entities/metrics/db/schema'
import { sql } from 'drizzle-orm'

export async function cleanupMetricCache() {
  if (!hasDatabase()) return false
  try {
    const db = getDb()
    // TTL-based cleanup: fetched_at + (ttl_seconds)::interval < now()
    // Use INTERVAL '1 second' * ttl_seconds to avoid casts
    // @ts-ignore
    await db.execute(sql`delete from ${metricCache} where fetched_at + (interval '1 second' * ${metricCache}.ttl_seconds) < now()`)
    return true
  } catch {
    return false
  }
}

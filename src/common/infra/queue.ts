import type { Connection, Channel } from 'amqplib'

let conn: Connection | null = null
let chan: Channel | null = null

const PREFIX = process.env.RABBITMQ_QUEUE_PREFIX || ''
const BASE_QUEUE = process.env.SEOA_QUEUE_NAME || 'seo_jobs'
const QUEUE_NAME = PREFIX ? `${PREFIX}.${BASE_QUEUE}` : BASE_QUEUE
const EXCHANGE_NAME = process.env.SEOA_EXCHANGE_NAME || 'seo.jobs'
const DLX_NAME = process.env.SEOA_DLX_NAME || 'seo.jobs.dlq'
const DLQ_NAME = PREFIX ? `${PREFIX}.seo_jobs_dlq` : 'seo_jobs_dlq'

export type JobMessage = {
  type:
    | 'crawl'
    | 'discovery'
    | 'plan'
    | 'generate'
    | 'publish'
  payload: Record<string, unknown>
  retries?: number
}

export function queueEnabled() {
  return Boolean(process.env.RABBITMQ_URL)
}

export async function getChannel(): Promise<Channel> {
  if (chan) return chan
  if (!process.env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL not set')
  }
  const amqp = await import('amqplib')
  conn = await amqp.connect(process.env.RABBITMQ_URL)
  chan = await conn.createChannel()
  // Topic exchange for routing by type.projectId
  await chan.assertExchange(EXCHANGE_NAME, 'topic', { durable: true })
  await chan.assertExchange(DLX_NAME, 'topic', { durable: true })
  await chan.assertQueue(QUEUE_NAME, { durable: true, arguments: { 'x-dead-letter-exchange': DLX_NAME } })
  await chan.bindQueue(QUEUE_NAME, EXCHANGE_NAME, '#')
  await chan.assertQueue(DLQ_NAME, { durable: true })
  await chan.bindQueue(DLQ_NAME, DLX_NAME, '#')
  return chan
}

export async function publishJob(message: JobMessage): Promise<string> {
  try {
    const ch = await getChannel()
    const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const envelope = { id: jobId, retries: 0, ...message }
    const ttlMs = Number(process.env.SEOA_JOB_TTL_MS || '0')
    const opts: any = { persistent: true }
    if (ttlMs > 0) opts.expiration = String(ttlMs)
    const projectId = String((message.payload as any)?.projectId || 'unknown')
    const routingKey = `${message.type}.${projectId}`
    ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(envelope)), opts)
    return jobId
  } catch (err) {
    // queue disabled or connection failed; generate a local id so callers can proceed
    return `job_local_${Date.now().toString(36)}`
  }
}

export async function consumeJobs(
  handler: (msg: JobMessage & { id: string }) => Promise<void>
) {
  const ch = await getChannel()
  const prefetch = Math.max(1, Number(process.env.RABBITMQ_PREFETCH || '1'))
  await ch.prefetch(prefetch)
  ch.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return
    try {
      const parsed = JSON.parse(msg.content.toString()) as JobMessage & { id: string }
      await handler(parsed)
      ch.ack(msg)
    } catch (err) {
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

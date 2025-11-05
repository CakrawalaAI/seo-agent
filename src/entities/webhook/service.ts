import { getDb, hasDatabase } from '@common/infra/db'
import { webhookDeliveries, webhookEvents } from './db/schema'
function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
import type { Article } from '@entities/article/domain/article'
import type { WebsiteIntegration } from '@entities/integration/domain/integration'
import { publishViaWebhook } from '@common/publishers/webhook'
import { eq, and, desc, gt, lt } from 'drizzle-orm'

export type WebhookEventEnvelope = {
  id: string
  event: string
  created_at: string
  meta: { integrationId: string; projectId: string; articleId?: string | null }
  article?: unknown
  data?: Record<string, unknown>
}

export const webhookService = {
  async createEvent(params: {
    websiteId: string
    integrationId: string
    event: string
    articleId?: string | null
    payload: Record<string, unknown>
  }) {
    const eventId = genId('whevt')
    if (hasDatabase()) {
      const db = getDb()
      await db.insert(webhookEvents).values({
        id: eventId,
        websiteId: params.websiteId,
        integrationId: params.integrationId,
        eventType: params.event,
        articleId: params.articleId ?? null,
        payloadJson: JSON.stringify(params.payload)
      })
    }
    return eventId
  },

  async recordDeliveryAttempt(params: {
    eventId: string
    integration: WebsiteIntegration
    endpointUrl: string
    attempt: number
    status: 'pending' | 'success' | 'failed'
    httpCode?: number | null
    durationMs?: number | null
    requestHeaders?: Record<string, string>
    responseBody?: string | null
    error?: string | null
  }) {
    if (!hasDatabase()) return params.eventId
    const db = getDb()
    await db.insert(webhookDeliveries).values({
      id: genId('whdel'),
      eventId: params.eventId,
      integrationId: params.integration.id,
      endpointUrl: params.endpointUrl,
      attempt: params.attempt,
      status: params.status,
      httpCode: params.httpCode ?? null,
      durationMs: params.durationMs ?? null,
      requestHeadersJson: params.requestHeaders ? JSON.stringify(params.requestHeaders) : null,
      responseBody: params.responseBody ?? null,
      error: params.error ?? null
    })
    return params.eventId
  },

  async deliverArticleEvent(
    integration: WebsiteIntegration,
    config: { targetUrl?: string; secret?: string | null; subscribedEvents?: string[] | null; scheduleMode?: 'auto' | 'manual' | 'both' | null },
    article: Article,
    event: 'article.published' | 'article.updated' | 'test.ping' = 'article.published',
    trigger?: 'auto' | 'manual' | 'test' | null
  ) {
    const targetUrl = String(config?.targetUrl || '').trim()
    if (!targetUrl) return null
    const secret = typeof config?.secret === 'string' ? config.secret : null
    const websiteId = String(integration.websiteId)
    const articleId = String(article.id)
    // event subscription gating (test.ping always allowed)
    const subs = Array.isArray(config?.subscribedEvents) ? (config?.subscribedEvents as string[]) : null
    if (event !== 'test.ping' && subs && subs.length > 0 && !subs.includes(event)) {
      return null
    }
    // schedule gating
    if (event !== 'test.ping') {
      const mode = (config?.scheduleMode as any) || 'both'
      const trig = trigger || null
      if ((mode === 'auto' && trig === 'manual') || (mode === 'manual' && trig === 'auto')) {
        return null
      }
    }
    const eventId = await this.createEvent({
      websiteId,
      integrationId: integration.id,
      event,
      articleId,
      payload: {}
    })

    const started = Date.now()
    const envelopeMeta = { integrationId: integration.id, projectId: websiteId, articleId }
    try {
      const res = await publishViaWebhook({
        article,
        targetUrl,
        secret,
        event,
        eventId,
        meta: envelopeMeta
      })
      const durationMs = Date.now() - started
      if (!res) {
        await this.recordDeliveryAttempt({
          eventId,
          integration,
          endpointUrl: targetUrl,
          attempt: 1,
          status: 'failed',
          httpCode: undefined,
          durationMs,
          error: 'network_error'
        })
        return null
      }
      const ok = res.status >= 200 && res.status < 300
      await this.recordDeliveryAttempt({
        eventId,
        integration,
        endpointUrl: targetUrl,
        attempt: 1,
        status: ok ? 'success' : 'failed',
        httpCode: res.status,
        durationMs,
        requestHeaders: res.sentHeaders,
        responseBody: res.responseBody ?? null
      })
      return ok ? res : null
    } catch (error) {
      const durationMs = Date.now() - started
      await this.recordDeliveryAttempt({
        eventId,
        integration,
        endpointUrl: targetUrl,
        attempt: 1,
        status: 'failed',
        httpCode: undefined,
        durationMs,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  },

  async listDeliveries(integrationId: string, limit = 50) {
    if (!hasDatabase()) return []
    const db = getDb()
    return await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.integrationId, integrationId))
      .orderBy(desc(webhookDeliveries.createdAt as any))
      .limit(limit)
  },

  async prune(retentionDays = 90) {
    if (!hasDatabase()) return
    const db = getDb()
    // Drizzle lacks interval literal; compute cutoff in JS
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    // delete deliveries older than cutoff; events cascade via FK only when no deliveries left
    try {
      const iso = cutoff.toISOString()
      // @ts-ignore driver-specific execute
      await db.execute(`delete from webhook_deliveries where created_at < '${iso}'::timestamptz`)
    } catch {}
    try {
      const iso = cutoff.toISOString()
      // prune orphaned events older than cutoff
      // @ts-ignore driver-specific execute
      await db.execute(
        `delete from webhook_events e where e.created_at < '${iso}'::timestamptz and not exists (select 1 from webhook_deliveries d where d.event_id = e.id)`
      )
    } catch {}
  }
}

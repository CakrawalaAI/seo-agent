import type { CMSConnector, PublishResult } from '../../shared/interface'
import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import { webhookService } from '@entities/webhook/service'
import { getPublishContext } from '@features/integrations/server/context'

type WebhookConfig = IntegrationConfig & {
  targetUrl?: string
  secret?: string
}

const webhookConnector: CMSConnector = {
  name: 'Webhook',
  type: 'webhook',
  async publish(article: Article, config: WebhookConfig): Promise<PublishResult | null> {
    const ctx = getPublishContext()
    const integrationId = String(ctx.integrationId || '')
    const websiteId = String(ctx.websiteId || (article as any).websiteId || '')
    if (!integrationId || !websiteId) return null
    const integration: any = { id: integrationId, websiteId }
    const event: 'article.published' | 'article.updated' = (String((article as any)?.status || '').toLowerCase() === 'published') ? 'article.updated' : 'article.published'
    const res = await webhookService.deliverArticleEvent(
      integration,
      { targetUrl: config?.targetUrl, secret: config?.secret ?? null, subscribedEvents: (config as any)?.subscribedEvents ?? null, scheduleMode: (config as any)?.scheduleMode ?? 'both' },
      article,
      event,
      (ctx?.trigger as any) || null
    )
    return res ? { externalId: res.externalId, url: res.url } : null
  },
  async test(config: WebhookConfig): Promise<boolean> {
    const targetUrl = String(config?.targetUrl || '').trim()
    if (!targetUrl) return false
    try {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'seo-agent-test', ts: Date.now() })
      })
      return resp.ok
    } catch {
      return false
    }
  }
}

export const connectors: CMSConnector[] = [webhookConnector]

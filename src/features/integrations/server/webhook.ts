import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import type { CMSConnector, PublishResult, PortableArticle } from './interface'
import { buildPortableArticle } from './interface'
import { log } from '@src/common/logger'

/**
 * Webhook connector implementation.
 * Publishes articles to arbitrary webhook endpoints with HMAC signature.
 */
class WebhookConnector implements CMSConnector {
  readonly name = 'Webhook'
  readonly type = 'webhook'

  async publish(article: Article, config: IntegrationConfig): Promise<PublishResult | null> {
    const targetUrl = config.targetUrl
    const secret = config.secret as string | undefined

    if (!targetUrl) {
      log.error('[Webhook] targetUrl is required in config')
      return null
    }

    const payload = buildPortableArticle(article)
    const body = JSON.stringify(payload)

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'X-SEOA-Idempotency': article.id,
      'X-SEOA-Source': 'seo-agent'
    }

    if (secret) {
      headers['X-SEOA-Signature'] = this.signHmacSha256(body, secret)
    }

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body
      })

      if (!res.ok) {
        log.error(`[Webhook] HTTP ${res.status}: ${res.statusText}`)
        return null
      }

      const data = (await res.json()) as { externalId?: string; url?: string }
      return {
        externalId: data.externalId ?? `webhook_${article.id}`,
        url: data.url ?? undefined
      }
    } catch (error) {
      log.error('[Webhook] Publish failed:', error)
      return null
    }
  }

  async test(config: IntegrationConfig): Promise<boolean> {
    const targetUrl = config.targetUrl
    if (!targetUrl) return false

    const payload = { test: true, timestamp: new Date().toISOString() }
    const body = JSON.stringify(payload)

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'X-SEOA-Test': 'true'
    }

    if (config.secret) {
      headers['X-SEOA-Signature'] = this.signHmacSha256(body, config.secret as string)
    }

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * Sign payload with HMAC-SHA256.
   * Returns signature in format: "sha256=<hex>"
   */
  private signHmacSha256(body: string, secret: string): string {
    try {
      const crypto = require('node:crypto') as typeof import('node:crypto')
      const hmac = crypto.createHmac('sha256', secret)
      hmac.update(body)
      return `sha256=${hmac.digest('hex')}`
    } catch (error) {
      log.error('[Webhook] HMAC signing failed:', error)
      return ''
    }
  }
}

/**
 * Singleton webhook connector instance.
 */
export const webhookConnector = new WebhookConnector()

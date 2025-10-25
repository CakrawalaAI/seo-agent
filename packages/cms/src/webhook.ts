import { createHmac } from 'node:crypto'
import { PortableArticle } from '@seo-agent/domain'

export type WebhookDeliveryPayload = {
  targetUrl: string
  secret: string
  article: PortableArticle
  articleId: string
  projectId: string
  integrationId: string
  event?: string
  idempotencyKey?: string
}

export type WebhookDeliveryResult = {
  externalId?: string
  url?: string
  raw?: unknown
}

const EVENT_NAME_DEFAULT = 'article.publish'

export const buildTestPortableArticle = (projectName?: string): PortableArticle => {
  const title = `SEO Agent test publish for ${projectName ?? 'project'}`
  const excerpt = 'Verification ping from SEO Agent to confirm webhook connectivity.'
  const bodyHtml = `<article><p>${excerpt}</p><p>This is a test event to ensure your integration is configured correctly.</p></article>`
  return {
    title,
    excerpt,
    bodyHtml,
    outline: [
      {
        heading: 'What to expect',
        subpoints: ['This is only a test payload', 'No action is required']
      }
    ],
    locale: 'en-US',
    slug: 'seo-agent-test-publish',
    seo: {
      metaTitle: title,
      metaDescription: excerpt
    }
  }
}

export const deliverWebhookPublish = async (
  payload: WebhookDeliveryPayload
): Promise<WebhookDeliveryResult> => {
  const bodyPayload = {
    article: payload.article,
    articleId: payload.articleId,
    projectId: payload.projectId,
    integrationId: payload.integrationId,
    event: payload.event ?? EVENT_NAME_DEFAULT
  }

  const body = JSON.stringify(bodyPayload)
  const signature = createHmac('sha256', payload.secret).update(body).digest('hex')
  const idempotencyKey = payload.idempotencyKey ?? `article:${payload.articleId}`

  const response = await fetch(payload.targetUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-SEOA-Signature': signature,
      'X-SEOA-Idempotency': idempotencyKey,
      'X-SEOA-Event': payload.event ?? EVENT_NAME_DEFAULT,
      'X-SEOA-Project-Id': payload.projectId,
      'X-SEOA-Integration-Id': payload.integrationId
    },
    body
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Webhook publish failed with ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`
    )
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    const json = (await response.json().catch(() => null)) as
      | { externalId?: string; url?: string }
      | null
    if (json) {
      return {
        externalId: json.externalId ?? (json as any)?.id,
        url: json.url ?? (json as any)?.link,
        raw: json
      }
    }
  }

  return {}
}

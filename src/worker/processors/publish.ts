import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { publishViaWebhook } from '@common/publishers/webhook'
import { publishViaWebflow } from '@common/publishers/webflow'

export async function processPublish(payload: { articleId: string; integrationId: string }) {
  const article = articlesRepo.get(payload.articleId)
  const integration = integrationsRepo.get(payload.integrationId)
  if (!article || !integration) return

  let result: { externalId?: string; url?: string } | null = null
  if (integration.type === 'webhook') {
    result = await publishViaWebhook({
      article,
      targetUrl: String(integration.configJson?.targetUrl ?? ''),
      secret: (integration.configJson as any)?.secret ?? null
    })
  } else if (integration.type === 'webflow') {
    result = await publishViaWebflow({
      article,
      siteId: String((integration.configJson as any)?.siteId ?? ''),
      collectionId: String((integration.configJson as any)?.collectionId ?? ''),
      draft: Boolean((integration.configJson as any)?.draft)
    })
  } else {
    result = { externalId: `ext_${article.id}`, url: `https://example.com/published/${article.id}` }
  }

  articlesRepo.update(article.id, {
    status: 'published',
    cmsExternalId: result?.externalId ?? null,
    url: result?.url ?? null,
    publicationDate: new Date().toISOString()
  })
}


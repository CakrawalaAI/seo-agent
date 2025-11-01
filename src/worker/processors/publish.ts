import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { connectorRegistry } from '@common/connectors/registry'
import * as bundle from '@common/bundle/store'

/**
 * Publish processor: publishes an article via the specified integration.
 * Uses the connector registry to dispatch to the appropriate CMS connector.
 */
export async function processPublish(payload: { articleId: string; integrationId: string }) {
  const article = await articlesRepo.get(payload.articleId)
  const integration = await integrationsRepo.get(payload.integrationId)

  if (!article || !integration) {
    console.error('[Publish] Article or integration not found', { articleId: payload.articleId, integrationId: payload.integrationId })
    return
  }

  // Publish via connector registry
  const result = await connectorRegistry.publish(
    integration.type,
    article,
    integration.configJson ?? {}
  )

  if (!result) {
    console.error('[Publish] Connector failed to publish article', { articleId: article.id, type: integration.type })
    // Don't update status if publish failed - keep as draft for retry
    return
  }

  // Update article with publish result
  await articlesRepo.update(article.id, {
    status: 'published',
    cmsExternalId: result.externalId ?? null,
    url: result.url ?? null,
    publicationDate: new Date().toISOString()
  })

  // Record in bundle
  try {
    bundle.writeJson(article.projectId, `articles/published/${article.id}.json`, {
      externalId: result.externalId,
      url: result.url,
      metadata: result.metadata,
      publishedAt: new Date().toISOString()
    })
    bundle.appendLineage(article.projectId, {
      node: 'publish',
      outputs: { articleId: article.id, url: result.url ?? null }
    })
  } catch (error) {
    console.error('[Publish] Failed to write bundle', error)
  }
}

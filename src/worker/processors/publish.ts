import { articlesRepo } from '@entities/article/repository'
import { connectorRegistry } from '@features/integrations/server/registry'
import { log } from '@src/common/logger'
import { ConnectorNotReadyError } from '@features/integrations/shared/errors'

/**
 * Publish processor: publishes an article via the specified integration.
 * Uses the connector registry to dispatch to the appropriate CMS connector.
 */
export async function processPublish(payload: { articleId: string; integrationId: string }) {
  const article = await articlesRepo.get(payload.articleId)
  // fetch integration configuration directly; publish jobs should ideally include the config payload
  const integration = await (async () => {
    try {
      const { getDb, hasDatabase } = await import('@common/infra/db')
      const { integrations } = await import('@entities/integration/db/schema.integrations')
      const { eq } = await import('drizzle-orm')
      if (!hasDatabase()) return null
      const db = getDb()
      const rows = await db.select().from(integrations).where(eq(integrations.id, payload.integrationId)).limit(1)
      return rows?.[0] ?? null
    } catch { return null }
  })()

  if (!article || !integration) {
    log.error('[Publish] Article or integration not found', { articleId: payload.articleId, integrationId: payload.integrationId })
    return
  }

  // Publish via connector registry
  let cfg: any = integration.configJson ?? {}
  try { if (typeof cfg === 'string') cfg = JSON.parse(cfg) } catch {}
  let result
  try {
    result = await connectorRegistry.publish(integration.type, article, cfg)
  } catch (error) {
    if (error instanceof ConnectorNotReadyError) {
      log.warn('[Publish] Connector not ready', {
        articleId: article.id,
        type: integration.type,
        message: error.message,
        docsUrl: error.connector.docsUrl
      })
      return
    }
    log.error('[Publish] Connector threw error', { articleId: article.id, type: integration.type, error })
    return
  }

  if (!result) {
    log.error('[Publish] Connector failed to publish article', { articleId: article.id, type: integration.type })
    // Don't update status if publish failed - keep as draft for retry
    return
  }

  // Update article with publish result
  await articlesRepo.update(article.id, {
    status: 'published',
    cmsExternalId: result.externalId ?? null,
    url: result.url ?? null,
    publishDate: new Date().toISOString()
  })

  // Bundle recording disabled in DB-only mode
}

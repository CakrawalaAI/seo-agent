import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import type { CMSConnector, PublishResult } from './interface'
import { buildPortableArticle, slugify } from './interface'

/**
 * Webflow connector configuration.
 * Extends IntegrationConfig with Webflow-specific fields.
 */
type WebflowConfig = IntegrationConfig & {
  /** Webflow API token (required) */
  apiToken?: string
  /** Webflow site ID (required) */
  siteId?: string
  /** Webflow CMS collection ID (required) */
  collectionId?: string
  /** Publish immediately (default: false = draft) */
  publish?: boolean
  /** Field mapping overrides (optional) */
  fieldMapping?: {
    titleField?: string // Default: "name"
    bodyField?: string // Default: "post-body"
    slugField?: string // Default: "slug"
    excerptField?: string // Default: "post-summary"
  }
}

/**
 * Webflow CMS API v2 connector implementation.
 * Docs: https://docs.developers.webflow.com/v2.0.0/reference/cms
 */
class WebflowConnector implements CMSConnector {
  readonly name = 'Webflow'
  readonly type = 'webflow'

  private readonly baseUrl = 'https://api.webflow.com/v2'

  async publish(article: Article, config: IntegrationConfig): Promise<PublishResult | null> {
    const wfConfig = config as WebflowConfig

    if (!wfConfig.apiToken || !wfConfig.siteId || !wfConfig.collectionId) {
      console.error('[Webflow] Missing required config: apiToken, siteId, collectionId')
      return null
    }

    const portable = buildPortableArticle(article)

    // Build field mapping (defaults to Webflow CMS standard field names)
    const fieldMapping = wfConfig.fieldMapping ?? {}
    const titleField = fieldMapping.titleField ?? 'name'
    const bodyField = fieldMapping.bodyField ?? 'post-body'
    const slugField = fieldMapping.slugField ?? 'slug'
    const excerptField = fieldMapping.excerptField ?? 'post-summary'

    // Build CMS item payload
    const payload = {
      fieldData: {
        [titleField]: portable.title ?? 'Untitled',
        [slugField]: portable.slug ?? slugify(portable.title ?? `article-${article.id}`),
        [bodyField]: portable.bodyHtml ?? '',
        [excerptField]: portable.excerpt ?? ''
      }
    }

    try {
      // 1. Create CMS item (always creates as draft)
      const createUrl = `${this.baseUrl}/collections/${wfConfig.collectionId}/items`
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${wfConfig.apiToken}`,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!createRes.ok) {
        const error = await createRes.text()
        console.error(`[Webflow] Create failed (${createRes.status}):`, error)
        return null
      }

      const createData = (await createRes.json()) as {
        id: string
        slug?: string
        fieldData?: { slug?: string }
      }

      const itemId = createData.id
      const itemSlug = createData.slug ?? createData.fieldData?.slug ?? payload.fieldData[slugField]

      // 2. Publish item if requested
      if (wfConfig.publish) {
        const publishUrl = `${this.baseUrl}/collections/${wfConfig.collectionId}/items/publish`
        const publishRes = await fetch(publishUrl, {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${wfConfig.apiToken}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ itemIds: [itemId] })
        })

        if (!publishRes.ok) {
          console.warn(`[Webflow] Publish failed (${publishRes.status}), item created as draft`)
        }
      }

      // 3. Build public URL (Webflow domain structure varies, this is a best-effort)
      const url = itemSlug
        ? `https://${wfConfig.siteId}.webflow.io/${itemSlug}`
        : `https://${wfConfig.siteId}.webflow.io/cms/${itemId}`

      return {
        externalId: itemId,
        url,
        metadata: {
          published: wfConfig.publish ?? false,
          slug: itemSlug
        }
      }
    } catch (error) {
      console.error('[Webflow] Publish failed:', error)
      return null
    }
  }

  async test(config: IntegrationConfig): Promise<boolean> {
    const wfConfig = config as WebflowConfig

    if (!wfConfig.apiToken || !wfConfig.siteId || !wfConfig.collectionId) {
      return false
    }

    try {
      // Test by fetching collection info
      const url = `${this.baseUrl}/collections/${wfConfig.collectionId}`
      const res = await fetch(url, {
        headers: {
          'authorization': `Bearer ${wfConfig.apiToken}`,
          'accept': 'application/json'
        }
      })

      return res.ok
    } catch {
      return false
    }
  }
}

/**
 * Singleton Webflow connector instance.
 */
export const webflowConnector = new WebflowConnector()

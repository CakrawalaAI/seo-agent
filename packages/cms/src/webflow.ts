import { PortableArticle, WebflowIntegrationConfig } from '@seo-agent/domain'

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2'

type WebflowField = {
  id?: string
  slug?: string
  key?: string
  name?: string
  displayName?: string
}

type WebflowCollectionResponse = {
  collection?: {
    id?: string
    name?: string
    fields?: WebflowField[]
  }
  id?: string
  name?: string
  fields?: WebflowField[]
}

type PublishResponse = {
  item?: {
    id?: string
    slug?: string
    url?: string
    _id?: string
    _slug?: string
  }
  id?: string
  slug?: string
  url?: string
  _id?: string
  _slug?: string
}

const buildHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
})

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const resolveFirstImage = (article: PortableArticle) => {
  const images = article.media?.images ?? []
  if (!Array.isArray(images) || images.length === 0) {
    return undefined
  }
  const [first] = images
  if (!first) return undefined
  return first.src
}

const nonEmpty = (value: unknown) => value !== undefined && value !== null && value !== ''

const buildFieldData = (
  article: PortableArticle,
  config: WebflowIntegrationConfig
): { fieldData: Record<string, unknown>; slug: string } => {
  const { fieldMapping } = config
  const slug =
    (fieldMapping.slug ? article.slug ?? undefined : undefined) ?? slugify(article.title ?? 'article')

  const fieldData: Record<string, unknown> = {}
  if (fieldMapping.name) {
    fieldData[fieldMapping.name] = article.title
  }
  if (fieldMapping.slug) {
    fieldData[fieldMapping.slug] = slug
  }
  if (fieldMapping.body) {
    fieldData[fieldMapping.body] = article.bodyHtml
  }
  if (fieldMapping.excerpt && nonEmpty(article.excerpt)) {
    fieldData[fieldMapping.excerpt] = article.excerpt
  }
  if (fieldMapping.seoTitle) {
    fieldData[fieldMapping.seoTitle] = article.seo?.metaTitle ?? article.title
  }
  if (fieldMapping.seoDescription && nonEmpty(article.seo?.metaDescription ?? article.excerpt)) {
    fieldData[fieldMapping.seoDescription] = article.seo?.metaDescription ?? article.excerpt
  }
  if (fieldMapping.tags && Array.isArray(article.tags) && article.tags.length > 0) {
    fieldData[fieldMapping.tags] = article.tags
  }
  if (fieldMapping.mainImage) {
    const image = resolveFirstImage(article)
    if (image) {
      fieldData[fieldMapping.mainImage] = image
    }
  }

  return { fieldData, slug }
}

const parseCollectionFields = (payload: WebflowCollectionResponse): WebflowField[] => {
  if (Array.isArray(payload?.fields)) {
    return payload.fields
  }
  if (Array.isArray(payload?.collection?.fields)) {
    return payload.collection.fields as WebflowField[]
  }
  return []
}

const fieldMatchesKey = (field: WebflowField, key: string) => {
  const normalized = key.trim().toLowerCase()
  if (!normalized) return false
  return (
    field.slug?.toLowerCase() === normalized ||
    field.id?.toLowerCase() === normalized ||
    field.key?.toLowerCase() === normalized ||
    field.name?.toLowerCase() === normalized
  )
}

export const fetchWebflowCollection = async (config: WebflowIntegrationConfig) => {
  const response = await fetch(`${WEBFLOW_API_BASE}/collections/${config.collectionId}`, {
    method: 'GET',
    headers: buildHeaders(config.accessToken)
  })

  if (!response.ok) {
    const message = `Webflow collection fetch failed with ${response.status} ${response.statusText}`
    throw new Error(message)
  }

  const json = (await response.json()) as WebflowCollectionResponse
  const fields = parseCollectionFields(json)
  const name = json?.collection?.name ?? json?.name ?? config.collectionId
  return { name, fields }
}

export const validateWebflowFieldMapping = (
  config: WebflowIntegrationConfig,
  fields: WebflowField[]
) => {
  const missing: string[] = []
  const required: Array<{ key: keyof WebflowIntegrationConfig['fieldMapping']; label: string }> = [
    { key: 'name', label: 'Title field' },
    { key: 'body', label: 'Body field' }
  ]

  for (const item of required) {
    const key = config.fieldMapping[item.key]
    if (!key) {
      missing.push(item.label)
      continue
    }
    if (fields.length > 0) {
      const found = fields.some((field) => fieldMatchesKey(field, key))
      if (!found) {
        missing.push(`${item.label} (${key})`)
      }
    }
  }

  const optionalKeys: Array<{ key: keyof WebflowIntegrationConfig['fieldMapping']; label: string }> =
    [
      { key: 'slug', label: 'Slug field' },
      { key: 'excerpt', label: 'Summary field' },
      { key: 'seoTitle', label: 'SEO title field' },
      { key: 'seoDescription', label: 'SEO description field' },
      { key: 'tags', label: 'Tags field' },
      { key: 'mainImage', label: 'Main image field' }
    ]

  const warnings: string[] = []
  for (const item of optionalKeys) {
    const key = config.fieldMapping[item.key]
    if (!key) continue
    if (fields.length === 0) continue
    const found = fields.some((field) => fieldMatchesKey(field, key))
    if (!found) {
      warnings.push(`${item.label} (${key})`)
    }
  }

  return { missing, warnings }
}

export const publishArticleToWebflow = async (
  config: WebflowIntegrationConfig,
  article: PortableArticle
) => {
  const { fieldData, slug } = buildFieldData(article, config)
  const payload: Record<string, unknown> = {
    fieldData,
    isArchived: false,
    isDraft: config.publishMode !== 'live'
  }
  if (config.cmsLocaleId) {
    payload.cmsLocaleIds = [config.cmsLocaleId]
  }

  const segment = config.publishMode === 'live' ? 'items/live' : 'items'
  const response = await fetch(
    `${WEBFLOW_API_BASE}/collections/${config.collectionId}/${segment}`,
    {
      method: 'POST',
      headers: buildHeaders(config.accessToken),
      body: JSON.stringify(payload)
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const message = `Webflow publish failed with ${response.status} ${response.statusText}${
      text ? `: ${text.slice(0, 200)}` : ''
    }`
    throw new Error(message)
  }

  const json = (await response.json().catch(() => ({}))) as PublishResponse
  const item = json.item ?? json
  const itemId = item?.id ?? item?._id ?? ''
  const itemSlug = item?.slug ?? item?._slug ?? slug
  const itemUrl = item?.url

  return {
    itemId,
    slug: itemSlug,
    url: itemUrl
  }
}

import type { Article } from '@entities/article/domain/article'

export async function publishViaWebflow(options: {
  article: Article
  siteId: string
  collectionId: string
  draft?: boolean
}): Promise<{ externalId?: string; url?: string }> {
  // Stub: emulate Webflow CMS item creation
  const slug = slugify(options.article.title ?? `article-${options.article.id}`)
  const url = `https://webflow.example/${options.siteId}/${options.collectionId}/${slug}`
  return { externalId: `wf_${options.article.id}`, url }
}

function slugify(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}


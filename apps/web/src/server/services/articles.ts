// @ts-nocheck
import type { Article, PaginatedResponse, UpdateArticleInput } from '@seo-agent/domain'
import { UpdateArticleInputSchema } from '@seo-agent/domain'
import { getDb, schema } from '../db'

export type ArticlePagination = {
  cursor?: string
  limit?: number
  status?: Article['status']
}

export const listArticles = async (
  projectId: string,
  pagination: ArticlePagination = {}
): Promise<PaginatedResponse<Article>> => {
  const db = getDb()
  const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 100)
  const cursorDate = pagination.cursor ? new Date(pagination.cursor) : null

  const rows = await db.query.articles.findMany({
    where: (table, { and, eq, lt }) =>
      and(
        eq(table.projectId, projectId),
        pagination.status ? eq(table.status, pagination.status) : undefined,
        cursorDate ? lt(table.createdAt, cursorDate) : undefined
      ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: limit + 1
  })

  const items = rows.slice(0, limit).map<Article>((row) => ({
    id: row.id,
    projectId: row.projectId,
    keywordId: row.keywordId,
    planItemId: row.planItemId ?? undefined,
    title: row.title,
    outlineJson: (row.outline ?? undefined) as Article['outlineJson'],
    bodyHtml: row.bodyHtml,
    language: row.language,
    tone: row.tone ?? undefined,
    mediaJson: (row.media ?? undefined) as Article['mediaJson'],
    seoScore: row.seoScore ? Number(row.seoScore) : null,
    status: row.status,
    cmsExternalId: row.cmsExternalId ?? undefined,
    url: row.url ?? undefined,
    generationDate: row.generationDate ?? undefined,
    publicationDate: row.publicationDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }))

  const nextCursor =
    rows.length > limit ? rows[limit]?.createdAt?.toISOString() ?? undefined : undefined

  return { items, nextCursor }
}

export const getArticle = async (articleId: string): Promise<Article | null> => {
  const db = getDb()
  const record = await db.query.articles.findFirst({
    where: (articles, { eq }) => eq(articles.id, articleId)
  })

  if (!record) return null

  return {
    id: record.id,
    projectId: record.projectId,
    keywordId: record.keywordId,
    planItemId: record.planItemId ?? undefined,
    title: record.title,
    outlineJson: (record.outline ?? undefined) as Article['outlineJson'],
    bodyHtml: record.bodyHtml,
    language: record.language,
    tone: record.tone ?? undefined,
    mediaJson: (record.media ?? undefined) as Article['mediaJson'],
    seoScore: record.seoScore ? Number(record.seoScore) : null,
    status: record.status,
    cmsExternalId: record.cmsExternalId ?? undefined,
    url: record.url ?? undefined,
    generationDate: record.generationDate ?? undefined,
    publicationDate: record.publicationDate ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

export const updateArticle = async (
  articleId: string,
  input: UpdateArticleInput
): Promise<Article | null> => {
  const db = getDb()
  const payload = UpdateArticleInputSchema.parse(input)

  const updatePayload: Partial<typeof schema.articles.$inferInsert> = {
    updatedAt: new Date()
  }

  if (payload.title !== undefined) {
    updatePayload.title = payload.title
  }
  if (payload.bodyHtml !== undefined) {
    updatePayload.bodyHtml = payload.bodyHtml
  }
  if (payload.language !== undefined) {
    updatePayload.language = payload.language
  }
  if (payload.tone !== undefined) {
    updatePayload.tone = payload.tone
  }
  if (payload.outlineJson !== undefined) {
    updatePayload.outline = payload.outlineJson
  }

  const [record] = await db
    .update(schema.articles)
    .set(updatePayload)
    .where((articles, { eq }) => eq(articles.id, articleId))
    .returning()

  if (!record) return null

  return {
    id: record.id,
    projectId: record.projectId,
    keywordId: record.keywordId,
    planItemId: record.planItemId ?? undefined,
    title: record.title,
    outlineJson: (record.outline ?? undefined) as Article['outlineJson'],
    bodyHtml: record.bodyHtml,
    language: record.language,
    tone: record.tone ?? undefined,
    mediaJson: (record.media ?? undefined) as Article['mediaJson'],
    seoScore: record.seoScore ? Number(record.seoScore) : null,
    status: record.status,
    cmsExternalId: record.cmsExternalId ?? undefined,
    url: record.url ?? undefined,
    generationDate: record.generationDate ?? undefined,
    publicationDate: record.publicationDate ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

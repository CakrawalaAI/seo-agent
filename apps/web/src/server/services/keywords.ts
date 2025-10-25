// @ts-nocheck
import { randomUUID } from 'node:crypto'
import { and, desc, eq, lt } from 'drizzle-orm'
import type { Keyword, PaginatedResponse } from '@seo-agent/domain'
import { CreateKeywordInputSchema, UpdateKeywordInputSchema } from '@seo-agent/domain'
import { getDb, schema } from '../db'

export type KeywordPagination = {
  cursor?: string
  limit?: number
  status?: Keyword['status']
}

export const listKeywords = async (
  projectId: string,
  pagination: KeywordPagination = {}
): Promise<PaginatedResponse<Keyword>> => {
  const db = getDb()
  const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 100)
  const cursorDate = pagination.cursor ? new Date(pagination.cursor) : null

  const clauses = [eq(schema.keywords.projectId, projectId)]
  if (pagination.status) {
    clauses.push(eq(schema.keywords.status, pagination.status))
  }
  if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
    clauses.push(lt(schema.keywords.createdAt, cursorDate))
  }

  const [firstClause, ...restClauses] = clauses
  const whereClause = restClauses.length ? and(firstClause, ...restClauses) : firstClause

  const rows = await db
    .select()
    .from(schema.keywords)
    .where(whereClause)
    .orderBy(desc(schema.keywords.isStarred), desc(schema.keywords.createdAt), desc(schema.keywords.id))
    .limit(limit + 1)

  const items = rows.slice(0, limit).map<Keyword>((row) => ({
    id: row.id,
    projectId: row.projectId,
    phrase: row.phrase,
    locale: row.locale,
    primaryTopic: row.primaryTopic ?? undefined,
    source: row.source,
    metricsJson: (row.metrics ?? undefined) as Keyword['metricsJson'],
    status: row.status,
    isStarred: Boolean((row as any).isStarred ?? false),
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString?.()
  }))

  const nextCursor =
    rows.length > limit ? rows[limit]?.createdAt?.toISOString() ?? undefined : undefined

  return {
    items,
    nextCursor
  }
}

export const createKeyword = async (input: {
  projectId: string
  phrase: string
  locale?: string
  primaryTopic?: string
  status?: Keyword['status']
  isStarred?: boolean
  metricsJson?: Keyword['metricsJson']
}): Promise<Keyword> => {
  const db = getDb()
  const parsed = CreateKeywordInputSchema.parse({
    projectId: input.projectId,
    phrase: input.phrase,
    locale: input.locale ?? 'en-US',
    primaryTopic: input.primaryTopic,
    status: input.status,
    isStarred: input.isStarred,
    metricsJson: input.metricsJson
  })

  const now = new Date()
  const [row] = await db
    .insert(schema.keywords)
    .values({
      id: randomUUID(),
      projectId: parsed.projectId,
      phrase: parsed.phrase,
      locale: parsed.locale,
      primaryTopic: parsed.primaryTopic ?? null,
      source: 'manual',
      metrics: parsed.metricsJson ?? null,
      status: parsed.status,
      isStarred: parsed.isStarred,
      createdAt: now,
      updatedAt: now
    })
    .returning()

  return {
    id: row.id,
    projectId: row.projectId,
    phrase: row.phrase,
    locale: row.locale,
    primaryTopic: row.primaryTopic ?? undefined,
    source: row.source,
    metricsJson: (row.metrics ?? undefined) as Keyword['metricsJson'],
    status: row.status,
    isStarred: row.isStarred ?? false,
    createdAt: row.createdAt?.toISOString?.() ?? now.toISOString(),
    updatedAt: row.updatedAt?.toISOString?.()
  }
}

export const updateKeyword = async (
  keywordId: string,
  input: Partial<{
    status: Keyword['status']
    primaryTopic?: string | null
    isStarred?: boolean
    metricsJson?: Keyword['metricsJson']
  }>
): Promise<Keyword | null> => {
  const db = getDb()
  const parsed = UpdateKeywordInputSchema.parse(input)
  const patch: Partial<typeof schema.keywords.$inferInsert> = {
    updatedAt: new Date()
  }
  if (parsed.status !== undefined) {
    patch.status = parsed.status
  }
  if (parsed.primaryTopic !== undefined) {
    patch.primaryTopic = parsed.primaryTopic ?? null
  }
  if (parsed.isStarred !== undefined) {
    patch.isStarred = parsed.isStarred
  }
  if (parsed.metricsJson !== undefined) {
    patch.metrics = parsed.metricsJson ?? null
  }

  const [row] = await db
    .update(schema.keywords)
    .set(patch)
    .where(eq(schema.keywords.id, keywordId))
    .returning()

  if (!row) {
    return null
  }

  return {
    id: row.id,
    projectId: row.projectId,
    phrase: row.phrase,
    locale: row.locale,
    primaryTopic: row.primaryTopic ?? undefined,
    source: row.source,
    metricsJson: (row.metrics ?? undefined) as Keyword['metricsJson'],
    status: row.status,
    isStarred: row.isStarred ?? false,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString?.()
  }
}

export const deleteKeyword = async (keywordId: string): Promise<boolean> => {
  const db = getDb()
  const result = await db
    .delete(schema.keywords)
    .where(eq(schema.keywords.id, keywordId))
    .returning({ id: schema.keywords.id })
  return result.length > 0
}

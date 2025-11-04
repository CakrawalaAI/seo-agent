import { hasDatabase, getDb } from '@common/infra/db'
import { keywordSerp } from './db/schema.serp_snapshot'
import { eq } from 'drizzle-orm'

export const keywordSerpRepo = {
  async get(articleId: string) {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(keywordSerp).where(eq(keywordSerp.articleId, articleId)).limit(1)
    return rows?.[0] ?? null
  },
  async upsert(input: { articleId: string; phrase: string; language: string; locationCode: number | string; device?: 'desktop'|'mobile'; topK?: number; snapshotJson: any; fetchedAt?: Date }) {
    if (!hasDatabase()) return null
    const db = getDb()
    const now = input.fetchedAt ? new Date(input.fetchedAt) : new Date()
    const existing = await this.get(input.articleId)
    if (existing) {
      await db.update(keywordSerp).set({ snapshotJson: input.snapshotJson, fetchedAt: now }).where(eq(keywordSerp.articleId, input.articleId))
      return await this.get(input.articleId)
    }
    await db.insert(keywordSerp).values({
      articleId: input.articleId,
      phrase: input.phrase,
      language: input.language,
      locationCode: String(input.locationCode),
      device: input.device || 'desktop',
      topK: String(input.topK ?? 10),
      fetchedAt: now,
      snapshotJson: input.snapshotJson
    } as any)
    return await this.get(input.articleId)
  }
}

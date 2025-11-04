import { hasDatabase, getDb } from '@common/infra/db'
import { integrations } from './db/schema.integrations'
import { eq, desc } from 'drizzle-orm'

export const integrationsRepo = {
  async list(websiteId: string) {
    if (!hasDatabase()) return []
    const db = getDb()
    return await db
      .select()
      .from(integrations)
      .where(eq(integrations.websiteId, websiteId))
      .orderBy(desc(integrations.createdAt as any))
      .limit(50)
  }
}

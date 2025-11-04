import { hasDatabase, getDb } from '@common/infra/db'
import { websiteIntegrations } from './db/schema.website'
import { eq, desc } from 'drizzle-orm'

export const websiteIntegrationsRepo = {
  async list(websiteId: string) {
    if (!hasDatabase()) return []
    const db = getDb()
    return await db
      .select()
      .from(websiteIntegrations)
      .where(eq(websiteIntegrations.websiteId, websiteId))
      .orderBy(desc(websiteIntegrations.createdAt as any))
      .limit(50)
  }
}


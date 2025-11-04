import type { Website } from './domain/website'
import { hasDatabase, getDb } from '@common/infra/db'
import { websites } from './db/schema'
import { eq, desc } from 'drizzle-orm'

export const websitesRepo = {
  async create(input: { orgId: string; url: string; defaultLocale?: string; summary?: string | null; settings?: Website['settings'] }): Promise<Website> {
    const now = new Date()
    const id = genId('site')
    const website: Website = {
      id,
      orgId: input.orgId,
      url: input.url,
      defaultLocale: input.defaultLocale || 'en-US',
      summary: input.summary ?? null,
      seedKeywords: null,
      status: 'crawled',
      settings: input.settings ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
    if (hasDatabase()) {
      const db = getDb()
      await db
        .insert(websites)
        .values({
          id: website.id,
          orgId: website.orgId,
          url: website.url,
          defaultLocale: website.defaultLocale,
          summary: website.summary ?? null,
          seedKeywords: website.seedKeywords ?? null,
          settingsJson: (website.settings as any) ?? null,
          status: website.status,
          createdAt: now as any,
          updatedAt: now as any
        } as any)
        .onConflictDoNothing?.()
    }
    return website
  },
  async get(id: string): Promise<Website | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(websites).where(eq(websites.id, id)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return {
      id: r.id,
      orgId: r.orgId,
      url: r.url,
      defaultLocale: r.defaultLocale,
      summary: r.summary ?? null,
      seedKeywords: r.seedKeywords ?? null,
      settings: (r as any).settingsJson ?? null,
      status: r.status,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt
    }
  },
  async list(params: { orgId?: string; limit?: number } = {}): Promise<Website[]> {
    const limit = params.limit && params.limit > 0 ? params.limit : 50
    if (!hasDatabase()) return []
    const db = getDb()
    // @ts-ignore
    const rows = await (params.orgId
      ? db.select().from(websites).where(eq(websites.orgId as any, params.orgId)).orderBy(desc(websites.createdAt)).limit(limit)
      : db.select().from(websites).orderBy(desc(websites.createdAt)).limit(limit))
    return rows.map((r: any) => ({
      id: r.id,
      orgId: r.orgId,
      url: r.url,
      defaultLocale: r.defaultLocale,
      summary: r.summary ?? null,
      seedKeywords: r.seedKeywords ?? null,
      settings: r.settingsJson ?? null,
      status: r.status,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt
    }))
  },
  async patch(id: string, input: Partial<Pick<Website, 'url' | 'defaultLocale' | 'summary' | 'status' | 'settings' | 'seedKeywords'>>): Promise<Website | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    for (const k of ['url', 'defaultLocale', 'summary', 'status'] as const) {
      const v = (input as any)[k]
      if (v !== undefined) set[k] = v as any
    }
    if ('settings' in input) set.settingsJson = (input as any).settings ?? null
    if ('seedKeywords' in input) set.seedKeywords = (input as any).seedKeywords ?? null
    await db.update(websites).set(set).where(eq(websites.id, id))
    return await this.get(id)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

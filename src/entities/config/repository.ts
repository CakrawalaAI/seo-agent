import { getDb, hasDatabase } from '@common/infra/db'
import { configs } from './db/schema.config'
import { and, eq } from 'drizzle-orm'

type ConfigScope = 'global' | 'website'

export type ConfigRecord<TValue = unknown> = {
  id: string
  scope: ConfigScope
  subjectId: string
  key: string
  valueJson: TValue | null
  createdAt: Date
  updatedAt: Date
}

export const configRepo = {
  async get<TValue = unknown>(scope: ConfigScope, key: string, websiteId?: string): Promise<ConfigRecord<TValue> | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const subjectId = scope === 'website' ? websiteId ?? null : 'global'
    if (scope === 'website' && !subjectId) return null
    const where = and(eq(configs.scope, scope), eq(configs.subjectId, subjectId!), eq(configs.key, key))
    const rows = await db.select().from(configs).where(where).limit(1)
    return (rows?.[0] as ConfigRecord<TValue> | undefined) ?? null
  },

  async set(scope: ConfigScope, key: string, value: unknown, websiteId?: string): Promise<void> {
    if (!hasDatabase()) return
    const db = getDb()
    const now = new Date() as any
    const id = genId('cfg')
    const scopeValue = scope
    const subjectId = scope === 'website' ? websiteId ?? null : 'global'
    if (scope === 'website' && !subjectId) throw new Error('websiteId required for website scope config')
    try {
      await db
        .insert(configs)
        .values({
          id,
          scope: scopeValue,
          subjectId: subjectId!,
          key,
          valueJson: value as any,
          createdAt: now,
          updatedAt: now
        } as any)
        .onConflictDoUpdate?.({
          target: [configs.scope, configs.subjectId, configs.key],
          set: { valueJson: value as any, updatedAt: now }
        })
    } catch {
      await db
        .update(configs)
        .set({ valueJson: value as any, updatedAt: now })
        .where(and(eq(configs.scope, scopeValue), eq(configs.subjectId, subjectId!), eq(configs.key, key)))
    }
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

import type { ProjectDiscovery, ProjectDiscoverySummary } from '../domain/discovery'
import { hasDatabase, getDb } from '@common/infra/db'
import { projectDiscoveries } from '../db/schema.discovery'
import { desc, eq } from 'drizzle-orm'

type RecordRunInput = {
  projectId: string
  summary?: ProjectDiscoverySummary | null
  seedPhrases?: string[] | null
  crawlDigest?: Record<string, unknown> | null
  providersUsed?: string[] | null
  seedCount?: number | null
  keywordCount?: number | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
}

export const projectDiscoveryRepo = {
  async recordRun(input: RecordRunInput): Promise<ProjectDiscovery | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const now = new Date()
    const id = genId('disc')
    const startedAt = input.startedAt ? new Date(input.startedAt) : now
    const completedAt = input.completedAt ? new Date(input.completedAt) : now
    const seedPhrases = Array.isArray(input.seedPhrases)
      ? Array.from(new Set(input.seedPhrases.filter(Boolean))).map((phrase) => String(phrase))
      : null
    const providers = Array.isArray(input.providersUsed)
      ? Array.from(new Set(input.providersUsed.filter(Boolean))).map((provider) => String(provider))
      : null
    const [row] = await db
      .insert(projectDiscoveries)
      .values({
        id,
        projectId: input.projectId,
        summaryJson: input.summary ?? null,
        seedJson: seedPhrases as any,
        crawlJson: input.crawlDigest ?? null,
        providersJson: providers as any,
        seedCount: Number.isFinite(input.seedCount) ? Number(input.seedCount) : (seedPhrases?.length ?? null),
        keywordCount: Number.isFinite(input.keywordCount) ? Number(input.keywordCount) : null,
        startedAt: startedAt as any,
        completedAt: completedAt as any,
        createdAt: now as any,
        updatedAt: now as any
      })
      .returning()
    return row ? toDomain(row) : null
  },

  async latest(projectId: string): Promise<ProjectDiscovery | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const [row] = await db
      .select()
      .from(projectDiscoveries)
      .where(eq(projectDiscoveries.projectId, projectId))
      .orderBy(desc(projectDiscoveries.createdAt))
      .limit(1)
    return row ? toDomain(row) : null
  },

  async list(projectId: string, limit = 10): Promise<ProjectDiscovery[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db
      .select()
      .from(projectDiscoveries)
      .where(eq(projectDiscoveries.projectId, projectId))
      .orderBy(desc(projectDiscoveries.createdAt))
      .limit(limit)
    return rows.map((row) => toDomain(row))
  }
}

function toDomain(row: any): ProjectDiscovery {
  return {
    id: row.id,
    projectId: row.projectId,
    summaryJson: (row.summaryJson || null) as ProjectDiscoverySummary | null,
    seedJson: Array.isArray(row.seedJson) ? (row.seedJson as string[]) : null,
    crawlJson: (row.crawlJson || null) as Record<string, unknown> | null,
    providersUsed: Array.isArray(row.providersJson) ? (row.providersJson as string[]) : null,
    seedCount: typeof row.seedCount === 'number' ? row.seedCount : null,
    keywordCount: typeof row.keywordCount === 'number' ? row.keywordCount : null,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

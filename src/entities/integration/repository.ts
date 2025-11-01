import type { ProjectIntegration } from './domain/integration'
import { hasDatabase, getDb } from '@common/infra/db'
import { projectIntegrations } from './db/schema'
import { eq, desc } from 'drizzle-orm'

export const integrationsRepo = {
  async create(input: { projectId: string; type: string; status?: string; configJson?: Record<string, unknown> | null }): Promise<ProjectIntegration> {
    const now = new Date()
    const integration: ProjectIntegration = {
      id: genId('int'),
      projectId: input.projectId,
      type: input.type,
      status: (input.status as any) ?? 'connected',
      configJson: input.configJson ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
    if (hasDatabase()) {
      const db = getDb()
      await db.insert(projectIntegrations).values({
        id: integration.id,
        projectId: integration.projectId,
        type: integration.type,
        status: integration.status as any,
        configJson: integration.configJson as any,
        createdAt: now as any,
        updatedAt: now as any
      } as any).onConflictDoNothing?.()
    }
    return integration
  },
  async get(id: string): Promise<ProjectIntegration | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(projectIntegrations).where(eq(projectIntegrations.id, id)).limit(1)
    return (rows?.[0] as any) ?? null
  },
  async list(projectId: string): Promise<ProjectIntegration[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    // @ts-ignore
    const rows = await db.select().from(projectIntegrations).where(eq(projectIntegrations.projectId as any, projectId)).orderBy(desc(projectIntegrations.createdAt as any)).limit(100)
    return rows as any
  },
  async update(id: string, patch: Partial<ProjectIntegration>): Promise<ProjectIntegration | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    if (patch.type !== undefined) set.type = patch.type
    if (patch.status !== undefined) set.status = patch.status as any
    if (patch.configJson !== undefined) set.configJson = patch.configJson as any
    await db.update(projectIntegrations).set(set).where(eq(projectIntegrations.id, id))
    return await this.get(id)
  },
  async remove(id: string): Promise<boolean> {
    if (!hasDatabase()) return false
    const db = getDb()
    await db.delete(projectIntegrations).where(eq(projectIntegrations.id, id))
    return true
  },
  async removeByProject(projectId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(projectIntegrations).where(eq(projectIntegrations.projectId as any, projectId))
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

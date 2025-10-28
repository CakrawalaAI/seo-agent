import type { ProjectIntegration } from './domain/integration'
import { hasDatabase, getDb } from '@common/infra/db'
import { projectIntegrations } from './db/schema'

const byProject = new Map<string, ProjectIntegration[]>()
const byId = new Map<string, ProjectIntegration>()

export const integrationsRepo = {
  create(input: { projectId: string; type: string; status?: string; configJson?: Record<string, unknown> | null }): ProjectIntegration {
    const now = new Date().toISOString()
    const integration: ProjectIntegration = {
      id: genId('int'),
      projectId: input.projectId,
      type: input.type,
      status: (input.status as any) ?? 'connected',
      configJson: input.configJson ?? null,
      createdAt: now,
      updatedAt: now
    }
    const list = byProject.get(input.projectId) ?? []
    byProject.set(input.projectId, [integration, ...list])
    byId.set(integration.id, integration)
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.insert(projectIntegrations).values(integration as any).onConflictDoNothing?.(); } catch {} })()
    return integration
  },
  get(id: string): ProjectIntegration | null {
    return byId.get(id) ?? null
  },
  list(projectId: string): ProjectIntegration[] {
    return byProject.get(projectId) ?? []
  },
  update(id: string, patch: Partial<ProjectIntegration>): ProjectIntegration | null {
    const current = byId.get(id)
    if (!current) return null
    const next: ProjectIntegration = { ...current, ...patch, updatedAt: new Date().toISOString() }
    byId.set(id, next)
    const list = byProject.get(next.projectId) ?? []
    const idx = list.findIndex((i) => i.id === id)
    if (idx >= 0) { list[idx] = next; byProject.set(next.projectId, list) }
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(projectIntegrations).set(next as any).where((projectIntegrations as any).id.eq(id)); } catch {} })()
    return next
  },
  remove(id: string): boolean {
    const cur = byId.get(id)
    if (!cur) return false
    const list = byProject.get(cur.projectId) ?? []
    byProject.set(cur.projectId, list.filter((i) => i.id !== id))
    byId.delete(id)
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.delete(projectIntegrations).where((projectIntegrations as any).id.eq(id)); } catch {} })()
    return true
  },
  removeByProject(projectId: string) {
    byProject.delete(projectId)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

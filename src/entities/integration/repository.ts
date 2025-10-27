import type { ProjectIntegration } from './domain/integration'

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
    return integration
  },
  get(id: string): ProjectIntegration | null {
    return byId.get(id) ?? null
  },
  list(projectId: string): ProjectIntegration[] {
    return byProject.get(projectId) ?? []
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}


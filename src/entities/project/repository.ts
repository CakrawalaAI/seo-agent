import type { Project } from './domain/project'

export type CreateProjectInput = {
  orgId: string
  name: string
  siteUrl: string
  defaultLocale: string
}

export type PatchProjectInput = Partial<
  Pick<Project, 'name' | 'defaultLocale' | 'siteUrl' | 'autoPublishPolicy' | 'status' | 'crawlMaxDepth' | 'crawlBudgetPages' | 'bufferDays' | 'serpDevice' | 'serpLocationCode' | 'metricsLocationCode'>
>

const store = new Map<string, Project>()

export const projectsRepo = {
  create(input: CreateProjectInput): Project {
    const now = new Date().toISOString()
    const id = genId('proj')
    const project: Project = {
      id,
      orgId: input.orgId,
      name: input.name,
      siteUrl: input.siteUrl,
      defaultLocale: input.defaultLocale,
      autoPublishPolicy: 'buffered',
      status: 'draft',
      serpDevice: 'desktop',
      serpLocationCode: 2840,
      metricsLocationCode: 2840,
      createdAt: now,
      updatedAt: now
    }
    store.set(id, project)
    return project
  },

  list(params: { orgId?: string; limit?: number } = {}): Project[] {
    const items = Array.from(store.values())
      .filter((p) => (params.orgId ? p.orgId === params.orgId : true))
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    const limit = params.limit && params.limit > 0 ? params.limit : 50
    return items.slice(-limit).reverse()
  },

  get(id: string): Project | null {
    return store.get(id) ?? null
  },

  patch(id: string, input: PatchProjectInput): Project | null {
    const current = store.get(id)
    if (!current) return null
    const updated: Project = {
      ...current,
      ...input,
      updatedAt: new Date().toISOString()
    }
    store.set(id, updated)
    return updated
  },
  remove(id: string): boolean {
    return store.delete(id)
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

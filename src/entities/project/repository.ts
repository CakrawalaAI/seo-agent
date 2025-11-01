import type { Project } from './domain/project'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from './db/schema'
import { eq, desc } from 'drizzle-orm'

export type CreateProjectInput = {
  orgId: string
  name: string
  siteUrl: string
  defaultLocale: string
}

export type PatchProjectInput = Partial<
  Pick<Project, 'name' | 'defaultLocale' | 'siteUrl' | 'autoPublishPolicy' | 'status' | 'crawlMaxDepth' | 'crawlBudgetPages' | 'bufferDays' | 'serpDevice' | 'serpLocationCode' | 'metricsLocationCode'>
>

export const projectsRepo = {
  async create(input: CreateProjectInput): Promise<Project> {
    const now = new Date()
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
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
    if (hasDatabase()) {
      const db = getDb()
      await db.insert(projects).values({
        id: project.id,
        name: project.name,
        defaultLocale: project.defaultLocale,
        orgId: project.orgId ?? null,
        siteUrl: project.siteUrl ?? null,
        autoPublishPolicy: project.autoPublishPolicy ?? null,
        status: project.status ?? 'draft',
        serpDevice: project.serpDevice ?? 'desktop',
        serpLocationCode: project.serpLocationCode ?? 2840,
        metricsLocationCode: project.metricsLocationCode ?? 2840,
        createdAt: now as any,
        updatedAt: now as any
      } as any).onConflictDoNothing?.()
    }
    return project
  },

  async list(params: { orgId?: string; limit?: number } = {}): Promise<Project[]> {
    const limit = params.limit && params.limit > 0 ? params.limit : 50
    if (!hasDatabase()) return []
    const db = getDb()
    // @ts-ignore
    const rows = await (params.orgId
      ? db.select().from(projects).where(eq(projects.orgId as any, params.orgId)).orderBy(desc(projects.createdAt)).limit(limit)
      : db.select().from(projects).orderBy(desc(projects.createdAt)).limit(limit))
    return rows.map((r: any) => ({
      id: r.id,
      orgId: r.orgId ?? undefined,
      name: r.name,
      siteUrl: r.siteUrl ?? undefined,
      defaultLocale: r.defaultLocale,
      autoPublishPolicy: r.autoPublishPolicy ?? undefined,
      status: r.status ?? 'draft',
      serpDevice: r.serpDevice ?? undefined,
      serpLocationCode: r.serpLocationCode ?? undefined,
      metricsLocationCode: r.metricsLocationCode ?? undefined,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt
    }))
  },

  async get(id: string): Promise<Project | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    const r: any = rows?.[0]
    if (!r) return null
    return {
      id: r.id,
      orgId: r.orgId ?? undefined,
      name: r.name,
      siteUrl: r.siteUrl ?? undefined,
      defaultLocale: r.defaultLocale,
      autoPublishPolicy: r.autoPublishPolicy ?? undefined,
      status: r.status ?? 'draft',
      serpDevice: r.serpDevice ?? undefined,
      serpLocationCode: r.serpLocationCode ?? undefined,
      metricsLocationCode: r.metricsLocationCode ?? undefined,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt
    }
  },

  async patch(id: string, input: PatchProjectInput): Promise<Project | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    for (const k of ['name', 'defaultLocale', 'siteUrl', 'autoPublishPolicy', 'status', 'crawlMaxDepth', 'crawlBudgetPages', 'bufferDays', 'serpDevice', 'serpLocationCode', 'metricsLocationCode'] as const) {
      const v = (input as any)[k]
      if (v !== undefined) set[k] = v as any
    }
    await db.update(projects).set(set).where(eq(projects.id, id))
    return await this.get(id)
  },

  async remove(id: string): Promise<boolean> {
    if (!hasDatabase()) return false
    const db = getDb()
    await db.delete(projects).where(eq(projects.id, id))
    return true
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

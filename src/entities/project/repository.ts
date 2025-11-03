import type { Project } from './domain/project'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from './db/schema'
import { orgs } from '@entities/org/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export type CreateProjectInput = {
  orgId: string
  name: string
  siteUrl: string
  defaultLocale: string
  serpLocationCode?: number
  metricsLocationCode?: number
  dfsLanguageCode?: string
  businessSummary?: string | null
  crawlBudget?: number | null
}

export type PatchProjectInput = Partial<
  Pick<
    Project,
    | 'name'
    | 'defaultLocale'
    | 'siteUrl'
    | 'autoPublishPolicy'
    | 'status'
    | 'bufferDays'
    | 'businessSummary'
    | 'crawlBudget'
    | 'workflowState'
    | 'discoveryApproved'
    | 'planningApproved'
    | 'serpDevice'
    | 'serpLocationCode'
    | 'metricsLocationCode'
    | 'dfsLanguageCode'
  >
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
      bufferDays: 3,
      businessSummary: input.businessSummary ?? null,
      crawlBudget: input.crawlBudget ?? 20,
      workflowState: 'pending_summary_approval',
      discoveryApproved: false,
      planningApproved: false,
      serpDevice: 'desktop',
      serpLocationCode: input.serpLocationCode ?? 2840,
      metricsLocationCode: input.metricsLocationCode ?? 2840,
      dfsLanguageCode: input.dfsLanguageCode ?? 'en',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
    if (hasDatabase()) {
      const db = getDb()
      if (project.orgId) {
        try {
          await db
            .insert(orgs)
            .values({ id: project.orgId, name: project.orgId, plan: 'starter' })
            .onConflictDoNothing?.()
        } catch {}
      }
      const insertProject = async () => {
        await db.insert(projects).values({
          id: project.id,
          name: project.name,
          defaultLocale: project.defaultLocale,
          orgId: project.orgId,
          siteUrl: project.siteUrl ?? null,
          autoPublishPolicy: project.autoPublishPolicy ?? null,
          status: project.status ?? 'draft',
          bufferDays: project.bufferDays ?? 3,
          businessSummary: project.businessSummary ?? null,
          crawlBudget: project.crawlBudget ?? 20,
          workflowState: project.workflowState ?? 'pending_summary_approval',
          discoveryApproved: project.discoveryApproved ?? false,
          planningApproved: project.planningApproved ?? false,
          serpDevice: project.serpDevice ?? 'desktop',
          serpLocationCode: project.serpLocationCode ?? 2840,
          metricsLocationCode: project.metricsLocationCode ?? 2840,
          dfsLanguageCode: project.dfsLanguageCode ?? 'en',
          createdAt: now as any,
          updatedAt: now as any
        } as any).onConflictDoNothing?.()
      }
      try {
        await insertProject()
      } catch (error: any) {
        if (String(error?.message || '').includes('dfs_language_code')) {
          await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dfs_language_code" text NOT NULL DEFAULT 'en'`)
          await insertProject()
        } else {
          throw error
        }
      }
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
      orgId: r.orgId,
      name: r.name,
      siteUrl: r.siteUrl ?? undefined,
      defaultLocale: r.defaultLocale,
      autoPublishPolicy: r.autoPublishPolicy ?? undefined,
      status: r.status ?? 'draft',
      bufferDays: typeof r.bufferDays === 'number' ? r.bufferDays : null,
      businessSummary: r.businessSummary ?? null,
      crawlBudget: typeof r.crawlBudget === 'number' ? r.crawlBudget : null,
      workflowState: r.workflowState ?? null,
      discoveryApproved: typeof r.discoveryApproved === 'boolean' ? r.discoveryApproved : null,
      planningApproved: typeof r.planningApproved === 'boolean' ? r.planningApproved : null,
      serpDevice: r.serpDevice ?? null,
      serpLocationCode: r.serpLocationCode ?? null,
      metricsLocationCode: r.metricsLocationCode ?? null,
      dfsLanguageCode: r.dfsLanguageCode ?? null,
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
      orgId: r.orgId,
      name: r.name,
      siteUrl: r.siteUrl ?? undefined,
      defaultLocale: r.defaultLocale,
      autoPublishPolicy: r.autoPublishPolicy ?? undefined,
      status: r.status ?? 'draft',
      bufferDays: typeof r.bufferDays === 'number' ? r.bufferDays : null,
      businessSummary: r.businessSummary ?? null,
      crawlBudget: typeof r.crawlBudget === 'number' ? r.crawlBudget : null,
      workflowState: r.workflowState ?? null,
      discoveryApproved: typeof r.discoveryApproved === 'boolean' ? r.discoveryApproved : null,
      planningApproved: typeof r.planningApproved === 'boolean' ? r.planningApproved : null,
      serpDevice: r.serpDevice ?? null,
      serpLocationCode: r.serpLocationCode ?? null,
      metricsLocationCode: r.metricsLocationCode ?? null,
      dfsLanguageCode: r.dfsLanguageCode ?? null,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt
    }
  },

  async patch(id: string, input: PatchProjectInput): Promise<Project | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    for (const k of [
      'name',
      'defaultLocale',
      'siteUrl',
      'autoPublishPolicy',
      'status',
      'bufferDays',
      'businessSummary',
      'crawlBudget',
      'workflowState',
      'discoveryApproved',
      'planningApproved',
      'serpDevice',
      'serpLocationCode',
      'metricsLocationCode',
      'dfsLanguageCode'
    ] as const) {
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

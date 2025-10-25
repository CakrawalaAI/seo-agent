// @ts-nocheck
// @ts-nocheck
import { and, eq, inArray } from 'drizzle-orm'
import { DEFAULT_BUFFER_DAYS } from '@seo-agent/domain'
import type { Project, ProjectSnapshot } from '@seo-agent/domain'
import { getDb, schema } from '../db'

export const getProject = async (projectId: string): Promise<Project | null> => {
  const db = getDb()
  const record = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId)
  })
  if (!record) return null
  return {
    id: record.id,
    orgId: record.orgId,
    name: record.name,
    siteUrl: record.siteUrl,
    defaultLocale: record.defaultLocale,
    brandingJson: record.branding as Project['brandingJson'],
    autoPublishPolicy: record.autoPublishPolicy ?? undefined,
    bufferDays: record.bufferDays ?? undefined,
    createdAt: record.createdAt.toISOString()
  }
}

export const listProjects = async (orgId?: string): Promise<Project[]> => {
  const db = getDb()
  const rows = await db.query.projects.findMany({
    where: orgId ? eq(schema.projects.orgId, orgId) : undefined,
    orderBy: (projects, { desc: descOp }) => [descOp(projects.createdAt)],
    limit: 100
  })

  return rows.map((record) => ({
    id: record.id,
    orgId: record.orgId,
    name: record.name,
    siteUrl: record.siteUrl,
    defaultLocale: record.defaultLocale,
    brandingJson: record.branding as Project['brandingJson'],
    autoPublishPolicy: record.autoPublishPolicy ?? undefined,
    bufferDays: record.bufferDays ?? undefined,
    createdAt: record.createdAt.toISOString()
  }))
}

export const getProjectSnapshot = async (projectId: string): Promise<ProjectSnapshot | null> => {
  const db = getDb()
  const project = await getProject(projectId)
  if (!project) return null

  const [integrations, planItems, latestDiscovery, queueDepth] = await Promise.all([
    db.query.integrations.findMany({
      where: eq(schema.integrations.projectId, projectId)
    }),
    db.query.planItems.findMany({
      where: eq(schema.planItems.projectId, projectId),
      orderBy: (pi, { asc }) => [asc(pi.plannedDate)],
      limit: 30
    }),
    db.query.discoveryRuns.findFirst({
      where: eq(schema.discoveryRuns.projectId, projectId),
      orderBy: (dr, { desc }) => [desc(dr.startedAt)]
    }),
    db
      .select({
        count: schema.jobs.id
      })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.projectId, projectId),
          inArray(schema.jobs.status, ['queued', 'running'])
        )
      )
      .then((rows) => Number(rows[0]?.count ?? 0))
  ])

  return {
    project,
    integrations: integrations.map((integration) => ({
      id: integration.id,
      projectId: integration.projectId,
      type: integration.type,
      configJson: integration.config as Record<string, unknown>,
      status: integration.status,
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt ? integration.updatedAt.toISOString() : undefined
    })),
    latestDiscovery: latestDiscovery
      ? {
          id: latestDiscovery.id,
          projectId: latestDiscovery.projectId,
          providersUsed: latestDiscovery.providersUsed as ProjectSnapshot['latestDiscovery']['providersUsed'],
          startedAt: latestDiscovery.startedAt.toISOString(),
          finishedAt: latestDiscovery.finishedAt?
            latestDiscovery.finishedAt.toISOString()
            : null,
          status: latestDiscovery.status,
          costMeterJson: latestDiscovery.costMeter as Record<string, unknown> | undefined,
          summaryJson: latestDiscovery.summary as Record<string, unknown>
        }
      : undefined,
    planItems: planItems.map((item) => ({
      id: item.id,
      projectId: item.projectId,
      keywordId: item.keywordId,
      plannedDate: item.plannedDate,
      title: item.title,
      outlineJson: item.outline as any,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    })),
    queueDepth
  }
}

export const updateProject = async (
  projectId: string,
  input: {
    defaultLocale?: string
    branding?: Project['brandingJson']
    autoPublishPolicy?: Project['autoPublishPolicy']
    bufferDays?: number
  }
): Promise<Project | null> => {
  const db = getDb()
  const payload: Partial<typeof schema.projects.$inferInsert> = {}

  if (input.defaultLocale) {
    payload.defaultLocale = input.defaultLocale
  }

  if (input.branding) {
    payload.branding = input.branding
  }

  if (input.autoPublishPolicy) {
    payload.autoPublishPolicy = input.autoPublishPolicy
  }

  if (input.bufferDays !== undefined) {
    payload.bufferDays = input.bufferDays
  }

  if (Object.keys(payload).length === 0) {
    return getProject(projectId)
  }

  const [record] = await db
    .update(schema.projects)
    .set({ ...payload, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId))
    .returning()

  if (!record) return null

  return {
    id: record.id,
    orgId: record.orgId,
    name: record.name,
    siteUrl: record.siteUrl,
    defaultLocale: record.defaultLocale,
    brandingJson: record.branding as Project['brandingJson'],
    autoPublishPolicy: record.autoPublishPolicy ?? undefined,
    bufferDays: record.bufferDays ?? undefined,
    createdAt: record.createdAt.toISOString()
  }
}

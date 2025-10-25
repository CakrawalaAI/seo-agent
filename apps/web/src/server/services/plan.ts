// @ts-nocheck
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type {
  CreatePlanRequest,
  PaginatedResponse,
  PlanItem,
  UpdatePlanItemInput
} from '@seo-agent/domain'
import { CreatePlanRequestSchema, PlanItemSchema, UpdatePlanItemSchema } from '@seo-agent/domain'
import { getDb, schema } from '../db'
import { getJobCoordinator } from '../jobs/coordinator'

type PlanPagination = {
  cursor?: string
  limit?: number
  status?: PlanItem['status']
  from?: string
  to?: string
}

const serializePlanItem = (row: typeof schema.planItems.$inferSelect): PlanItem =>
  PlanItemSchema.parse({
    id: row.id,
    projectId: row.projectId,
    keywordId: row.keywordId,
    plannedDate: row.plannedDate,
    title: row.title,
    outlineJson: (row.outline ?? []) as PlanItem['outlineJson'],
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  })

export const listPlanItems = async (
  projectId: string,
  pagination: PlanPagination = {}
): Promise<PaginatedResponse<PlanItem>> => {
  const db = getDb()
  const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 100)
  const rawCursor = pagination.cursor ? new Date(pagination.cursor) : null
  const cursorDate = rawCursor && !Number.isNaN(rawCursor.getTime()) ? rawCursor : null
  const rawFrom = pagination.from ? new Date(pagination.from) : null
  const fromDate = rawFrom && !Number.isNaN(rawFrom.getTime()) ? rawFrom : null
  const rawTo = pagination.to ? new Date(pagination.to) : null
  const toDate = rawTo && !Number.isNaN(rawTo.getTime()) ? rawTo : null

  const rows = await db.query.planItems.findMany({
    where: (table, { and, eq, gt, gte, lte }) =>
      and(
        eq(table.projectId, projectId),
        pagination.status ? eq(table.status, pagination.status) : undefined,
        fromDate ? gte(table.plannedDate, fromDate.toISOString().split('T')[0]) : undefined,
        toDate ? lte(table.plannedDate, toDate.toISOString().split('T')[0]) : undefined,
        cursorDate ? gt(table.plannedDate, cursorDate.toISOString().split('T')[0]) : undefined
      ),
    orderBy: (table, { asc }) => [asc(table.plannedDate), asc(table.id)],
    limit: limit + 1
  })

  const items = rows.slice(0, limit).map(serializePlanItem)

  const nextCursor =
    rows.length > limit ? rows[limit]?.plannedDate?.toString() ?? undefined : undefined

  return { items, nextCursor }
}

type PlanError = Error & { code?: string; status?: number }

const buildPlanError = (message: string, code: string, status: number): PlanError => {
  const error = new Error(message) as PlanError
  error.code = code
  error.status = status
  return error
}

export const createPlan = async (input: CreatePlanRequest) => {
  const payload = CreatePlanRequestSchema.parse(input)
  const db = getDb()

  const project = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.id, payload.projectId)
  })

  if (!project) {
    throw buildPlanError('Project not found', 'project_not_found', 404)
  }

  const keywordIds = Array.isArray(payload.keywordIds) ? payload.keywordIds : []

  const keywords = await db
    .select({ id: schema.keywords.id, phrase: schema.keywords.phrase })
    .from(schema.keywords)
    .where(
      keywordIds.length > 0
        ? and(
            eq(schema.keywords.projectId, payload.projectId),
            inArray(schema.keywords.id, keywordIds)
          )
        : eq(schema.keywords.projectId, payload.projectId)
    )
    .orderBy((keywords, { desc }) => [desc(keywords.isStarred), desc(keywords.createdAt)])

  if (keywordIds.length > 0 && keywords.length !== keywordIds.length) {
    throw buildPlanError('One or more keywords were not found', 'keyword_missing', 404)
  }

  if (keywords.length === 0) {
    throw buildPlanError('No keywords available for planning', 'keyword_missing', 400)
  }

  const coordinator = getJobCoordinator()
  const jobId = await coordinator.enqueue({
    projectId: payload.projectId,
    type: 'plan',
    payload: {
      projectId: payload.projectId,
      keywords: keywords.map((keyword) => keyword.phrase),
      keywordIds: keywords.map((keyword) => keyword.id),
      locale: project.defaultLocale,
      startDate: payload.startDate,
      days: payload.days
    }
  })

  return {
    jobId,
    projectId: payload.projectId,
    status: 'queued' as const
  }
}

export const updatePlanItem = async (
  planItemId: string,
  input: UpdatePlanItemInput
): Promise<PlanItem | null> => {
  const payload = UpdatePlanItemSchema.parse(input)
  const db = getDb()

  const update: Partial<typeof schema.planItems.$inferInsert> = {
    updatedAt: new Date()
  }

  if (payload.plannedDate !== undefined) {
    update.plannedDate = payload.plannedDate
  }
  if (payload.status !== undefined) {
    update.status = payload.status
  }
  if (payload.title !== undefined) {
    update.title = payload.title
  }
  if (payload.outlineJson !== undefined) {
    update.outline = payload.outlineJson
  }

  const [record] = await db
    .update(schema.planItems)
    .set(update)
    .where(eq(schema.planItems.id, planItemId))
    .returning()

  if (!record) {
    return null
  }

  return serializePlanItem(record)
}

// @ts-nocheck
import type { PaginatedResponse, PlanItem } from '@seo-agent/domain'
import { getDb, schema } from '../db'

type PlanPagination = {
  cursor?: string
  limit?: number
  status?: PlanItem['status']
  from?: string
  to?: string
}

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
    orderBy: (table, { asc }) => [asc(table.plannedDate)],
    limit: limit + 1
  })

  const items = rows.slice(0, limit).map<PlanItem>((row) => ({
    id: row.id,
    projectId: row.projectId,
    keywordId: row.keywordId,
    plannedDate: row.plannedDate,
    title: row.title,
    outlineJson: row.outline as PlanItem['outlineJson'],
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }))

  const nextCursor =
    rows.length > limit ? rows[limit]?.plannedDate?.toString() ?? undefined : undefined

  return { items, nextCursor }
}

// @ts-nocheck
import type { PaginatedResponse, PlanItem } from '@seo-agent/domain'
import { getDb, schema } from '../db'

type PlanPagination = {
  cursor?: string
  limit?: number
}

export const listPlanItems = async (
  projectId: string,
  pagination: PlanPagination = {}
): Promise<PaginatedResponse<PlanItem>> => {
  const db = getDb()
  const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 100)
  const cursorDate = pagination.cursor ? new Date(pagination.cursor) : null

  const rows = await db.query.planItems.findMany({
    where: (table, { and, eq, gt }) =>
      and(
        eq(table.projectId, projectId),
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

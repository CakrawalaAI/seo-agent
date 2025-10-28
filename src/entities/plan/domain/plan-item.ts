export type PlanItemStatus = 'planned' | 'draft' | 'published' | 'skipped' | string

export type PlanItem = {
  id: string
  projectId: string
  keywordId?: string | null
  title: string
  plannedDate: string
  status?: PlanItemStatus | null
  outlineJson?: Array<{ heading: string; subpoints?: string[] }> | null
  createdAt?: string | null
  updatedAt?: string | null
}

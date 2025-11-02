export type PlanItemStatus = 'draft' | 'generating' | 'ready' | 'published' | 'skipped' | 'failed' | string

export type PlanItem = {
  id: string
  projectId: string
  keywordId?: string | null
  title: string
  plannedDate: string
  language?: string | null
  tone?: string | null
  status?: PlanItemStatus | null
  bufferStage?: 'seed' | 'outline' | 'draft' | null
  outlineJson?: Array<{ heading: string; subpoints?: string[] }> | null
  createdAt?: string | null
  updatedAt?: string | null
}

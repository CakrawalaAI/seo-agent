export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | string

export type Job = {
  id: string
  projectId: string
  type: string
  status: JobStatus
  queuedAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  resultJson?: Record<string, unknown> | null
  errorJson?: Record<string, unknown> | null
}

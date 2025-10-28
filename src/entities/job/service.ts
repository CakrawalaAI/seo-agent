import { fetchJson, postJson } from '@common/http/json'
import type { Job } from './domain/job'

export function listJobs(projectId: string, limit = 25) {
  return fetchJson<{ items: Job[] }>(`/api/projects/${projectId}/jobs?limit=${limit}`)
}

export function enqueueJob(projectId: string, type: string, payload?: Record<string, unknown>) {
  return postJson<Job>(`/api/projects/${projectId}/jobs`, { type, payload })
}

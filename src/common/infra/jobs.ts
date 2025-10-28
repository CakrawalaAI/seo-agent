import type { Job } from '@entities/job/domain/job'
import { hasDatabase, getDb } from '@common/infra/db'
import { jobs as jobsTable } from '@entities/job/db/schema'

const store = new Map<string, Job[]>()
const byId = new Map<string, Job>()

function push(projectId: string, job: Job) {
  const list = store.get(projectId) ?? []
  store.set(projectId, [job, ...list].slice(0, 100))
  byId.set(job.id, job)
}

export function recordJobQueued(projectId: string, type: string, id: string) {
  const now = new Date().toISOString()
  const job: Job = { id, projectId, type, status: 'queued', retries: 0, queuedAt: now, startedAt: null, finishedAt: null, resultJson: null, errorJson: null }
  push(projectId, job)
  if (hasDatabase()) void (async () => { try { const db = getDb(); await db.insert(jobsTable).values(job as any).onConflictDoNothing?.(); } catch {} })()
}

export function recordJobRunning(projectId: string, id: string) {
  const list = store.get(projectId)
  if (!list) return
  const idx = list.findIndex((j) => j.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx]!, status: 'running', startedAt: new Date().toISOString() }
    byId.set(id, list[idx]!)
  }
  if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(jobsTable).set({ status: 'running', startedAt: new Date() as any } as any).where((jobsTable as any).id.eq(id)); } catch {} })()
}

export function recordJobCompleted(projectId: string, id: string, result?: Record<string, unknown>) {
  const list = store.get(projectId)
  if (!list) return
  const idx = list.findIndex((j) => j.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx]!, status: 'completed', finishedAt: new Date().toISOString(), resultJson: result ?? null }
    byId.set(id, list[idx]!)
  }
  if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(jobsTable).set({ status: 'completed', finishedAt: new Date() as any, resultJson: result ?? null } as any).where((jobsTable as any).id.eq(id)); } catch {} })()
}

export function recordJobFailed(projectId: string, id: string, error?: Record<string, unknown>) {
  const list = store.get(projectId)
  if (!list) return
  const idx = list.findIndex((j) => j.id === id)
  if (idx >= 0) {
    const retr = (list[idx] as any).retries ?? 0
    list[idx] = { ...list[idx]!, status: 'failed', finishedAt: new Date().toISOString(), errorJson: error ?? null, retries: (retr as any) + (1 as any) as any }
    byId.set(id, list[idx]!)
  }
  if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(jobsTable).set({ status: 'failed', finishedAt: new Date() as any, errorJson: error ?? null, retries: (store.get(projectId)?.find(j => j.id===id) as any)?.retries ?? 1 } as any).where((jobsTable as any).id.eq(id)); } catch {} })()
}

export function listJobs(projectId: string, limit = 25) {
  const list = store.get(projectId) ?? []
  return list.slice(0, limit)
}

export function getJob(id: string): Job | null {
  return byId.get(id) ?? null
}

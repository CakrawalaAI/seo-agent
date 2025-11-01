import type { Job } from '@entities/job/domain/job'
import { hasDatabase, getDb } from '@common/infra/db'
import { jobs as jobsTable } from '@entities/job/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function recordJobQueued(projectId: string, type: string, id: string) {
  const now = new Date()
  if (!hasDatabase()) return
  try {
    const db = getDb()
    await db
      .insert(jobsTable)
      .values({
        id,
        projectId,
        type,
        status: 'queued' as any,
        retries: 0,
        queuedAt: now as any,
        startedAt: null as any,
        finishedAt: null as any,
        resultJson: null as any,
        errorJson: null as any
      } as any)
      .onConflictDoNothing?.()
    console.info('[jobs] inserted', { id, projectId, type })
  } catch (err) {
    console.error('[jobs] insert failed', { id, projectId, type, error: (err as Error)?.message || String(err) })
  }
}

export async function recordJobRunning(_projectId: string, id: string) {
  if (!hasDatabase()) return
  try {
    const db = getDb()
    await db.update(jobsTable).set({ status: 'running' as any, startedAt: new Date() as any } as any).where(eq(jobsTable.id as any, id))
    console.info('[jobs] set running', { id })
  } catch (err) {
    console.error('[jobs] set running failed', { id, error: (err as Error)?.message || String(err) })
  }
}

export async function recordJobCompleted(_projectId: string, id: string, result?: Record<string, unknown>) {
  if (!hasDatabase()) return
  try {
    const db = getDb()
    await db.update(jobsTable).set({ status: 'completed' as any, finishedAt: new Date() as any, resultJson: (result ?? null) as any } as any).where(eq(jobsTable.id as any, id))
    console.info('[jobs] set completed', { id })
  } catch (err) {
    console.error('[jobs] set completed failed', { id, error: (err as Error)?.message || String(err) })
  }
}

export async function recordJobFailed(_projectId: string, id: string, error?: Record<string, unknown>) {
  if (!hasDatabase()) return
  try {
    const db = getDb()
    await db.update(jobsTable).set({ status: 'failed' as any, finishedAt: new Date() as any, errorJson: (error ?? null) as any } as any).where(eq(jobsTable.id as any, id))
    console.info('[jobs] set failed', { id })
  } catch (err) {
    console.error('[jobs] set failed failed', { id, error: (err as Error)?.message || String(err) })
  }
}

export async function listJobs(projectId: string, limit = 25): Promise<Job[]> {
  if (!hasDatabase()) return []
  try {
    const db = getDb()
    const rows = (await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.projectId as any, projectId))
      .orderBy(desc(jobsTable.queuedAt as any))
      .limit(Number.isFinite(limit) ? (limit as any) : 25)) as any
    return rows as Job[]
  } catch (err) {
    console.error('[jobs] list failed', { projectId, error: (err as Error)?.message || String(err) })
    return []
  }
}

export async function getJob(id: string): Promise<Job | null> {
  if (!hasDatabase()) return null
  try {
    const db = getDb()
    const rows = (await db.select().from(jobsTable).where(eq(jobsTable.id as any, id)).limit(1)) as any
    return rows?.[0] ?? null
  } catch (err) {
    console.error('[jobs] get failed', { id, error: (err as Error)?.message || String(err) })
    return null
  }
}

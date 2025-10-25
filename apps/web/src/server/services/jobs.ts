// @ts-nocheck
import { JobSchema, type Job, type JobStatus, type JobType } from '@seo-agent/domain'
import { and, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { getJobCoordinator } from '../jobs/coordinator'

const serializeJob = (record: typeof schema.jobs.$inferSelect): Job =>
  JobSchema.parse({
    id: record.id,
    projectId: record.projectId,
    type: record.type,
    payloadJson: (record.payload as Record<string, unknown>) ?? {},
    status: record.status,
    progressPct: record.progressPct ?? undefined,
    retries: record.retries,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
    logs: ((record.logs as Array<{ message: string; level?: string; timestamp?: string }>) ?? []).map(
      (entry) => ({
        message: entry.message ?? '',
        level: (entry.level as 'info' | 'warn' | 'error') ?? 'info',
        timestamp: entry.timestamp ?? new Date().toISOString()
      })
    )
  })

export const getJobById = async (id: string): Promise<Job | null> => {
  const coordinator = getJobCoordinator()
  const job = await coordinator.getJob(id)
  if (!job) return null
  return serializeJob(job)
}

export const listProjectJobs = async (
  projectId: string,
  filters: { type?: JobType; status?: JobStatus; limit?: number } = {}
): Promise<Job[]> => {
  const db = getDb()
  const clauses = [eq(schema.jobs.projectId, projectId)]
  if (filters.type) clauses.push(eq(schema.jobs.type, filters.type))
  if (filters.status) clauses.push(eq(schema.jobs.status, filters.status))
  const [first, ...rest] = clauses
  const whereClause = rest.length ? and(first, ...rest) : first

  const rows = await db
    .select()
    .from(schema.jobs)
    .where(whereClause)
    .orderBy((jobs, { desc }) => [desc(jobs.createdAt)])
    .limit(filters.limit ?? 20)

  return rows.map(serializeJob)
}

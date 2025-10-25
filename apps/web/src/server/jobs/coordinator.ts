// @ts-nocheck
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Database } from '@seo-agent/db'
import { schema } from '../db'
import type { JobStatus, ProjectScopedJob } from '@seo-agent/domain'
import { getDb } from '../db'
import { getJobQueue, type JobQueue } from '@seo-agent/platform'

type QueueLike = JobQueue

export class JobCoordinator {
  private readonly db: Database
  private readonly queue: QueueLike

  constructor(options?: { queue?: QueueLike; db?: Database }) {
    this.db = options?.db ?? getDb()
    this.queue = options?.queue ?? getJobQueue()
    this.attachListeners()
  }

  private attachListeners() {
    this.queue.on('started', (job) => {
      void this.updateJob(job.id, {
        status: 'running',
        startedAt: job.startedAt ?? new Date(),
        updatedAt: job.updatedAt,
        attempts: job.attempts
      })
    })

    this.queue.on('succeeded', (job) => {
      void this.updateJob(job.id, {
        status: 'succeeded',
        finishedAt: job.finishedAt ?? new Date(),
        updatedAt: job.updatedAt
      })
    })

    this.queue.on('failed', (job) => {
      void this.updateJob(job.id, {
        status: 'failed',
        finishedAt: job.finishedAt ?? new Date(),
        updatedAt: job.updatedAt
      })
    })

    this.queue.on('released', (job) => {
      void this.updateJob(job.id, {
        status: 'queued',
        updatedAt: job.updatedAt,
        runAt: job.runAt
      })
    })
  }

  private async updateJob(
    id: string,
    values: Partial<{
      status: JobStatus
      startedAt?: Date
      finishedAt?: Date
      updatedAt?: Date
      runAt?: Date
      attempts?: number
    }>
  ) {
    await this.db
      .update(schema.jobs)
      .set({
        status: values.status,
        startedAt: values.startedAt,
        finishedAt: values.finishedAt,
        updatedAt: values.updatedAt ?? new Date(),
        retries: values.attempts ?? undefined
      })
      .where(eq(schema.jobs.id, id))
  }

  async enqueue(job: ProjectScopedJob & { id?: string }): Promise<string> {
    const id = job.id ?? randomUUID()
    const now = new Date()
    await this.db.insert(schema.jobs).values({
      id,
      projectId: job.projectId,
      type: job.type,
      payload: job.payload,
      status: 'queued',
      progressPct: 0,
      retries: 0,
      startedAt: null,
      finishedAt: null,
      logs: [],
      createdAt: now,
      updatedAt: now
    })
    await this.queue.enqueue({ ...job, id })
    return id
  }

  async reserveNext(projectId?: string, types?: ProjectScopedJob['type'][]) {
    return this.queue.reserveNext({ projectId, types })
  }

  async getJob(id: string) {
    const jobRecord = await this.db.query.jobs.findFirst({
      where: eq(schema.jobs.id, id)
    })
    return jobRecord
  }

  async listProjectJobs(projectId: string, type?: ProjectScopedJob['type']) {
    return this.db.query.jobs.findMany({
      where: (jobs, { eq: eqOp, and }) =>
        and(eqOp(jobs.projectId, projectId), type ? eqOp(jobs.type, type) : undefined),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
      limit: 50
    })
  }
}

let cachedCoordinator: JobCoordinator | null = null

export const getJobCoordinator = () => {
  if (!cachedCoordinator) {
    cachedCoordinator = new JobCoordinator()
  }
  return cachedCoordinator
}

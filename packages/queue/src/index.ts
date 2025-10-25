import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'eventemitter3'
import * as amqp from 'amqplib'

type Channel = amqp.Channel
type Connection = amqp.ChannelModel
type ConsumeMessage = amqp.ConsumeMessage
import {
  JobStatusSchema,
  ProjectScopedJobSchema,
  QueuePayloadSchemas,
  type JobStatus,
  type JobType,
  type ProjectScopedJob,
  type QueuePayloadFor
} from '@seo-agent/domain'

const now = () => new Date()
const MAX_PRIORITY = 9
const DEFAULT_EXCHANGE = 'seo-agent.jobs'
const DEFAULT_BINDING_KEY = 'project.*'
const DEFAULT_PREFETCH = 10

type Logger = (level: 'info' | 'error', message: string, meta?: Record<string, unknown>) => void

type QueueEvents = {
  enqueued: [QueueJobSnapshot<JobType>]
  started: [QueueJobSnapshot<JobType>]
  released: [QueueJobSnapshot<JobType>]
  succeeded: [QueueJobSnapshot<JobType>]
  failed: [QueueJobSnapshot<JobType>, unknown]
}

export type QueueJobSnapshot<T extends JobType> = {
  id: string
  type: T
  projectId: string
  payload: QueuePayloadFor<T>
  status: JobStatus
  attempts: number
  priority: number
  runAt: Date
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  finishedAt?: Date
}

type InternalJob<T extends JobType = JobType> = QueueJobSnapshot<T>

type RabbitInternalJob<T extends JobType = JobType> = InternalJob<T> & {
  message: ConsumeMessage
}

export type ReserveFilter = {
  projectId?: string
  types?: JobType[]
}

export type JobHandle<T extends JobType> = {
  job: QueueJobSnapshot<T>
  complete: () => Promise<void>
  fail: (error: unknown) => Promise<void>
  release: (options?: { runAt?: Date; priority?: number }) => Promise<void>
}

const matchFilters = (job: InternalJob, filters?: ReserveFilter): boolean => {
  if (!filters) return true
  if (filters.projectId && job.projectId !== filters.projectId) return false
  if (filters.types && filters.types.length > 0 && !filters.types.includes(job.type)) return false
  return true
}

const cloneJob = <T extends JobType>(job: InternalJob<T>): QueueJobSnapshot<T> => ({
  ...job,
  runAt: new Date(job.runAt),
  createdAt: new Date(job.createdAt),
  updatedAt: new Date(job.updatedAt),
  startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
  finishedAt: job.finishedAt ? new Date(job.finishedAt) : undefined
})

const compareJobs = (a: InternalJob, b: InternalJob) => {
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.createdAt.getTime() - b.createdAt.getTime()
}

const clampPriority = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_PRIORITY, Math.round(value)))
}

export class InMemoryJobQueue extends EventEmitter<QueueEvents> {
  private jobs = new Map<string, InternalJob>()
  readonly ready: Promise<void>

  constructor(private readonly validatePayload = true) {
    super()
    this.ready = Promise.resolve()
  }

  async enqueue<T extends JobType>(input: ProjectScopedJob & { id?: string }): Promise<string> {
    const { id = randomUUID(), ...rest } = input
    const parsed = ProjectScopedJobSchema.parse(rest)
    const { type, payload, projectId, priority = 0, runAt } = parsed
    const validatedPayload = this.validatePayload
      ? (QueuePayloadSchemas[type].parse(payload) as QueuePayloadFor<T>)
      : ((payload as unknown) as QueuePayloadFor<T>)

    const timestamp = now()
    const job: InternalJob<T> = {
      id,
      type: type as T,
      projectId,
      payload: validatedPayload,
      status: 'queued',
      attempts: 0,
      priority,
      runAt: runAt ? new Date(runAt) : timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    this.jobs.set(job.id, job)
    this.emit('enqueued', cloneJob(job))
    return job.id
  }

  async list(filters?: ReserveFilter): Promise<QueueJobSnapshot<JobType>[]> {
    return [...this.jobs.values()]
      .filter((job) => matchFilters(job, filters))
      .map((job) => cloneJob(job))
  }

  async reserveNext(filters?: ReserveFilter): Promise<JobHandle<JobType> | null> {
    const dueJobs = [...this.jobs.values()]
      .filter((job) => job.status === 'queued' && job.runAt <= now() && matchFilters(job, filters))
      .sort(compareJobs)

    const job = dueJobs[0]
    if (!job) return null

    job.status = 'running'
    job.startedAt = now()
    job.updatedAt = job.startedAt
    job.attempts += 1
    this.emit('started', cloneJob(job))

    const complete = async () => {
      job.status = 'succeeded'
      job.finishedAt = now()
      job.updatedAt = job.finishedAt
      this.emit('succeeded', cloneJob(job))
    }

    const fail = async (error: unknown) => {
      job.status = 'failed'
      job.finishedAt = now()
      job.updatedAt = job.finishedAt
      this.emit('failed', cloneJob(job), error)
    }

    const release = async (options?: { runAt?: Date; priority?: number }) => {
      job.status = 'queued'
      job.startedAt = undefined
      job.finishedAt = undefined
      job.updatedAt = now()
      if (options?.runAt) {
        job.runAt = options.runAt
      }
      if (typeof options?.priority === 'number') {
        job.priority = options.priority
      }
      this.emit('released', cloneJob(job))
    }

    return {
      job: cloneJob(job),
      complete,
      fail,
      release
    }
  }

  async updateStatus(id: string, status: JobStatus): Promise<void> {
    JobStatusSchema.parse(status)
    const job = this.jobs.get(id)
    if (!job) {
      throw new Error(`Job ${id} not found`)
    }

    job.status = status
    job.updatedAt = now()
    if (status === 'succeeded' || status === 'failed' || status === 'canceled') {
      job.finishedAt = now()
    }

    if (status === 'succeeded') {
      this.emit('succeeded', cloneJob(job))
    } else if (status === 'failed') {
      this.emit('failed', cloneJob(job), new Error('Job marked as failed'))
    }
  }

  async delete(id: string): Promise<boolean> {
    return this.jobs.delete(id)
  }

  clear(): void {
    this.jobs.clear()
  }
}

type RabbitMqJobQueueOptions = {
  url: string
  exchange?: string
  queue?: string
  bindingKey?: string
  prefetch?: number
  logger?: Logger
}

type RabbitJobEnvelope<T extends JobType = JobType> = {
  id: string
  type: T
  projectId: string
  payload: QueuePayloadFor<T>
  priority?: number
  runAt?: string | null
  createdAt?: string
  updatedAt?: string
  attempts?: number
}

type Waiter = {
  filters?: ReserveFilter
  resolve: (handle: JobHandle<JobType> | null) => void
}

export class RabbitMqJobQueue extends EventEmitter<QueueEvents> {
  private readonly options: Required<Omit<RabbitMqJobQueueOptions, 'queue'>> & { queue?: string }
  private readonly waiters: Waiter[] = []
  private pending: RabbitInternalJob[] = []
  private connection?: Connection
  private channel?: Channel
  private queueName?: string
  private closed = false
  readonly ready: Promise<void>
  private readonly logger: Logger

  constructor(options: RabbitMqJobQueueOptions) {
    super()
    this.options = {
      url: options.url,
      exchange: options.exchange ?? DEFAULT_EXCHANGE,
      bindingKey: options.bindingKey ?? DEFAULT_BINDING_KEY,
      prefetch: options.prefetch ?? DEFAULT_PREFETCH,
      queue: options.queue,
      logger: options.logger ?? (() => {})
    }
    this.logger = this.options.logger
    this.ready = this.setup()
  }

  private async setup(): Promise<void> {
    try {
      const connection = await amqp.connect(this.options.url)
      this.connection = connection
      connection.on('close', () => {
        this.closed = true
        this.logger('info', 'RabbitMQ connection closed')
      })
      connection.on('error', (error: unknown) => {
        this.logger('error', 'RabbitMQ connection error', { error })
      })

      const channel = await connection.createChannel()
      this.channel = channel
      await channel.assertExchange(this.options.exchange, 'topic', { durable: true })

      const queueOptions: Parameters<Channel['assertQueue']>[1] = {
        durable: true,
        exclusive: !this.options.queue,
        arguments: {
          'x-max-priority': MAX_PRIORITY + 1
        }
      }

      const { queue } = await channel.assertQueue(this.options.queue ?? '', queueOptions)
      this.queueName = queue
      await channel.bindQueue(queue, this.options.exchange, this.options.bindingKey)
      await channel.prefetch(this.options.prefetch)
      await channel.consume(queue, (message: ConsumeMessage | null) => this.handleMessage(message), { noAck: false })
    } catch (error: unknown) {
      this.logger('error', 'Failed to initialise RabbitMQ job queue', { error })
      throw error
    }
  }

  private async ensureReady() {
    if (this.closed) {
      throw new Error('RabbitMQ connection is closed')
    }
    await this.ready
    if (!this.channel || !this.queueName) {
      throw new Error('RabbitMQ channel not ready')
    }
  }

  private routingKey(projectId: string) {
    return `project.${projectId}`
  }

  private log(level: 'info' | 'error', message: string, meta?: Record<string, unknown>) {
    try {
      this.logger(level, message, meta)
    } catch (error: unknown) {
      if (level === 'error') {
        console.error('[queue] logger error', error)
      }
    }
  }

  private handleMessage(message: ConsumeMessage | null) {
    if (!message) return
    try {
      const parsed = JSON.parse(message.content.toString()) as RabbitJobEnvelope
      const job: RabbitInternalJob = {
        id: parsed.id ?? randomUUID(),
        type: parsed.type,
        projectId: parsed.projectId,
        payload: parsed.payload,
        status: 'queued',
        attempts: parsed.attempts ?? 0,
        priority: parsed.priority ?? 0,
        runAt: parsed.runAt ? new Date(parsed.runAt) : now(),
        createdAt: parsed.createdAt ? new Date(parsed.createdAt) : now(),
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : now(),
        message
      }
      this.pending.push(job)
      this.pending.sort(compareJobs)
      this.emit('enqueued', cloneJob(job))
      this.fulfilWaiters()
    } catch (error: unknown) {
      this.log('error', 'Failed to parse RabbitMQ job message', { error })
      try {
        this.channel?.nack(message, false, false)
      } catch (ackError) {
        this.log('error', 'Failed to nack invalid job message', { error: ackError })
      }
    }
  }

  private shiftMatchingJob(filters?: ReserveFilter): RabbitInternalJob | undefined {
    if (this.pending.length === 0) return undefined
    const index = this.pending.findIndex((job) => matchFilters(job, filters))
    if (index === -1) return undefined
    const [job] = this.pending.splice(index, 1)
    return job
  }

  private fulfilWaiters() {
    if (this.pending.length === 0 || this.waiters.length === 0) return

    for (let i = 0; i < this.waiters.length; i += 1) {
      const waiter = this.waiters[i]
      const job = this.shiftMatchingJob(waiter.filters)
      if (!job) {
        continue
      }
      const handle = this.buildHandle(job)
      this.waiters.splice(i, 1)
      i -= 1
      waiter.resolve(handle)
      if (this.pending.length === 0) {
        break
      }
    }
  }

  private buildHandle(job: RabbitInternalJob): JobHandle<JobType> {
    job.status = 'running'
    job.attempts += 1
    job.startedAt = now()
    job.updatedAt = job.startedAt
    this.emit('started', cloneJob(job))

    const snapshot = () => cloneJob(job)

    const complete = async () => {
      await this.ensureReady()
      this.channel!.ack(job.message)
      job.status = 'succeeded'
      job.finishedAt = now()
      job.updatedAt = job.finishedAt
      this.emit('succeeded', snapshot())
    }

    const fail = async (error: unknown) => {
      await this.ensureReady()
      this.channel!.nack(job.message, false, false)
      job.status = 'failed'
      job.finishedAt = now()
      job.updatedAt = job.finishedAt
      this.emit('failed', snapshot(), error)
    }

    const release = async (options?: { runAt?: Date; priority?: number }) => {
      await this.ensureReady()
      this.channel!.ack(job.message)
      const released: InternalJob = {
        id: job.id,
        type: job.type,
        projectId: job.projectId,
        payload: job.payload,
        status: 'queued',
        attempts: job.attempts,
        priority: typeof options?.priority === 'number' ? options.priority : job.priority,
        runAt: options?.runAt ?? job.runAt ?? now(),
        createdAt: job.createdAt,
        updatedAt: now()
      }
      await this.publish(released)
      this.emit('released', cloneJob(released))
    }

    return {
      job: snapshot(),
      complete,
      fail,
      release
    }
  }

  private async publish(job: InternalJob): Promise<void> {
    await this.ensureReady()
    const envelope: RabbitJobEnvelope = {
      id: job.id,
      type: job.type,
      projectId: job.projectId,
      payload: job.payload,
      priority: job.priority,
      runAt: job.runAt?.toISOString() ?? null,
      createdAt: job.createdAt?.toISOString(),
      updatedAt: job.updatedAt?.toISOString(),
      attempts: job.attempts
    }

    const body = Buffer.from(JSON.stringify(envelope))
    const published = this.channel!.publish(this.options.exchange, this.routingKey(job.projectId), body, {
      persistent: true,
      priority: clampPriority(job.priority ?? 0)
    })

    if (!published) {
      await new Promise<void>((resolve) => this.channel!.once('drain', resolve))
    }
  }

  async enqueue<T extends JobType>(input: ProjectScopedJob & { id?: string }): Promise<string> {
    const { id = randomUUID(), ...rest } = input
    const parsed = ProjectScopedJobSchema.parse(rest)
    const { type, payload, projectId, priority = 0, runAt } = parsed
    const validatedPayload = QueuePayloadSchemas[type].parse(payload) as QueuePayloadFor<T>

    const timestamp = now()
    const job: InternalJob<T> = {
      id,
      type: type as T,
      projectId,
      payload: validatedPayload,
      status: 'queued',
      attempts: 0,
      priority,
      runAt: runAt ? new Date(runAt) : timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    await this.publish(job)
    return id
  }

  async list(filters?: ReserveFilter): Promise<QueueJobSnapshot<JobType>[]> {
    await this.ensureReady()
    return this.pending.filter((job) => matchFilters(job, filters)).map((job) => cloneJob(job))
  }

  async reserveNext(filters?: ReserveFilter): Promise<JobHandle<JobType> | null> {
    await this.ensureReady()
    const existing = this.shiftMatchingJob(filters)
    if (existing) {
      return this.buildHandle(existing)
    }

    return new Promise<JobHandle<JobType> | null>((resolve) => {
      this.waiters.push({
        filters,
        resolve
      })
    })
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureReady()
    const index = this.pending.findIndex((job) => job.id === id)
    if (index === -1) {
      return false
    }
    const [job] = this.pending.splice(index, 1)
    this.channel!.ack(job.message)
    return true
  }

  async updateStatus(): Promise<void> {
    // No direct status mutation support for RabbitMQ-backed queue; status changes
    // are driven by consumers acknowledging messages.
  }

  async clear(): Promise<void> {
    await this.ensureReady()
    if (this.queueName) {
      await this.channel!.purgeQueue(this.queueName)
    }
    this.pending = []
  }
}

export type JobQueue = InMemoryJobQueue | RabbitMqJobQueue

export const createInMemoryJobQueue = (validatePayload = true) => new InMemoryJobQueue(validatePayload)

export type CreateJobQueueOptions = Omit<RabbitMqJobQueueOptions, 'url'> & {
  url?: string
  fallbackToMemory?: boolean
}

export const createJobQueue = (options?: CreateJobQueueOptions): JobQueue => {
  const url = options?.url ?? process.env.SEO_AGENT_RABBITMQ_URL ?? process.env.RABBITMQ_URL
  if (url) {
    try {
      const queue = new RabbitMqJobQueue({
        url,
        exchange: options?.exchange,
        queue: options?.queue,
        bindingKey: options?.bindingKey,
        prefetch: options?.prefetch,
        logger: options?.logger
      })
      queue.ready.catch((error: unknown) => {
        if (options?.fallbackToMemory === false) {
          console.error('[queue] RabbitMQ initialisation failed', error)
        } else {
          console.warn('[queue] RabbitMQ initialisation failed, continuing with RabbitMQ instance (operations may fail)', error)
        }
      })
      return queue
    } catch (error: unknown) {
      if (options?.fallbackToMemory === false) {
        throw error
      }
      console.warn('[queue] Failed to create RabbitMQ queue, falling back to in-memory', error)
    }
  }
  return createInMemoryJobQueue()
}

export type { QueueEvents }

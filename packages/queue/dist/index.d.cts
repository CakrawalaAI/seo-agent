import { EventEmitter } from 'eventemitter3';
import { JobType, QueuePayloadFor, JobStatus, ProjectScopedJob } from '@seo-agent/domain';

type Logger = (level: 'info' | 'error', message: string, meta?: Record<string, unknown>) => void;
type QueueEvents = {
    enqueued: [QueueJobSnapshot<JobType>];
    started: [QueueJobSnapshot<JobType>];
    released: [QueueJobSnapshot<JobType>];
    succeeded: [QueueJobSnapshot<JobType>];
    failed: [QueueJobSnapshot<JobType>, unknown];
};
type QueueJobSnapshot<T extends JobType> = {
    id: string;
    type: T;
    projectId: string;
    payload: QueuePayloadFor<T>;
    status: JobStatus;
    attempts: number;
    priority: number;
    runAt: Date;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
};
type ReserveFilter = {
    projectId?: string;
    types?: JobType[];
};
type JobHandle<T extends JobType> = {
    job: QueueJobSnapshot<T>;
    complete: () => Promise<void>;
    fail: (error: unknown) => Promise<void>;
    release: (options?: {
        runAt?: Date;
        priority?: number;
    }) => Promise<void>;
};
declare class InMemoryJobQueue extends EventEmitter<QueueEvents> {
    private readonly validatePayload;
    private jobs;
    readonly ready: Promise<void>;
    constructor(validatePayload?: boolean);
    enqueue<T extends JobType>(input: ProjectScopedJob & {
        id?: string;
    }): Promise<string>;
    list(filters?: ReserveFilter): Promise<QueueJobSnapshot<JobType>[]>;
    reserveNext(filters?: ReserveFilter): Promise<JobHandle<JobType> | null>;
    updateStatus(id: string, status: JobStatus): Promise<void>;
    delete(id: string): Promise<boolean>;
    clear(): void;
}
type RabbitMqJobQueueOptions = {
    url: string;
    exchange?: string;
    queue?: string;
    bindingKey?: string;
    prefetch?: number;
    logger?: Logger;
};
declare class RabbitMqJobQueue extends EventEmitter<QueueEvents> {
    private readonly options;
    private readonly waiters;
    private pending;
    private connection?;
    private channel?;
    private queueName?;
    private closed;
    readonly ready: Promise<void>;
    private readonly logger;
    constructor(options: RabbitMqJobQueueOptions);
    private setup;
    private ensureReady;
    private routingKey;
    private log;
    private handleMessage;
    private shiftMatchingJob;
    private fulfilWaiters;
    private buildHandle;
    private publish;
    enqueue<T extends JobType>(input: ProjectScopedJob & {
        id?: string;
    }): Promise<string>;
    list(filters?: ReserveFilter): Promise<QueueJobSnapshot<JobType>[]>;
    reserveNext(filters?: ReserveFilter): Promise<JobHandle<JobType> | null>;
    delete(id: string): Promise<boolean>;
    updateStatus(): Promise<void>;
    clear(): Promise<void>;
}
type JobQueue = InMemoryJobQueue | RabbitMqJobQueue;
declare const createInMemoryJobQueue: (validatePayload?: boolean) => InMemoryJobQueue;
type CreateJobQueueOptions = Omit<RabbitMqJobQueueOptions, 'url'> & {
    url?: string;
    fallbackToMemory?: boolean;
};
declare const createJobQueue: (options?: CreateJobQueueOptions) => JobQueue;

export { type CreateJobQueueOptions, InMemoryJobQueue, type JobHandle, type JobQueue, type QueueEvents, type QueueJobSnapshot, RabbitMqJobQueue, type ReserveFilter, createInMemoryJobQueue, createJobQueue };

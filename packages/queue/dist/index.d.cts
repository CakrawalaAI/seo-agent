import { EventEmitter } from 'eventemitter3';
import { JobType, QueuePayloadFor, JobStatus, ProjectScopedJob } from '@seo-agent/domain';

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
declare const createInMemoryJobQueue: (validatePayload?: boolean) => InMemoryJobQueue;

export { InMemoryJobQueue, type JobHandle, type QueueJobSnapshot, type ReserveFilter, createInMemoryJobQueue };

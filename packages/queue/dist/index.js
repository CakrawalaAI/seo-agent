// src/index.ts
import { randomUUID } from "crypto";
import { EventEmitter } from "eventemitter3";
import {
  JobStatusSchema,
  ProjectScopedJobSchema,
  QueuePayloadSchemas
} from "@seo-agent/domain";
var now = () => /* @__PURE__ */ new Date();
var matchFilters = (job, filters) => {
  if (!filters) return true;
  if (filters.projectId && job.projectId !== filters.projectId) return false;
  if (filters.types && filters.types.length > 0 && !filters.types.includes(job.type)) return false;
  return true;
};
var cloneJob = (job) => ({
  ...job,
  runAt: new Date(job.runAt),
  createdAt: new Date(job.createdAt),
  updatedAt: new Date(job.updatedAt),
  startedAt: job.startedAt ? new Date(job.startedAt) : void 0,
  finishedAt: job.finishedAt ? new Date(job.finishedAt) : void 0
});
var InMemoryJobQueue = class extends EventEmitter {
  constructor(validatePayload = true) {
    super();
    this.validatePayload = validatePayload;
    this.jobs = /* @__PURE__ */ new Map();
  }
  async enqueue(input) {
    const { id = randomUUID(), ...rest } = input;
    const parsed = ProjectScopedJobSchema.parse(rest);
    const { type, payload, projectId, priority = 0, runAt } = parsed;
    const validatedPayload = this.validatePayload ? QueuePayloadSchemas[type].parse(payload) : payload;
    const timestamp = now();
    const job = {
      id,
      type,
      projectId,
      payload: validatedPayload,
      status: "queued",
      attempts: 0,
      priority,
      runAt: runAt ? new Date(runAt) : timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.jobs.set(job.id, job);
    this.emit("enqueued", cloneJob(job));
    return job.id;
  }
  async list(filters) {
    return [...this.jobs.values()].filter((job) => matchFilters(job, filters)).map((job) => cloneJob(job));
  }
  async reserveNext(filters) {
    const dueJobs = [...this.jobs.values()].filter((job2) => job2.status === "queued" && job2.runAt <= now() && matchFilters(job2, filters)).sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const job = dueJobs[0];
    if (!job) return null;
    job.status = "running";
    job.startedAt = now();
    job.updatedAt = job.startedAt;
    job.attempts += 1;
    this.jobs.set(job.id, job);
    this.emit("started", cloneJob(job));
    const complete = async () => {
      job.status = "succeeded";
      job.finishedAt = now();
      job.updatedAt = job.finishedAt;
      this.emit("succeeded", cloneJob(job));
    };
    const fail = async (error) => {
      job.status = "failed";
      job.finishedAt = now();
      job.updatedAt = job.finishedAt;
      this.emit("failed", cloneJob(job), error);
    };
    const release = async (options) => {
      job.status = "queued";
      job.startedAt = void 0;
      job.finishedAt = void 0;
      job.updatedAt = now();
      if (options?.runAt) {
        job.runAt = options.runAt;
      }
      if (typeof options?.priority === "number") {
        job.priority = options.priority;
      }
      this.emit("released", cloneJob(job));
    };
    return {
      job: cloneJob(job),
      complete,
      fail,
      release
    };
  }
  async updateStatus(id, status) {
    JobStatusSchema.parse(status);
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }
    job.status = status;
    job.updatedAt = now();
    if (status === "succeeded" || status === "failed" || status === "canceled") {
      job.finishedAt = now();
    }
    this.jobs.set(id, job);
    if (status === "succeeded") {
      this.emit("succeeded", cloneJob(job));
    } else if (status === "failed") {
      this.emit("failed", cloneJob(job), new Error("Job marked as failed"));
    }
  }
  async delete(id) {
    return this.jobs.delete(id);
  }
  clear() {
    this.jobs.clear();
  }
};
var createInMemoryJobQueue = (validatePayload = true) => new InMemoryJobQueue(validatePayload);
export {
  InMemoryJobQueue,
  createInMemoryJobQueue
};

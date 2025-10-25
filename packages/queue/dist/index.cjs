"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  InMemoryJobQueue: () => InMemoryJobQueue,
  createInMemoryJobQueue: () => createInMemoryJobQueue
});
module.exports = __toCommonJS(index_exports);
var import_node_crypto = require("crypto");
var import_eventemitter3 = require("eventemitter3");
var import_domain = require("@seo-agent/domain");
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
var InMemoryJobQueue = class extends import_eventemitter3.EventEmitter {
  constructor(validatePayload = true) {
    super();
    this.validatePayload = validatePayload;
    this.jobs = /* @__PURE__ */ new Map();
  }
  async enqueue(input) {
    const { id = (0, import_node_crypto.randomUUID)(), ...rest } = input;
    const parsed = import_domain.ProjectScopedJobSchema.parse(rest);
    const { type, payload, projectId, priority = 0, runAt } = parsed;
    const validatedPayload = this.validatePayload ? import_domain.QueuePayloadSchemas[type].parse(payload) : payload;
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
    import_domain.JobStatusSchema.parse(status);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InMemoryJobQueue,
  createInMemoryJobQueue
});

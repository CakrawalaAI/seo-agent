// src/index.ts
import { randomUUID } from "crypto";
import { EventEmitter } from "eventemitter3";
import * as amqp from "amqplib";
import {
  JobStatusSchema,
  ProjectScopedJobSchema,
  QueuePayloadSchemas
} from "@seo-agent/domain";
var now = () => /* @__PURE__ */ new Date();
var MAX_PRIORITY = 9;
var DEFAULT_EXCHANGE = "seo-agent.jobs";
var DEFAULT_BINDING_KEY = "project.*";
var DEFAULT_PREFETCH = 10;
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
var compareJobs = (a, b) => {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.createdAt.getTime() - b.createdAt.getTime();
};
var clampPriority = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_PRIORITY, Math.round(value)));
};
var InMemoryJobQueue = class extends EventEmitter {
  constructor(validatePayload = true) {
    super();
    this.validatePayload = validatePayload;
    this.jobs = /* @__PURE__ */ new Map();
    this.ready = Promise.resolve();
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
    const dueJobs = [...this.jobs.values()].filter((job2) => job2.status === "queued" && job2.runAt <= now() && matchFilters(job2, filters)).sort(compareJobs);
    const job = dueJobs[0];
    if (!job) return null;
    job.status = "running";
    job.startedAt = now();
    job.updatedAt = job.startedAt;
    job.attempts += 1;
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
var RabbitMqJobQueue = class extends EventEmitter {
  constructor(options) {
    super();
    this.waiters = [];
    this.pending = [];
    this.closed = false;
    this.options = {
      url: options.url,
      exchange: options.exchange ?? DEFAULT_EXCHANGE,
      bindingKey: options.bindingKey ?? DEFAULT_BINDING_KEY,
      prefetch: options.prefetch ?? DEFAULT_PREFETCH,
      queue: options.queue,
      logger: options.logger ?? (() => {
      })
    };
    this.logger = this.options.logger;
    this.ready = this.setup();
  }
  async setup() {
    try {
      const connection = await amqp.connect(this.options.url);
      this.connection = connection;
      connection.on("close", () => {
        this.closed = true;
        this.logger("info", "RabbitMQ connection closed");
      });
      connection.on("error", (error) => {
        this.logger("error", "RabbitMQ connection error", { error });
      });
      const channel = await connection.createChannel();
      this.channel = channel;
      await channel.assertExchange(this.options.exchange, "topic", { durable: true });
      const queueOptions = {
        durable: true,
        exclusive: !this.options.queue,
        arguments: {
          "x-max-priority": MAX_PRIORITY + 1
        }
      };
      const { queue } = await channel.assertQueue(this.options.queue ?? "", queueOptions);
      this.queueName = queue;
      await channel.bindQueue(queue, this.options.exchange, this.options.bindingKey);
      await channel.prefetch(this.options.prefetch);
      await channel.consume(queue, (message) => this.handleMessage(message), { noAck: false });
    } catch (error) {
      this.logger("error", "Failed to initialise RabbitMQ job queue", { error });
      throw error;
    }
  }
  async ensureReady() {
    if (this.closed) {
      throw new Error("RabbitMQ connection is closed");
    }
    await this.ready;
    if (!this.channel || !this.queueName) {
      throw new Error("RabbitMQ channel not ready");
    }
  }
  routingKey(projectId) {
    return `project.${projectId}`;
  }
  log(level, message, meta) {
    try {
      this.logger(level, message, meta);
    } catch (error) {
      if (level === "error") {
        console.error("[queue] logger error", error);
      }
    }
  }
  handleMessage(message) {
    if (!message) return;
    try {
      const parsed = JSON.parse(message.content.toString());
      const job = {
        id: parsed.id ?? randomUUID(),
        type: parsed.type,
        projectId: parsed.projectId,
        payload: parsed.payload,
        status: "queued",
        attempts: parsed.attempts ?? 0,
        priority: parsed.priority ?? 0,
        runAt: parsed.runAt ? new Date(parsed.runAt) : now(),
        createdAt: parsed.createdAt ? new Date(parsed.createdAt) : now(),
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : now(),
        message
      };
      this.pending.push(job);
      this.pending.sort(compareJobs);
      this.emit("enqueued", cloneJob(job));
      this.fulfilWaiters();
    } catch (error) {
      this.log("error", "Failed to parse RabbitMQ job message", { error });
      try {
        this.channel?.nack(message, false, false);
      } catch (ackError) {
        this.log("error", "Failed to nack invalid job message", { error: ackError });
      }
    }
  }
  shiftMatchingJob(filters) {
    if (this.pending.length === 0) return void 0;
    const index = this.pending.findIndex((job2) => matchFilters(job2, filters));
    if (index === -1) return void 0;
    const [job] = this.pending.splice(index, 1);
    return job;
  }
  fulfilWaiters() {
    if (this.pending.length === 0 || this.waiters.length === 0) return;
    for (let i = 0; i < this.waiters.length; i += 1) {
      const waiter = this.waiters[i];
      const job = this.shiftMatchingJob(waiter.filters);
      if (!job) {
        continue;
      }
      const handle = this.buildHandle(job);
      this.waiters.splice(i, 1);
      i -= 1;
      waiter.resolve(handle);
      if (this.pending.length === 0) {
        break;
      }
    }
  }
  buildHandle(job) {
    job.status = "running";
    job.attempts += 1;
    job.startedAt = now();
    job.updatedAt = job.startedAt;
    this.emit("started", cloneJob(job));
    const snapshot = () => cloneJob(job);
    const complete = async () => {
      await this.ensureReady();
      this.channel.ack(job.message);
      job.status = "succeeded";
      job.finishedAt = now();
      job.updatedAt = job.finishedAt;
      this.emit("succeeded", snapshot());
    };
    const fail = async (error) => {
      await this.ensureReady();
      this.channel.nack(job.message, false, false);
      job.status = "failed";
      job.finishedAt = now();
      job.updatedAt = job.finishedAt;
      this.emit("failed", snapshot(), error);
    };
    const release = async (options) => {
      await this.ensureReady();
      this.channel.ack(job.message);
      const released = {
        id: job.id,
        type: job.type,
        projectId: job.projectId,
        payload: job.payload,
        status: "queued",
        attempts: job.attempts,
        priority: typeof options?.priority === "number" ? options.priority : job.priority,
        runAt: options?.runAt ?? job.runAt ?? now(),
        createdAt: job.createdAt,
        updatedAt: now()
      };
      await this.publish(released);
      this.emit("released", cloneJob(released));
    };
    return {
      job: snapshot(),
      complete,
      fail,
      release
    };
  }
  async publish(job) {
    await this.ensureReady();
    const envelope = {
      id: job.id,
      type: job.type,
      projectId: job.projectId,
      payload: job.payload,
      priority: job.priority,
      runAt: job.runAt?.toISOString() ?? null,
      createdAt: job.createdAt?.toISOString(),
      updatedAt: job.updatedAt?.toISOString(),
      attempts: job.attempts
    };
    const body = Buffer.from(JSON.stringify(envelope));
    const published = this.channel.publish(this.options.exchange, this.routingKey(job.projectId), body, {
      persistent: true,
      priority: clampPriority(job.priority ?? 0)
    });
    if (!published) {
      await new Promise((resolve) => this.channel.once("drain", resolve));
    }
  }
  async enqueue(input) {
    const { id = randomUUID(), ...rest } = input;
    const parsed = ProjectScopedJobSchema.parse(rest);
    const { type, payload, projectId, priority = 0, runAt } = parsed;
    const validatedPayload = QueuePayloadSchemas[type].parse(payload);
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
    await this.publish(job);
    return id;
  }
  async list(filters) {
    await this.ensureReady();
    return this.pending.filter((job) => matchFilters(job, filters)).map((job) => cloneJob(job));
  }
  async reserveNext(filters) {
    await this.ensureReady();
    const existing = this.shiftMatchingJob(filters);
    if (existing) {
      return this.buildHandle(existing);
    }
    return new Promise((resolve) => {
      this.waiters.push({
        filters,
        resolve
      });
    });
  }
  async delete(id) {
    await this.ensureReady();
    const index = this.pending.findIndex((job2) => job2.id === id);
    if (index === -1) {
      return false;
    }
    const [job] = this.pending.splice(index, 1);
    this.channel.ack(job.message);
    return true;
  }
  async updateStatus() {
  }
  async clear() {
    await this.ensureReady();
    if (this.queueName) {
      await this.channel.purgeQueue(this.queueName);
    }
    this.pending = [];
  }
};
var createInMemoryJobQueue = (validatePayload = true) => new InMemoryJobQueue(validatePayload);
var createJobQueue = (options) => {
  const url = options?.url ?? process.env.SEO_AGENT_RABBITMQ_URL ?? process.env.RABBITMQ_URL;
  if (url) {
    try {
      const queue = new RabbitMqJobQueue({
        url,
        exchange: options?.exchange,
        queue: options?.queue,
        bindingKey: options?.bindingKey,
        prefetch: options?.prefetch,
        logger: options?.logger
      });
      queue.ready.catch((error) => {
        if (options?.fallbackToMemory === false) {
          console.error("[queue] RabbitMQ initialisation failed", error);
        } else {
          console.warn("[queue] RabbitMQ initialisation failed, continuing with RabbitMQ instance (operations may fail)", error);
        }
      });
      return queue;
    } catch (error) {
      if (options?.fallbackToMemory === false) {
        throw error;
      }
      console.warn("[queue] Failed to create RabbitMQ queue, falling back to in-memory", error);
    }
  }
  return createInMemoryJobQueue();
};
export {
  InMemoryJobQueue,
  RabbitMqJobQueue,
  createInMemoryJobQueue,
  createJobQueue
};

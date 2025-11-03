import pino, { Logger, LoggerOptions } from 'pino'
import { AsyncLocalStorage } from 'node:async_hooks'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogContext = {
  requestId?: string
  traceId?: string
  userId?: string
  projectId?: string
  jobId?: string
  module?: string
  [key: string]: unknown
}

const prettyDefault = (process.env.NODE_ENV || 'development') !== 'production'
const pretty = prettyDefault
const level = 'info' as LogLevel

const redact: NonNullable<LoggerOptions['redact']> = {
  paths: [
    'password',
    'token',
    'secret',
    'apiKey',
    'headers.authorization',
    'authorization',
    '*.password',
    '*.token',
    '*.secret',
    '*.apiKey',
  ],
  remove: true,
}

const base = {
  service: 'seo-agent',
  env: process.env.NODE_ENV || 'development',
  version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA,
}

const transport = pretty
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : undefined

const root: Logger = pino(
  {
    level,
    base,
    redact,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        // keep lowercase to match zap/pino expectations
        return { level: label }
      },
    },
    messageKey: 'msg',
  },
  // @ts-ignore pino types allow undefined destination
  transport,
)

const store = new AsyncLocalStorage<LogContext>()

export function withLogContext<T>(ctx: LogContext, fn: () => T): T {
  const parent = store.getStore() || {}
  return store.run({ ...parent, ...ctx }, fn)
}

export function currentContext(): LogContext {
  return store.getStore() || {}
}

export function getLogger(module?: string): Logger {
  const ctx = store.getStore() || {}
  const bindings = module ? { ...ctx, module } : ctx
  return Object.keys(bindings).length ? root.child(bindings) : root
}

export function setLogLevel(next: LogLevel) {
  root.level = next
}

type ConsoleLike = {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  fatal: (...args: any[]) => void
}

function toConsoleCompat(l: Logger): ConsoleLike {
  const call = (level: keyof ConsoleLike, args: any[]) => {
    const first = args[0]
    const second = args[1]
    if (typeof first === 'string' && second && typeof second === 'object' && !Array.isArray(second)) {
      // console-like order: (msg, obj) → pino: (obj, msg)
      ;(l as any)[level](second, first)
      return
    }
    ;(l as any)[level](...args)
  }
  return {
    debug: (...a: any[]) => call('debug', a),
    info: (...a: any[]) => call('info', a),
    warn: (...a: any[]) => call('warn', a),
    error: (...a: any[]) => call('error', a),
    fatal: (...a: any[]) => call('fatal', a),
  }
}

// Convenience default logger (no module binding, console-compatible)
export const log: ConsoleLike = toConsoleCompat(getLogger())

export type AppLogger = Logger & ConsoleLike

export default log

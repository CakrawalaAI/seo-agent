import pino, { Logger, LoggerOptions } from 'pino'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogContext = {
  requestId?: string
  traceId?: string
  userId?: string
  websiteId?: string
  jobId?: string
  module?: string
  [key: string]: unknown
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

const levelEnv = (typeof process !== 'undefined' && process.env?.SEOA_LOG_LEVEL) || undefined
const readBrowserLevel = () => {
  try {
    const url = typeof window !== 'undefined' ? new URL(window.location.href) : null
    const q = url?.searchParams?.get('debug')
    if (q === '1' || q === 'true') return 'debug'
    const ls = typeof window !== 'undefined' ? window.localStorage.getItem('seoa.loglevel') : null
    if (ls) return ls as LogLevel
  } catch {}
  return undefined
}

const defaultLevel: LogLevel = (levelEnv || readBrowserLevel() || 'info') as LogLevel

const prettyDefault = (process.env.NODE_ENV || 'development') !== 'production'
const pretty = !isBrowser && prettyDefault

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

let root: any

if (isBrowser) {
  // Console-backed logger with level gating
  const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 }
  let currentLevel: LogLevel = defaultLevel
  const enabled = (lvl: LogLevel) => order[lvl] >= order[currentLevel]
  const baseConsole = console
  const browserLogger: any = {
    set level(l: LogLevel) {
      currentLevel = l
    },
    get level() {
      return currentLevel
    },
    debug: (...a: any[]) => enabled('debug') && baseConsole.debug(...a),
    info: (...a: any[]) => enabled('info') && baseConsole.info(...a),
    warn: (...a: any[]) => enabled('warn') && baseConsole.warn(...a),
    error: (...a: any[]) => baseConsole.error(...a),
    fatal: (...a: any[]) => baseConsole.error(...a),
    child: () => browserLogger,
  }
  root = browserLogger
} else {
  const transport = typeof (pino as any).transport === 'function' && pretty
    ? (pino as any).transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      })
    : undefined

  root = pino(
    {
      level: defaultLevel,
      base,
      redact,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label }
        },
      },
      messageKey: 'msg',
    },
    // @ts-ignore pino types allow undefined destination
    transport,
  )
}

let currentCtx: LogContext | null = null
const store = {
  getStore() {
    return currentCtx
  },
  run<T>(ctx: LogContext, fn: () => T): T {
    const prev = currentCtx || {}
    currentCtx = { ...prev, ...ctx }
    try {
      return fn()
    } finally {
      currentCtx = prev
    }
  }
}

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
  try {
    root.level = next
  } catch {
    // browser console shim
    try {
      root.level = next
    } catch {}
  }
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

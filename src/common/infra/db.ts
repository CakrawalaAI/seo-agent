import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { schema } from './schema'
import { log } from '@src/common/logger'

type GlobalDbCache = typeof globalThis & {
  __seoAgentDb?: ReturnType<typeof drizzle>
  __seoAgentPg?: ReturnType<typeof postgres>
  __seoAgentPgCleanup?: boolean
}

const globalDb = globalThis as GlobalDbCache

function hasDatabaseUrl(): boolean {
  const raw = process.env.DATABASE_URL
  return typeof raw === 'string' && raw.trim().length > 0
}

function resolveDatabaseUrl(): string {
  if (!hasDatabaseUrl()) {
    throw new Error('DATABASE_URL not set')
  }
  return process.env.DATABASE_URL!.trim()
}

function maskDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.username || 'user'}:****@${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname || ''}`
  } catch {
    return 'postgres://<invalid>'
  }
}

function ensureDbInstance(): ReturnType<typeof drizzle> {
  if (globalDb.__seoAgentDb) {
    return globalDb.__seoAgentDb
  }

  const url = resolveDatabaseUrl()

  try {
    log.info('[db] connecting', { url: maskDatabaseUrl(url) })
  } catch {}

  const client = globalDb.__seoAgentPg ?? postgres(url, { prepare: true, max: 1 })
  globalDb.__seoAgentPg = client

  if (!globalDb.__seoAgentPgCleanup) {
    globalDb.__seoAgentPgCleanup = true
    process.once('exit', () => {
      try {
        globalDb.__seoAgentPg?.end?.()
      } catch (error) {
        log.warn('[db] failed to close postgres client', error)
      }
    })
  }

  const db = drizzle(client, { schema })
  globalDb.__seoAgentDb = db
  log.info('[db] drizzle ready')
  return db
}

export function hasDatabase() {
  return hasDatabaseUrl()
}

export function getDb() {
  return ensureDbInstance()
}

const dbProxy = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    const instance = ensureDbInstance()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  }
})

export { dbProxy as db }

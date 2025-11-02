import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { schema } from './schema'

type GlobalDbCache = typeof globalThis & {
  __seoAgentDb?: ReturnType<typeof drizzle>
  __seoAgentPg?: ReturnType<typeof postgres>
  __seoAgentPgCleanup?: boolean
}

const globalDb = globalThis as GlobalDbCache

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL)
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  if (globalDb.__seoAgentDb) return globalDb.__seoAgentDb
  try {
    const masked = (() => {
      try {
        const u = new URL(process.env.DATABASE_URL!)
        return `${u.protocol}//${u.username || 'user'}:****@${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname || ''}`
      } catch {
        return 'postgres://<invalid>'
      }
    })()
    console.info('[db] connecting', { url: masked })
  } catch {}
  const client = globalDb.__seoAgentPg ?? postgres(process.env.DATABASE_URL, { prepare: true, max: 1 })
  globalDb.__seoAgentPg = client
  if (!globalDb.__seoAgentPgCleanup) {
    globalDb.__seoAgentPgCleanup = true
    process.once('exit', () => {
      try {
        globalDb.__seoAgentPg?.end?.()
      } catch (error) {
        console.warn('[db] failed to close postgres client', error)
      }
    })
  }
  const db = drizzle(client, { schema })
  globalDb.__seoAgentDb = db
  console.info('[db] drizzle ready')
  return db
}

// Named export expected by callers
export const db = getDb()

import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { schema } from './schema'

let dbSingleton: ReturnType<typeof drizzle> | null = null

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL)
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }
  if (dbSingleton) return dbSingleton
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
  const client = postgres(process.env.DATABASE_URL, { prepare: true, max: 1 })
  dbSingleton = drizzle(client, { schema })
  console.info('[db] drizzle ready')
  return dbSingleton
}

// Named export expected by callers
export const db = getDb()

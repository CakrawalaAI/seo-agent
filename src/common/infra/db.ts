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
  // Lightweight bootstrap to avoid runtime failures when migrations lag behind
  try {
    // Run asynchronously; do not block startup
    void (async () => {
      try {
        // Add columns introduced by plan→articles merge if missing
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await dbSingleton.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS planned_date text`)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await dbSingleton.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS keyword_id text`)
      } catch (e) {
        try { console.warn('[db] bootstrap ensure columns failed (non-fatal)', (e as Error)?.message || String(e)) } catch {}
      }
    })()
  } catch {}
  return dbSingleton
}

// Named export expected by callers
export const db = getDb()

import { drizzle } from 'drizzle-orm/postgres-js'
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
  const client = postgres(process.env.DATABASE_URL, { prepare: true, max: 1 })
  dbSingleton = drizzle(client, { schema })
  return dbSingleton
}

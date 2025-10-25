import { createDb, schema, type Database } from '@seo-agent/db'

let cachedDb: Database | null = null

export const getDb = (): Database => {
  if (!cachedDb) {
    const { db } = createDb()
    cachedDb = db
  }
  return cachedDb
}

export { schema }
export type { Database }

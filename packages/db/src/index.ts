import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Options as PostgresOptions, type Sql } from 'postgres'
import * as schema from './schema.js'

export type Database = PostgresJsDatabase<typeof schema>
export type SqlClient = Sql<any> & { end: () => Promise<void> }

export type CreateDbClientOptions = {
  url?: string
  postgresOptions?: PostgresOptions<any>
}

export const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/seo_agent'

export const createSqlClient = (
  url: string = DEFAULT_DATABASE_URL,
  options: PostgresOptions<any> = {}
): SqlClient => {
  return postgres(url, {
    prepare: true,
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    ...options
  }) as SqlClient
}

export const createDb = (
  options: CreateDbClientOptions = {}
): { db: Database; sql: SqlClient } => {
  const sqlClient = createSqlClient(options.url, options.postgresOptions)
  const db = drizzle(sqlClient, { schema })
  return { db, sql: sqlClient }
}

export type Schema = typeof schema

export { schema }

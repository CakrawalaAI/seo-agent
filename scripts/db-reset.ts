import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/dev-seo-agent'
  const sql = postgres(url, { max: 1 })
  try {
    console.log('[db:reset] dropping schemas public and drizzle')
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`
    await sql`DROP SCHEMA IF EXISTS public CASCADE;`
    await sql`CREATE SCHEMA public;`
    await sql`CREATE SCHEMA drizzle;`
    console.log('[db:reset] done')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Include all entity DB schema files
  schema: ['./src/entities/**/db/*.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/seo_agent'
  }
})

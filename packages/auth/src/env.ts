import { z } from 'zod'

const rawEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SEO_AGENT_AUTH_BASE_URL: z.string().optional(),
  SEO_AGENT_BASE_URL: z.string().optional(),
  NODE_ENV: z.string().optional()
})

const rawEnv = rawEnvSchema.parse(process.env)

const isProduction = rawEnv.NODE_ENV === 'production'

const ensure = (value: string | undefined, key: string, fallback: string): string => {
  if (value && value.length > 0) {
    return value
  }
  if (isProduction) {
    throw new Error(`Missing required environment variable ${key}`)
  }
  return fallback
}

const defaultBaseUrl = rawEnv.SEO_AGENT_BASE_URL ?? 'http://localhost:4000'

export const authEnv = {
  secret: ensure(rawEnv.BETTER_AUTH_SECRET, 'BETTER_AUTH_SECRET', 'dev-secret-please-change'),
  googleClientId: ensure(rawEnv.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID', 'google-client-id'),
  googleClientSecret: ensure(
    rawEnv.GOOGLE_CLIENT_SECRET,
    'GOOGLE_CLIENT_SECRET',
    'google-client-secret'
  ),
  baseUrl: (rawEnv.SEO_AGENT_AUTH_BASE_URL ?? `${defaultBaseUrl}/api/auth`).replace(/\/$/, '')
}

export type AuthEnv = typeof authEnv

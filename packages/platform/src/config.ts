import { z } from 'zod'

const EnvSchema = z.object({
  SEO_AGENT_WEB_BASE_URL: z.string().url().optional(),
  SEO_AGENT_INVITE_PATH: z.string().optional(),
  SEO_AGENT_BILLING_CHECKOUT_BASE_URL: z.string().url().optional(),
  SEO_AGENT_BILLING_PORTAL_BASE_URL: z.string().url().optional(),
  SEO_AGENT_API_BASE_URL: z.string().url().optional(),
  POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  POLAR_WEBHOOK_TOLERANCE_SECONDS: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: z.string().optional(),
  WORKER_MAX_ATTEMPTS: z.string().optional()
})

const env = EnvSchema.parse(process.env)

const toPositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const ensurePath = (value: string | undefined, fallback: string) => {
  if (!value) return fallback
  return value.startsWith('/') ? value : `/${value}`
}

export const appConfig = {
  urls: {
    webBase: env.SEO_AGENT_WEB_BASE_URL ?? 'http://localhost:5173',
    invitePath: ensurePath(env.SEO_AGENT_INVITE_PATH, '/invite'),
    billingCheckoutBase:
      env.SEO_AGENT_BILLING_CHECKOUT_BASE_URL ?? 'https://polar.sh/seo-agent/checkout',
    billingPortalBase:
      env.SEO_AGENT_BILLING_PORTAL_BASE_URL ?? 'https://polar.sh/seo-agent/portal',
    apiBase: env.SEO_AGENT_API_BASE_URL ?? 'http://localhost:3000'
  },
  polar: {
    webhookSecret: env.POLAR_WEBHOOK_SECRET ?? null,
    signatureHeader: 'x-polar-signature',
    toleranceSeconds: toPositiveInt(env.POLAR_WEBHOOK_TOLERANCE_SECONDS, 300)
  },
  worker: {
    pollIntervalMs: toPositiveInt(env.WORKER_POLL_INTERVAL_MS, 1000),
    maxAttempts: toPositiveInt(env.WORKER_MAX_ATTEMPTS, 3)
  }
}

export type AppConfig = typeof appConfig

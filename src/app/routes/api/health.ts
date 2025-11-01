// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from '@app/api-utils'
import { computeHealth } from '@common/infra/health'

const SERVICE_NAME = process.env.SEO_AGENT_SERVICE ?? 'seo-agent'
// Avoid JSON import attributes in Vite parsing; prefer env with sensible default
const VERSION = process.env.SEO_AGENT_VERSION ?? '0.0.0-dev'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: safeHandler(() => {
        const health = computeHealth()
        return json({
          ok: health.ok,
          service: SERVICE_NAME,
          version: VERSION,
          timestamp: new Date().toISOString(),
          env: health.env,
          stubsAllowed: health.stubsAllowed,
          providers: health.providers,
          reasons: health.reasons ?? []
        })
      })
    }
  }
})

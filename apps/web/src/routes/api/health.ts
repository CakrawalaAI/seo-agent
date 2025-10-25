// @ts-nocheck
import { HealthResponseSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import packageJson from '../../../package.json' assert { type: 'json' }
import { json, safeHandler } from './utils'

const SERVICE_NAME = process.env.SEO_AGENT_SERVICE ?? 'seo-agent-web'
const VERSION =
  process.env.SEO_AGENT_VERSION ??
  (typeof packageJson?.version === 'string' ? packageJson.version : undefined) ??
  '0.0.0-dev'

const buildHealthPayload = () =>
  HealthResponseSchema.parse({
    ok: true,
    service: SERVICE_NAME,
    version: VERSION,
    timestamp: new Date().toISOString()
  })

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: safeHandler(() => {
        const payload = buildHealthPayload()
        return json(payload)
      })
    }
  }
})

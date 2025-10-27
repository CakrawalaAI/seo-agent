// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import pkg from '../../../../package.json' assert { type: 'json' }
import { json, safeHandler } from './utils'

const SERVICE_NAME = process.env.SEO_AGENT_SERVICE ?? 'seo-agent'
const VERSION =
  process.env.SEO_AGENT_VERSION ??
  (typeof (pkg as any)?.version === 'string' ? (pkg as any).version : undefined) ??
  '0.0.0-dev'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: safeHandler(() => {
        const payload = {
          ok: true,
          service: SERVICE_NAME,
          version: VERSION,
          timestamp: new Date().toISOString()
        }
        return json(payload)
      })
    }
  }
})

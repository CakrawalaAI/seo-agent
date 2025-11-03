// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { safeHandler, json } from '@app/api-utils'
import { mkdir, appendFile } from 'fs/promises'
import { join } from 'path'

const LOG_DIR = join(process.cwd(), '.data', 'telemetry')
const LOG_FILE = join(LOG_DIR, 'onboarding-events.jsonl')

export const Route = createFileRoute('/api/onboarding/telemetry')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => null)
        if (!body || typeof body.event !== 'string') {
          return json({ ok: false }, { status: 400 })
        }
        const record = {
          event: body.event,
          payload: body.payload ?? null,
          ts: body.ts || new Date().toISOString()
        }
        try {
          await mkdir(LOG_DIR, { recursive: true })
          await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, 'utf8')
        } catch (error) {
          console.warn('[onboarding/telemetry] write failed', { error: (error as Error)?.message || String(error) })
        }
        return json({ ok: true })
      })
    }
  }
})

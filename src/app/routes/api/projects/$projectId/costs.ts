// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession } from '@app/api-utils'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const Route = createFileRoute('/api/projects/$projectId/costs')({
  server: {
    handlers: {
      GET: safeHandler(async () => {
        await requireSession({} as any)
        const file = join(process.cwd(), '.data', 'bundle', 'global', 'metrics', 'costs.json')
        if (!existsSync(file)) return json({ updatedAt: null, perDay: {} })
        try { const data = JSON.parse(readFileSync(file, 'utf-8')) as any; return json(data) } catch { return json({ updatedAt: null, perDay: {} }) }
      })
    }
  }
})


// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '@common/config'

export const Route = createFileRoute('/api/projects/$projectId/costs')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        // Allow special '_' projectId to access global costs without project binding (matches CLI)
        if (params.projectId !== '_') {
          await requireProjectAccess(request, params.projectId)
        }
        if (!config.debug?.writeBundle) return json({ updatedAt: null, perDay: {} })
        const file = join(process.cwd(), '.data', 'bundle', 'global', 'metrics', 'costs.json')
        if (!existsSync(file)) return json({ updatedAt: null, perDay: {} })
        try { const data = JSON.parse(readFileSync(file, 'utf-8')) as any; return json(data) } catch { return json({ updatedAt: null, perDay: {} }) }
      })
    }
  }
})

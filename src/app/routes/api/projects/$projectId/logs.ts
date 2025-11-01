// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { latestRunDir } from '@common/bundle/store'

export const Route = createFileRoute('/api/projects/$projectId/logs')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const tail = Math.max(1, Math.min(2000, Number(url.searchParams.get('tail') || '200')))
        const base = latestRunDir(params.projectId)
        const file = join(base, 'logs', 'jobs.jsonl')
        if (!existsSync(file)) return json({ items: [] })
        try {
          const txt = readFileSync(file, 'utf-8')
          const lines = txt.split(/\r?\n/).filter(Boolean)
          const slice = lines.slice(Math.max(0, lines.length - tail))
          const items = slice.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
          return json({ items })
        } catch {
          return httpError(500, 'Failed to read logs')
        }
      })
    }
  }
})


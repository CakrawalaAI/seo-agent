// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { latestRunDir } from '@common/bundle/store'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

export const Route = createFileRoute('/api/projects/$projectId/keywords/prioritized')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || '200')))
        const base = latestRunDir(params.projectId)
        const file = join(base, 'keywords', 'prioritized.jsonl')
        if (!existsSync(file)) return json({ items: [] })
        try {
          const txt = readFileSync(file, 'utf-8')
          const items = txt
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => { try { return JSON.parse(l) } catch { return null } })
            .filter(Boolean)
            .slice(0, limit)
          return json({ items })
        } catch {
          return json({ items: [] })
        }
      })
    }
  }
})


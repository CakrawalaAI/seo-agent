// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession } from '@app/api-utils'
import { latestRunDir } from '@common/bundle/store'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const Route = createFileRoute('/api/projects/$projectId/logs')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const url = new URL(request.url)
        const tail = Math.max(1, Math.min(500, Number(url.searchParams.get('tail') || '200')))
        const base = latestRunDir(params.projectId)
        const file = join(base, 'logs', 'jobs.jsonl')
        if (!existsSync(file)) return json({ items: [] })
        const txt = readFileSync(file, 'utf-8')
        const lines = txt.split(/\r?\n/).filter(Boolean)
        const take = lines.slice(-tail)
        const items = take.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
        return json({ items })
      })
    }
  }
})


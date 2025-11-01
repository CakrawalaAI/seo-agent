// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { safeHandler, requireSession, httpError, requireProjectAccess } from '@app/api-utils'
import { latestRunDir } from '@common/bundle/store'
import { config } from '@common/config'
import { join, normalize } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

function contentTypeFor(pathname: string) {
  if (pathname.endsWith('.json') || pathname.endsWith('.jsonl')) return 'application/json; charset=utf-8'
  if (pathname.endsWith('.txt') || pathname.endsWith('.log')) return 'text/plain; charset=utf-8'
  if (pathname.endsWith('.html')) return 'text/html; charset=utf-8'
  return 'text/plain; charset=utf-8'
}

export const Route = createFileRoute('/api/projects/$projectId/bundle/file')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const rel = String(url.searchParams.get('path') || '')
        if (!rel) return httpError(400, 'Missing path')
        if (!config.debug?.writeBundle) return httpError(404, 'Debug bundles disabled')
        const base = latestRunDir(params.projectId)
        const full = normalize(join(base, rel))
        if (!full.startsWith(base)) return httpError(400, 'Invalid path')
        if (!existsSync(full)) return httpError(404, 'Not found')
        try {
          const data = readFileSync(full)
          return new Response(data, { status: 200, headers: { 'content-type': contentTypeFor(full) } })
        } catch (e) {
          return httpError(500, 'Read error')
        }
      })
    }
  }
})

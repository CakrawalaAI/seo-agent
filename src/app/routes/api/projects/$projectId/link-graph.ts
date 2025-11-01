// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireProjectAccess } from '@app/api-utils'
import { latestRunDir } from '@common/bundle/store'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

export const Route = createFileRoute('/api/projects/$projectId/link-graph')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (process.env.E2E_NO_AUTH !== '1' && request) {
          await requireSession(request)
          await requireProjectAccess(request, params.projectId)
        }
        try {
          const base = latestRunDir(params.projectId)
          const file = join(base, 'crawl', 'link-graph.json')
          if (!existsSync(file)) return json({ nodes: [], edges: [] })
          const parsed = JSON.parse(readFileSync(file, 'utf-8'))
          const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
          const edges = Array.isArray(parsed?.edges) ? parsed.edges : []
          return json({ nodes, edges })
        } catch {
          return json({ nodes: [], edges: [] })
        }
      }
    }
  }
})

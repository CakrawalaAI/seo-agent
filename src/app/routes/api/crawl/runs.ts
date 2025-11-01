// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireProjectAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/crawl/runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireSession(request)
        await requireProjectAccess(request, String(projectId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            await db.select().from(projects).where(eq(projects.id, String(projectId))).limit(1)
            // Project summary removed; no persisted crawl runs
          } catch {}
        }
        return json({ items: [] })
      }
    }
  }
})

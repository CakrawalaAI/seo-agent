// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema'
import { clusterKey } from '@common/keyword/cluster'
import { eq, desc } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/keywords/prioritized')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || '200')))
        if (!hasDatabase()) return json({ items: [] })
        const db = getDb()
        const rows: any[] = await db.select().from(keywords).where(eq(keywords.projectId, params.projectId)).orderBy(desc(keywords.opportunity as any)).limit(1000)
        // Primary per cluster, then up to two secondaries
        const byCluster = new Map<string, any[]>()
        for (const r of rows) {
          const ck = clusterKey(r.phrase)
          const arr = byCluster.get(ck) || []
          arr.push(r)
          byCluster.set(ck, arr)
        }
        const prioritized: Array<{ phrase: string; opportunity: number; cluster: string; role: 'primary'|'secondary' }>
          = []
        for (const [ck, arr] of byCluster.entries()) {
          const sorted = arr.sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
          if (sorted[0]) prioritized.push({ phrase: sorted[0].phrase, opportunity: sorted[0].opportunity ?? 0, cluster: ck, role: 'primary' })
          for (const s of sorted.slice(1, 3)) prioritized.push({ phrase: s.phrase, opportunity: s.opportunity ?? 0, cluster: ck, role: 'secondary' })
        }
        const primaries = prioritized.filter(p => p.role === 'primary').sort((a,b) => b.opportunity - a.opportunity)
        const secondaries = prioritized.filter(p => p.role === 'secondary').sort((a,b) => b.opportunity - a.opportunity)
        const items = [...primaries, ...secondaries].slice(0, limit)
        return json({ items })
      })
    }
  }
})

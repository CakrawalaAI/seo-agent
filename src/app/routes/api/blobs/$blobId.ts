// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { getHtml } from '@common/blob/store'
import { requireSession, requireProjectAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { blobs } from '@entities/blob/db/schema'

export const Route = createFileRoute('/api/blobs/$blobId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        // Basic auth: require a session unless explicitly allowed via env
        if (process.env.SEOA_BLOBS_PUBLIC !== '1') {
          try { requireSession(request as any) } catch (e) { return e as Response }
          if (hasDatabase()) {
            try {
              const db = getDb()
              // @ts-ignore
              const rows = (await db.select().from(blobs).where((blobs as any).id.eq(params.blobId)).limit(1)) as any
              const row = rows?.[0]
              if (row?.projectId) {
                try { await requireProjectAccess(request as any, String(row.projectId)) } catch (e) { return e as Response }
              }
            } catch {}
          }
        }
        const html = getHtml(params.blobId)
        if (!html) return new Response('Not found', { status: 404 })
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
    }
  }
})

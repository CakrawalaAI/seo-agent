// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { getBlob } from '@common/blob/store'
import { requireSession, safeHandler } from '@app/api-utils'

export const Route = createFileRoute('/api/blobs/$blobId')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        // Require a session (public blob access disabled by default)
        try { await requireSession(request as any) } catch (e) { return e as Response }
        const file = getBlob(params.blobId)
        if (!file) return new Response('Not found', { status: 404 })
        return new Response(file.content, { status: 200, headers: { 'content-type': file.contentType } })
      })
    }
  }
})

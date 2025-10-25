// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { getCrawlStatus } from '~/server/services/crawl'
import { httpError, json, safeHandler } from '../../utils'

export const Route = createFileRoute('/api/crawl/$jobId/status')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        try {
          const status = await getCrawlStatus(params.jobId)
          return json(status)
        } catch (error) {
          return httpError(404, error instanceof Error ? error.message : 'Job not found')
        }
      })
    }
  }
})

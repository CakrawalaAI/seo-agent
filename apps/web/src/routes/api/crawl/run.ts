// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { startCrawl } from '~/server/services/crawl'
import { json, parseJson, safeHandler } from '../utils'

const StartCrawlSchema = z.object({
  projectId: z.string().min(1),
  crawlBudget: z
    .object({
      maxPages: z.number().int().positive().optional(),
      respectRobots: z.boolean().optional(),
      includeSitemaps: z.boolean().optional()
    })
    .optional()
})

export const Route = createFileRoute('/api/crawl/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, StartCrawlSchema)
        const result = await startCrawl(input.projectId, input.crawlBudget)
        return json(result, { status: result?.skipped ? 200 : 202 })
      })
    }
  }
})

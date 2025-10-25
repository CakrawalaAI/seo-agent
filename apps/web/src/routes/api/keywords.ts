// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { createKeyword, listKeywords } from '~/server/services/keywords'
import { CreateKeywordInputSchema } from '@seo-agent/domain'
import { httpError, json, safeHandler } from './utils'

const KeywordQuerySchema = z.object({
  projectId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.string().optional()
})

export const Route = createFileRoute('/api/keywords')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const parseResult = KeywordQuerySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parseResult.success) {
          return httpError(400, 'Invalid query params', parseResult.error.flatten())
        }
        const { projectId, cursor, limit, status } = parseResult.data
        const response = await listKeywords(projectId, {
          cursor,
          limit,
          status: status as any
        })
        return json(response)
      }),
      POST: safeHandler(async ({ request }) => {
        const body = await request.json()
        const parsed = CreateKeywordInputSchema.safeParse(body)
        if (!parsed.success) {
          return httpError(400, 'Invalid keyword payload', parsed.error.flatten())
        }
        try {
          const keyword = await createKeyword(parsed.data)
          return json(keyword, { status: 201 })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create keyword'
          return httpError(409, message)
        }
      })
    }
  }
})

// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { deleteKeyword, updateKeyword } from '~/server/services/keywords'
import { UpdateKeywordInputSchema } from '@seo-agent/domain'
import { httpError, json, safeHandler } from '../utils'

const KeywordParamsSchema = z.object({
  keywordId: z.string().min(1)
})

export const Route = createFileRoute('/api/keywords/$keywordId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ request, params }) => {
        const { keywordId } = KeywordParamsSchema.parse(params)
        const body = await request.json()
        const parsed = UpdateKeywordInputSchema.safeParse(body)
        if (!parsed.success) {
          return httpError(400, 'Invalid keyword update', parsed.error.flatten())
        }
        const keyword = await updateKeyword(keywordId, parsed.data)
        if (!keyword) {
          return httpError(404, 'Keyword not found')
        }
        return json(keyword)
      }),
      DELETE: safeHandler(async ({ params }) => {
        const { keywordId } = KeywordParamsSchema.parse(params)
        const removed = await deleteKeyword(keywordId)
        if (!removed) {
          return httpError(404, 'Keyword not found')
        }
        return json({ status: 'ok', keywordId })
      })
    }
  }
})

// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler } from '@app/api-utils'
import { getKeywordIdeasOverride, setKeywordIdeasOverride } from '@common/providers/overrides'

type OverridePayload = {
  keywordIdeas?: 'mock' | null
}

export const Route = createFileRoute('/api/dev/providers')({
  server: {
    handlers: {
      GET: safeHandler(async () => {
        return json({ keywordIdeas: getKeywordIdeasOverride() })
      }),
      POST: safeHandler(async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as OverridePayload
        const next = body.keywordIdeas === 'mock' ? 'mock' : null
        setKeywordIdeasOverride(next)
        return json({ keywordIdeas: getKeywordIdeasOverride() })
      })
    }
  }
})

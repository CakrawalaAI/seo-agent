// @ts-nocheck
import { CreateOrgInputSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { createOrg } from '~/server/services/orgs'
import { json, parseJson, safeHandler } from './utils'

export const Route = createFileRoute('/api/orgs')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, CreateOrgInputSchema)
        const org = await createOrg(input)
        return json(org, { status: 201 })
      })
    }
  }
})

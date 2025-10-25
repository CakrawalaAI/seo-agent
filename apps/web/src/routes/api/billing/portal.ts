// @ts-nocheck
import { BillingPortalRequestSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { getPortalLink } from '~/server/services/billing'
import { json, safeHandler, httpError } from '../utils'

export const Route = createFileRoute('/api/billing/portal')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const params = Object.fromEntries(url.searchParams.entries())
        try {
          const result = await getPortalLink(BillingPortalRequestSchema.parse(params))
          return json(result)
        } catch (error: any) {
          if (error?.status) {
            return httpError(error.status, error.message ?? 'Billing error')
          }
          throw error
        }
      })
    }
  }
})

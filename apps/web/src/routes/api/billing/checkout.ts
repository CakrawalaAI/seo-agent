// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { createCheckoutLink } from '~/server/services/billing'
import { json, parseJson, safeHandler, httpError } from '../utils'
import { BillingCheckoutRequestSchema } from '@seo-agent/domain'

export const Route = createFileRoute('/api/billing/checkout')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await parseJson(request, BillingCheckoutRequestSchema)
        try {
          const result = await createCheckoutLink(body)
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

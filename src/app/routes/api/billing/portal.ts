// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, httpError } from '../utils'

export const Route = createFileRoute('/api/billing/portal')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => {
        const url = new URL(request.url)
        const orgId = url.searchParams.get('orgId')
        const returnUrl = url.searchParams.get('returnUrl') || '/dashboard'
        if (!orgId) return httpError(400, 'Missing orgId')
        const portalUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}portal=mock`
        return json({ url: portalUrl })
      })
    }
  }
})


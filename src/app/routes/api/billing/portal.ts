// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, httpError } from '@app/api-utils'
import { getPortalUrl } from '@common/billing/polar'

export const Route = createFileRoute('/api/billing/portal')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const orgId = url.searchParams.get('orgId')
        const returnUrl = url.searchParams.get('returnUrl') || '/dashboard'
        if (!orgId) return httpError(400, 'Missing orgId')
        const polar = await getPortalUrl(String(orgId), String(returnUrl))
        if (polar?.url) return json({ url: polar.url })
        const portalUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}portal=mock`
        return json({ url: portalUrl })
      })
    }
  }
})

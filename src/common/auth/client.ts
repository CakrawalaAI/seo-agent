import { createAuthClient } from 'better-auth/client'
import { organizationClient } from 'better-auth/client/plugins'
import { polarClient as polarClientPlugin } from '@polar-sh/better-auth'

// Client-side Better Auth proxy (dynamic API)
export const authClient = createAuthClient({
  // basePath defaults to /api/auth; credentials included by default
  plugins: [
    organizationClient(),
    polarClientPlugin()
  ]
})

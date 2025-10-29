import { createFileRoute } from '@tanstack/react-router'
import { json } from '@app/api-utils'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/auth/debug')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const s = session.read(request)
        return json({ cookie: s })
      },
    },
  },
})


// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { startDiscovery } from '~/server/services/discovery'
import { json, parseJson, safeHandler } from '../utils'

const StartDiscoverySchema = z.object({
  projectId: z.string().min(1)
})

export const Route = createFileRoute('/api/discovery/start')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, StartDiscoverySchema)
        const result = await startDiscovery(input.projectId)
        return json(result, { status: 202 })
      })
    }
  }
})

// @ts-nocheck
import { ScheduleRunRequestSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { runSchedule } from '~/server/services/schedule'
import { json, parseJson, safeHandler } from '../../utils'

export const Route = createFileRoute('/api/schedules/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, ScheduleRunRequestSchema)
        const result = await runSchedule({
          projectId: input.projectId,
          policy: input.policyOverride
        })
        return json({ status: 'ok', result })
      })
    }
  }
})
